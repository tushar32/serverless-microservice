# Distributed Transactions with Saga Pattern

This document explains how we handle distributed transactions across microservices using the **Saga Pattern**, **Outbox Pattern**, and **Event-Driven Choreography**.

## Table of Contents

- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Architecture Overview](#architecture-overview)
- [Implementation Details](#implementation-details)
- [Flow Diagrams](#flow-diagrams)
- [Key Components](#key-components)
- [Testing Scenarios](#testing-scenarios)

---

## The Problem

In a microservices architecture, we **cannot use traditional ACID transactions** that span multiple services:

```typescript
// ❌ THIS DOESN'T WORK IN MICROSERVICES
BEGIN TRANSACTION
  await ordersDB.save(order);           // Service 1
  await inventoryDB.reduceStock(...);   // Service 2  
  await paymentsDB.createCharge(...);   // Service 3
COMMIT TRANSACTION
```

**Why not?**
- Each service has its own database
- No distributed transaction coordinator
- Would create tight coupling
- Doesn't scale

---

## Our Solution

We use **three patterns** together:

### 1. Saga Pattern (Choreography)
- Break one big transaction into smaller local transactions
- Each service listens to events and reacts
- Compensating transactions handle failures

### 2. Outbox Pattern
- Ensure events are published reliably
- Save events atomically with data
- Publish asynchronously

### 3. Idempotency
- Handle duplicate events gracefully
- Track processed events
- Safe retries

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Distributed Transaction Flow                         │
└──────────────────────────────────────────────────────────────────────┘

Customer
   │
   │ POST /orders
   ▼
┌──────────────────────┐
│  Orders Service      │
│                      │
│  1. Create Order     │────┐
│  2. Save to DB       │    │  Single Transaction
│  3. Save to Outbox   │◄───┘  (ACID within service)
│  4. Return 201       │
└──────────┬───────────┘
           │
           │ (async)
           ▼
┌──────────────────────┐
│  Outbox Publisher    │
│  (Scheduled Lambda)  │
│                      │
│  Polls every 30s     │
│  Publishes events    │
└──────────┬───────────┘
           │
           │ Publish: order.created
           ▼
     ┌─────────────┐
     │ EventBridge │
     └──────┬──────┘
            │
            ├─────────────────────┐
            │                     │
            ▼                     ▼
┌───────────────────┐   ┌────────────────────┐
│ Inventory Service │   │  Rewards Service   │
│                   │   │                    │
│ Try to reserve    │   │  Award points      │
│ stock...          │   └────────────────────┘
└─────────┬─────────┘
          │
          ├─ SUCCESS ──────┐
          │                │
          │ Publish:       │
          │ inventory.     │
          │ reserved       │
          │                │
          ▼                │
    ┌─────────────┐        │
    │ EventBridge │        │
    └──────┬──────┘        │
           │               │
           ▼               ▼
  ┌──────────────────┐
  │ Orders Service   │
  │                  │
  │ Confirm order ✅ │
  └──────────────────┘

          OR

          ├─ FAILURE ─────┐
          │               │
          │ Publish:      │
          │ inventory.    │
          │ reservation.  │
          │ failed        │
          │               │
          ▼               │
    ┌─────────────┐       │
    │ EventBridge │       │
    └──────┬──────┘       │
           │              │
           ▼              ▼
  ┌──────────────────┐
  │ Orders Service   │
  │                  │
  │ Cancel order ❌  │
  │ (Compensation)   │
  └──────────────────┘
```

---

## Implementation Details

### Pattern 1: Outbox Pattern

**Problem**: How to ensure events are published even if Lambda crashes?

**Solution**: Save events atomically with data, publish asynchronously.

#### Outbox Repository

```typescript
// services/orders-service/src/infrastructure/database/outbox-repository.ts

export class OutboxRepository {
  
  async saveOrderWithEvents(order: Order, orderItem: any): Promise<void> {
    const events = order.domainEvents;
    
    const transactItems = [
      // 1. Save order
      { Put: { TableName: 'orders', Item: orderItem } },
      
      // 2. Save all events to outbox
      ...events.map(event => ({
        Put: {
          TableName: 'outbox',
          Item: {
            eventId: generateId(),
            eventType: event.eventType,
            eventData: JSON.stringify(event.data),
            published: false
          }
        }
      }))
    ];

    // Execute atomically!
    await dynamodb.transactWrite({ TransactItems: transactItems });
  }
}
```

**Benefits**:
- ✅ Order and events saved atomically (ACID)
- ✅ Events guaranteed to be published eventually
- ✅ Works even if Lambda crashes after save

#### Outbox Publisher

```typescript
// services/orders-service/src/handlers/scheduled/outbox-publisher.ts

export const handler: ScheduledHandler = async () => {
  // Runs every 30 seconds
  
  // 1. Get unpublished events
  const events = await outboxRepository.getUnpublishedEvents();
  
  // 2. Publish each event
  for (const event of events) {
    await eventBridge.putEvents({
      DetailType: event.eventType,
      Detail: event.eventData
    });
    
    // 3. Mark as published
    await outboxRepository.markPublished(event.eventId);
  }
};
```

**Schedule**: CloudWatch Events trigger every 30 seconds

---

### Pattern 2: Saga State Tracking

**Problem**: How to monitor distributed transactions?

**Solution**: Track saga state in DynamoDB.

#### Saga State Repository

```typescript
// services/orders-service/src/infrastructure/database/saga-state-repository.ts

export interface SagaState {
  sagaId: string;
  orderId: string;
  currentStep: SagaStep;
  steps: {
    created: { status: 'SUCCESS' | 'FAILED', timestamp: string },
    inventoryReservation?: { status, timestamp, error? },
    paymentProcessing?: { status, timestamp, error? },
    confirmation?: { status, timestamp }
  };
  compensationRequired: boolean;
  compensationReason?: string;
}

export class SagaStateRepository {
  
  async createSagaState(orderId: string): Promise<SagaState> {
    const sagaState = {
      sagaId: generateId(),
      orderId,
      currentStep: SagaStep.CREATED,
      steps: {
        created: { status: 'SUCCESS', timestamp: new Date().toISOString() }
      },
      compensationRequired: false
    };
    
    await dynamodb.put(sagaState);
    return sagaState;
  }
  
  async updateStep(
    sagaId: string,
    step: SagaStep,
    status: 'SUCCESS' | 'FAILED',
    error?: string
  ): Promise<void> {
    // Update saga state as transaction progresses
  }
  
  async markForCompensation(
    sagaId: string,
    reason: string
  ): Promise<void> {
    // Mark saga for rollback
  }
}
```

**Benefits**:
- ✅ Full audit trail of transaction
- ✅ Easy debugging
- ✅ Monitoring dashboards
- ✅ Manual intervention if needed

---

### Pattern 3: Idempotency

**Problem**: EventBridge delivers events at-least-once (duplicates possible)

**Solution**: Track processed events.

#### Idempotency Repository

```typescript
// services/inventory-service/src/infrastructure/database/idempotency-repository.ts

export class IdempotencyRepository {
  
  async isProcessed(eventId: string): Promise<boolean> {
    const result = await dynamodb.get({ Key: { eventId } });
    return !!result.Item;
  }
  
  async markProcessed(
    eventId: string,
    eventType: string,
    aggregateId: string
  ): Promise<boolean> {
    try {
      await dynamodb.put({
        Item: {
          eventId,
          eventType,
          aggregateId,
          processedAt: new Date().toISOString(),
          ttl: Date.now() / 1000 + (7 * 24 * 60 * 60) // 7 days
        },
        ConditionExpression: 'attribute_not_exists(eventId)' // Atomic!
      });
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Already processed
        return false;
      }
      throw error;
    }
  }
}
```

#### Usage in Event Handler

```typescript
// services/inventory-service/src/handlers/events/order-created.ts

export const handler: EventBridgeHandler = async (event) => {
  const eventId = event.id;
  const { orderId, items } = event.detail;
  
  // Step 1: Check idempotency
  if (await idempotencyRepository.isProcessed(eventId)) {
    console.log('Already processed, skipping');
    return; // Idempotent!
  }
  
  // Step 2: Process event
  try {
    await reserveInventory(items);
    await publishEvent('inventory.reserved', { orderId });
  } catch (error) {
    await publishEvent('inventory.reservation.failed', { orderId, reason: error.message });
  }
  
  // Step 3: Mark as processed
  await idempotencyRepository.markProcessed(eventId, 'order.created', orderId);
};
```

**Benefits**:
- ✅ Safe to retry
- ✅ Handles duplicates automatically
- ✅ Auto-cleanup with TTL (7 days)

---

## Flow Diagrams

### Success Flow

```
Customer     Orders         Outbox         Inventory      Orders
   │         Service       Publisher       Service       Service
   │            │             │               │             │
   ├─POST────→  │             │               │             │
   │            │             │               │             │
   │         ┌──┴──┐          │               │             │
   │         │ TX  │ Save     │               │             │
   │         │ ────┼─ Order   │               │             │
   │         │     ├─ Events  │               │             │
   │         └──┬──┘          │               │             │
   │            │             │               │             │
   │◄─201 OK──┤             │               │             │
   │            │             │               │             │
   │            │    (30s)    │               │             │
   │            │ ◄───Poll────┤               │             │
   │            │             │               │             │
   │            │ ─Publish───→│               │             │
   │            │             │               │             │
   │            │             │──order.created──→           │
   │            │             │               │             │
   │            │             │            ┌──┴──┐          │
   │            │             │            │Check│          │
   │            │             │            │Idemp│          │
   │            │             │            └──┬──┘          │
   │            │             │               │             │
   │            │             │            ┌──┴──┐          │
   │            │             │            │Reserve│        │
   │            │             │            │Stock │        │
   │            │             │            └──┬──┘          │
   │            │             │               │             │
   │            │             │               │             │
   │            │             │ ◄─inventory.reserved─       │
   │            │             │               │             │
   │            │             │               │──inventory.reserved─→
   │            │             │               │             │
   │            │             │               │          ┌──┴──┐
   │            │             │               │          │Confirm│
   │            │             │               │          │Order │
   │            │             │               │          └─────┘
   │            │             │               │             │
   │            │             │               │             ✅
```

### Failure Flow (Compensation)

```
Customer     Orders         Outbox         Inventory      Orders
   │         Service       Publisher       Service       Service
   │            │             │               │             │
   ├─POST────→  │             │               │             │
   │            │             │               │             │
   │         ┌──┴──┐          │               │             │
   │         │ TX  │ Save     │               │             │
   │         │ ────┼─ Order   │               │             │
   │         │     ├─ Events  │               │             │
   │         └──┬──┘          │               │             │
   │            │             │               │             │
   │◄─201 OK──┤             │               │             │
   │            │             │               │             │
   │            │    (30s)    │               │             │
   │            │ ◄───Poll────┤               │             │
   │            │             │               │             │
   │            │ ─Publish───→│               │             │
   │            │             │               │             │
   │            │             │──order.created──→           │
   │            │             │               │             │
   │            │             │            ┌──┴──┐          │
   │            │             │            │Check│          │
   │            │             │            │Stock│          │
   │            │             │            └──┬──┘          │
   │            │             │               │             │
   │            │             │               ❌            │
   │            │             │          Out of Stock       │
   │            │             │               │             │
   │            │             │ ◄─inventory.reservation.failed─
   │            │             │               │             │
   │            │             │               │──inventory.reservation.failed─→
   │            │             │               │             │
   │            │             │               │          ┌──┴──┐
   │            │             │               │          │Cancel│
   │            │             │               │          │Order │
   │            │             │               │          │(COMP)│
   │            │             │               │          └──┬───┘
   │            │             │               │             │
   │            │             │               │ ◄─order.cancelled──
   │            │             │               │             │
   │            │      ◄──order.cancelled─────────────     │
   │            │             │               │             │
   │            │             │            ┌──┴──┐          │
   │            │             │            │Release│        │
   │            │             │            │Stock │        │
   │            │             │            └─────┘          │
   │            │             │               │             │
   │            │             │               ✅            ❌
```

---

## Key Components

### Orders Service

#### Domain Events
- `order-created.event.ts` - Order was created (PENDING)
- `order-confirmed.event.ts` - Inventory reserved, order confirmed
- `order-cancelled.event.ts` - Order cancelled (compensation)

#### Event Handlers
- `inventory-reserved.ts` - Inventory succeeded → confirm order
- `inventory-reservation-failed.ts` - Inventory failed → cancel order (compensate)

#### Infrastructure
- `outbox-repository.ts` - Save events atomically
- `saga-state-repository.ts` - Track transaction state
- `outbox-publisher.ts` - Publish events asynchronously

### Inventory Service

#### Event Handlers
- `order-created.ts` - Try to reserve inventory
- `order-cancelled.ts` - Release inventory (compensation)

#### Infrastructure
- `idempotency-repository.ts` - Prevent duplicate processing

---

## Testing Scenarios

### Scenario 1: Happy Path

```bash
# Create order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "items": [
      { "productId": "product-1", "quantity": 2 }
    ]
  }'

# Response: 201 Created (immediately)
{
  "orderId": "order-abc",
  "status": "PENDING",
  ...
}

# Behind the scenes (async):
# 1. Order saved to DynamoDB ✅
# 2. Events saved to outbox ✅
# 3. Outbox publisher runs (30s) ✅
# 4. order.created published ✅
# 5. Inventory reserves stock ✅
# 6. inventory.reserved published ✅
# 7. Order status updated to CONFIRMED ✅

# Check order status
curl http://localhost:3000/orders/order-abc

# Response:
{
  "orderId": "order-abc",
  "status": "CONFIRMED", // Changed!
  ...
}
```

### Scenario 2: Inventory Failure

```bash
# Create order
curl -X POST http://localhost:3000/orders ...

# Response: 201 Created
{
  "orderId": "order-xyz",
  "status": "PENDING"
}

# Behind the scenes (async):
# 1. Order saved ✅
# 2. Events saved ✅
# 3. order.created published ✅
# 4. Inventory checks stock ❌ Out of stock!
# 5. inventory.reservation.failed published ✅
# 6. Order cancelled (compensation) ✅
# 7. order.cancelled published ✅

# Check order status
curl http://localhost:3000/orders/order-xyz

# Response:
{
  "orderId": "order-xyz",
  "status": "CANCELLED",
  "reason": "Inventory reservation failed: Insufficient stock"
}
```

### Scenario 3: Lambda Crashes

```bash
# Create order
curl -X POST http://localhost:3000/orders ...

# Lambda crashes RIGHT AFTER saving to DynamoDB
# but BEFORE publishing events

# What happens?
# 1. Order is saved ✅
# 2. Events are saved to outbox ✅
# 3. Lambda crashes 💥
# 4. (30 seconds later)
# 5. Outbox publisher wakes up ✅
# 6. Finds unpublished events ✅
# 7. Publishes them ✅
# 8. Saga continues normally ✅

# Result: No data loss! Transaction completes successfully!
```

### Scenario 4: Duplicate Events

```bash
# EventBridge delivers order.created twice (rare but possible)

# First delivery:
# 1. Check idempotency → Not processed
# 2. Reserve inventory ✅
# 3. Mark as processed ✅

# Second delivery (duplicate):
# 1. Check idempotency → Already processed!
# 2. Skip processing ✅
# 3. Return success ✅

# Result: Inventory only reduced once! Idempotent!
```

---

## Monitoring

### CloudWatch Metrics

Track these metrics:

```typescript
// Saga success rate
const sagaSuccessRate = confirmedOrders / createdOrders * 100;

// Average saga duration
const avgSagaDuration = sum(confirmedAt - createdAt) / count;

// Compensation rate
const compensationRate = cancelledOrders / createdOrders * 100;

// Outbox lag
const outboxLag = now - oldestUnpublishedEvent.createdAt;
```

### CloudWatch Alarms

```yaml
SagaFailureAlarm:
  Threshold: compensationRate > 10%
  Action: Send SNS notification

OutboxLagAlarm:
  Threshold: outboxLag > 5 minutes
  Action: Send SNS notification

EventProcessingFailure:
  Threshold: failedEvents > 5
  Action: Send SNS notification
```

### Query Saga State

```bash
# Get saga by order ID
aws dynamodb query \
  --table-name saga-states \
  --index-name OrderIdIndex \
  --key-condition-expression "orderId = :orderId" \
  --expression-attribute-values '{":orderId":{"S":"order-123"}}'

# Response:
{
  "sagaId": "saga_123",
  "orderId": "order-123",
  "currentStep": "INVENTORY_RESERVED",
  "steps": {
    "created": { "status": "SUCCESS", "timestamp": "..." },
    "inventoryReservation": { "status": "SUCCESS", "timestamp": "..." }
  },
  "compensationRequired": false
}
```

---

## Summary

### What We Achieved

✅ **Reliable distributed transactions** without 2PC  
✅ **Eventual consistency** across services  
✅ **Automatic compensation** on failures  
✅ **No data loss** even with crashes  
✅ **Idempotent** event handling  
✅ **Full audit trail** via saga state  
✅ **Scalable** architecture  

### Key Patterns Used

1. **Saga Pattern (Choreography)** - Distributed workflow
2. **Outbox Pattern** - Reliable event publishing
3. **Idempotency** - Safe retries
4. **Event Sourcing (partial)** - Audit trail
5. **Eventual Consistency** - Scalable architecture

### Trade-offs Accepted

❌ **Not strongly consistent** - Order shows PENDING briefly  
❌ **More complex** - More moving parts  
❌ **Harder to debug** - Distributed system  
❌ **Eventual consistency** - Customer might see stale data  

✅ **But**: Scales infinitely, resilient to failures, loosely coupled!

---

## Further Reading

- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Idempotency](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
