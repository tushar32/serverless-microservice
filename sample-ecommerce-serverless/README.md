# E-Commerce Serverless Platform - DDD Implementation

## Architecture Overview

This project demonstrates a complete DDD-based serverless microservices architecture with:

- **3 Bounded Contexts**: Orders, Catalog, Rewards
- **Event-Driven Communication**: Using Amazon EventBridge
- **HTTP Caching**: Using Undici with intelligent caching strategies
- **Domain-Driven Design**: Proper layering (Domain, Application, Infrastructure)
- **Clean Architecture**: Dependency inversion and hexagonal architecture patterns

## Project Structure

```
+-- services/           # Microservices (Bounded Contexts)
¦   +-- orders-service
¦   +-- catalog-service
¦   +-- rewards-service
+-- shared/            # Shared libraries
¦   +-- domain-primitives
¦   +-- event-schemas
¦   +-- http-client
¦   +-- logger
+-- infrastructure/    # Shared IaC
```

## Tech Stack

- **Runtime**: Node.js 18.x with TypeScript
- **Cloud**: AWS Lambda, DynamoDB, EventBridge, API Gateway
- **IaC**: AWS CDK
- **HTTP Client**: Undici with caching
- **Testing**: Jest

## Getting Started

```bash
# Install dependencies
npm install

# Build all services
npm run build

# Run tests
npm run test

# Deploy
npm run deploy
```

## Key Patterns Implemented

1. **Domain-Driven Design (DDD)**
   - Aggregates, Entities, Value Objects
   - Domain Events
   - Repositories
   - Domain Services

2. **Clean Architecture**
   - Domain Layer (business logic)
   - Application Layer (use cases)
   - Infrastructure Layer (technical details)

3. **Event-Driven Architecture**
   - Asynchronous communication via EventBridge
   - Event sourcing patterns
   - CQRS (Command Query Responsibility Segregation)

4. **HTTP Caching with Undici**
   - Cache-Control header support
   - ETag-based caching
   - Stale-while-revalidate
   - Circuit breaker for resilience

5. **Anti-Corruption Layer (ACL)**
   - Clean separation between bounded contexts
   - DTOs for data transfer
   - Adapters for external services

## Bounded Contexts

### Orders Context
- **Responsibility**: Order management
- **APIs**: Create order, get order, list orders
- **Events Published**: order.created, order.completed
- **Events Subscribed**: payment.completed

### Catalog Context
- **Responsibility**: Product management
- **APIs**: Get products, get product, update product
- **Events Published**: product.updated
- **Caching**: Aggressive caching with Undici

### Rewards Context
- **Responsibility**: Customer rewards
- **APIs**: Get rewards, redeem reward
- **Events Subscribed**: order.completed
- **Events Published**: reward.issued

## Communication Patterns

### Synchronous (HTTP with Undici + Caching)
```
Orders ? Catalog (get product details)
Rewards ? Orders (get order details)
```

### Asynchronous (EventBridge)
```
Orders ? order.created ? Rewards
Orders ? order.completed ? Rewards
Catalog ? product.updated ? Orders (cache invalidation)
```

## Deployment

Each service can be deployed independently:

```bash
cd services/orders-service
cdk deploy
```

Or deploy all at once:

```bash
npm run deploy:all
```
