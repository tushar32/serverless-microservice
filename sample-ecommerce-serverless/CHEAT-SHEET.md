# 📝 Quick Reference Cheat Sheet

## 🚀 Quick Commands

```bash
# Install everything
npm install && npx lerna bootstrap

# Build all
npm run build

# Deploy all services
npm run deploy:all

# Deploy single service
cd services/orders-service && npm run deploy

# View logs
aws logs tail /aws/lambda/orders-create-order --follow

# Destroy everything
cd services/orders-service && cdk destroy
cd ../catalog-service && cdk destroy
cd ../rewards-service && cdk destroy
```

---

## 📂 Project Structure Quick Map

```
sample-ecommerce-serverless/
├── services/                    # Microservices
│   ├── orders-service/          # ✅ Complete
│   ├── catalog-service/         # ⚠️ Partial
│   └── rewards-service/         # 📋 Skeleton
│
├── shared/                      # Shared libraries
│   ├── domain-primitives/       # DDD base classes
│   ├── http-client/             # Undici + Cache + Circuit Breaker
│   ├── event-schemas/           # Event definitions
│   └── logger/                  # Logging utilities
│
├── infrastructure/              # Shared infra
│   ├── event-bus/               # EventBridge
│   └── monitoring/              # CloudWatch
│
└── docs/
    ├── README.md
    ├── IMPLEMENTATION-GUIDE.md
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT-GUIDE.md
    └── CHEAT-SHEET.md (this file)
```

---

## 🎯 DDD Patterns Quick Reference

### Aggregate Root

```typescript
// Create aggregate
const order = Order.create(customerId, items);

// Business method
order.confirm();
order.complete();
order.cancel('reason');

// Domain events
order.domainEvents // [OrderCreatedEvent]
order.clearEvents()
```

### Value Object

```typescript
// Immutable, self-validating
const money = Money.create(10.99, 'USD');
const total = money.add(Money.create(5.00, 'USD'));
// money is unchanged (immutable)
```

### Repository (Interface in Domain)

```typescript
// Domain layer
interface IOrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

// Infrastructure layer
class DynamoDBOrderRepository implements IOrderRepository {
  async save(order: Order) { /* DynamoDB logic */ }
}
```

### Use Case (Application Layer)

```typescript
class CreateOrderUseCase {
  async execute(dto: CreateOrderDTO) {
    // 1. Validate
    // 2. Call external services (ACL)
    // 3. Create aggregate
    // 4. Save
    // 5. Publish events
    return responseDTO;
  }
}
```

### Anti-Corruption Layer (ACL)

```typescript
// Protects domain from external changes
class CatalogClient {
  async getProduct(id: string): Promise<ProductInfo> {
    const response = await this.httpClient.get(`/products/${id}`);
    return this.translateToOrdersDomain(response); // ACL
  }
  
  private translateToOrdersDomain(external: CatalogProduct): ProductInfo {
    // Map external model → internal model
  }
}
```

---

## 🔄 Communication Patterns

### Synchronous (HTTP with Cache)

```typescript
// In Use Case
const products = await catalogClient.getProducts(productIds);
// ↑ Uses Undici with caching
// First call: HTTP request (200ms)
// Subsequent: Cache hit (< 1ms)
```

### Asynchronous (Events)

```typescript
// Publish
await eventPublisher.publish(new OrderCreatedEvent({...}));

// Subscribe (EventBridge routes to Lambda)
export const handler: EventBridgeHandler = async (event) => {
  // React to order.created
};
```

---

## 🛠️ Code Snippets

### Create New Aggregate

```typescript
import { AggregateRoot } from '@shared/domain-primitives';

export class MyAggregate extends AggregateRoot<MyProps> {
  
  static create(data: CreateData): MyAggregate {
    // Validate business rules
    if (!data.field) throw new Error('Required');
    
    const aggregate = new MyAggregate({...}, id);
    aggregate.addDomainEvent(new MyCreatedEvent({...}));
    return aggregate;
  }
  
  // Business methods
  doSomething(): void {
    // Business logic
    this.props.field = newValue;
    this.addDomainEvent(new MyChangedEvent({...}));
  }
}
```

### Create New Value Object

```typescript
import { ValueObject } from '@shared/domain-primitives';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  
  static create(value: string): Email {
    if (!this.isValid(value)) {
      throw new Error('Invalid email');
    }
    return new Email({ value: value.toLowerCase() });
  }
  
  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  get value(): string {
    return this.props.value;
  }
}
```

### Create New Lambda Handler

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // 1. Parse input
    const body = JSON.parse(event.body || '{}');
    
    // 2. Call use case
    const result = await useCase.execute(body);
    
    // 3. Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Add CDK Resource

```typescript
// In CDK stack
const myFunction = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'my-handler.handler',
  code: lambda.Code.fromAsset('dist/handlers'),
  environment: {
    TABLE_NAME: myTable.tableName
  },
  timeout: Duration.seconds(30),
  tracing: lambda.Tracing.ACTIVE
});

// Grant permissions
myTable.grantReadWriteData(myFunction);
```

---

## 🔍 Testing

### Unit Test (Domain)

```typescript
describe('Order', () => {
  it('should create order with items', () => {
    const items = [OrderItem.create(...)];
    const order = Order.create('customer-1', items);
    
    expect(order.orderId).toBeDefined();
    expect(order.status.isPending()).toBe(true);
    expect(order.domainEvents).toHaveLength(1);
  });
  
  it('should not create without items', () => {
    expect(() => Order.create('customer-1', []))
      .toThrow('Order must have at least one item');
  });
});
```

### Integration Test

```typescript
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let mockCatalogClient: jest.Mocked<CatalogClient>;
  
  beforeEach(() => {
    mockCatalogClient = {
      getProducts: jest.fn().mockResolvedValue(new Map([...]))
    };
    useCase = new CreateOrderUseCase(repo, mockCatalogClient, publisher);
  });
  
  it('should create order', async () => {
    const dto = { customerId: 'c1', items: [...] };
    const result = await useCase.execute(dto);
    
    expect(result.orderId).toBeDefined();
    expect(mockCatalogClient.getProducts).toHaveBeenCalled();
  });
});
```

---

## 📊 Monitoring Queries

### CloudWatch Insights Queries

```sql
-- Find slow Lambda executions
fields @timestamp, @duration, @requestId
| filter @duration > 1000
| sort @duration desc
| limit 20

-- Count errors by type
fields @message
| filter @message like /ERROR/
| stats count() by @message

-- Cache hit rate
fields @message
| filter @message like /Cache/
| stats count(*) by @message
```

### X-Ray Filter Expressions

```
service("orders-create-order") AND http.status = 500
duration > 1
annotation.cache = "MISS"
```

---

## 🐛 Common Issues & Solutions

### Issue: "Circuit breaker is OPEN"

```typescript
// Check circuit breaker state
console.log(catalogClient.getHealthStatus());

// Solution: Wait 60 seconds or restart service
// Or increase threshold in config
```

### Issue: DynamoDB "Conditional check failed"

```typescript
// This means optimistic locking failed
// Solution: Retry the operation with fresh data
```

### Issue: "Resource not found" in CDK deploy

```bash
# Bootstrap CDK again
cdk bootstrap

# Clear CDK cache
rm -rf cdk.out/
cdk synth
```

---

## 🎨 Architecture Patterns

### Layer Dependencies

```
✅ CORRECT:
Handler → Application → Domain
   ↓          ↓
Infrastructure ←┘

❌ WRONG:
Domain → Infrastructure  (Never!)
Handler → Domain directly (Use Application layer)
```

### Module Structure

```
src/
├── handlers/           # Entry points (thin)
├── application/        # Use cases (orchestration)
├── domain/            # Business logic (no deps!)
└── infrastructure/    # Technical details (DynamoDB, HTTP)
```

---

## 💡 Best Practices Checklist

### Domain Layer
- [ ] No infrastructure dependencies
- [ ] Rich domain models (not anemic)
- [ ] Value objects for concepts
- [ ] Domain events for state changes
- [ ] Repository interfaces (not implementations)

### Application Layer
- [ ] Thin use cases (orchestration only)
- [ ] Input/output DTOs
- [ ] Transaction boundaries
- [ ] Event publishing after persistence

### Infrastructure Layer
- [ ] Implements domain interfaces
- [ ] ACL for external services
- [ ] Proper error handling
- [ ] Structured logging

### Handlers
- [ ] Dependency injection
- [ ] Input validation
- [ ] Error translation
- [ ] Structured responses

---

## 🔐 Security Checklist

- [ ] API Gateway throttling configured
- [ ] DynamoDB encryption at rest
- [ ] CloudWatch Logs encryption
- [ ] IAM least privilege
- [ ] No hardcoded secrets
- [ ] VPC endpoints for private traffic
- [ ] WAF rules for API Gateway

---

## 💰 Cost Optimization

### Quick Wins
1. **Enable HTTP caching** → 95% cost reduction
2. **Right-size Lambda memory** → Check CloudWatch Insights
3. **Use DynamoDB PAY_PER_REQUEST** for variable workloads
4. **Set CloudWatch Logs retention** → 7 days for dev, 30 for prod
5. **Use Lambda SnapStart** for Java (if applicable)

### Monitor These
```bash
# Lambda cost by function
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

## 🔗 Useful Links

- **AWS CDK Docs**: https://docs.aws.amazon.com/cdk/
- **DDD Reference**: https://domainlanguage.com/ddd/
- **Undici Docs**: https://undici.nodejs.org/
- **EventBridge Patterns**: https://serverlessland.com/patterns

---

## 📞 Quick Help

**Can't find something?**
- Domain logic → `src/domain/`
- HTTP caching → `shared/http-client/`
- Event schemas → `shared/event-schemas/`
- Infrastructure → `infrastructure/lib/`
- Documentation → Root `*.md` files

**Common commands not working?**
```bash
# Rebuild everything
npm run clean && npm run build

# Reset dependencies
rm -rf node_modules */node_modules
npm install && npx lerna bootstrap
```

---

**Last Updated**: 2025-10-03  
**Version**: 1.0.0
