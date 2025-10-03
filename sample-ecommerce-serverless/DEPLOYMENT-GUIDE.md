# 🚀 Deployment Guide

## Prerequisites

### Required Tools
- **Node.js**: v18.x or later
- **npm**: v8.x or later
- **AWS CLI**: v2.x configured with credentials
- **AWS CDK**: v2.100.0 or later
- **TypeScript**: v5.x

### AWS Account Setup
- Active AWS account
- IAM user with Administrator access (or specific permissions)
- AWS CLI configured with credentials

```bash
# Verify AWS CLI configuration
aws sts get-caller-identity

# Install AWS CDK globally
npm install -g aws-cdk

# Bootstrap CDK (one-time per account/region)
cdk bootstrap aws://ACCOUNT-ID/REGION
```

---

## Quick Start (5 Minutes)

### 1. Clone and Install

```bash
# Navigate to project
cd sample-ecommerce-serverless

# Install root dependencies
npm install

# Install all workspace dependencies using Lerna
npx lerna bootstrap
```

### 2. Build All Services

```bash
# Build all services and shared libraries
npm run build

# Or build individually
cd services/orders-service
npm run build
```

### 3. Deploy Infrastructure

```bash
# Deploy shared infrastructure first
cd infrastructure/event-bus
cdk deploy

# Deploy Orders service
cd ../../services/orders-service
npm run deploy

# Deploy Catalog service
cd ../catalog-service
npm run deploy

# Deploy Rewards service
cd ../rewards-service
npm run deploy
```

### 4. Test the Deployment

```bash
# Get the API URL from CDK output
export API_URL="https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod"

# Create an order
curl -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "items": [
      {
        "productId": "prod-001",
        "quantity": 2
      }
    ]
  }'
```

---

## Detailed Setup

### Step 1: Environment Configuration

Each service needs environment-specific configuration.

#### Create Configuration Files

```bash
# Orders service
cat > services/orders-service/.env.development << EOF
ENVIRONMENT=development
CATALOG_SERVICE_URL=https://api.catalog.dev.example.com
EVENT_BUS_NAME=ecommerce-event-bus-dev
LOG_LEVEL=DEBUG
EOF

cat > services/orders-service/.env.production << EOF
ENVIRONMENT=production
CATALOG_SERVICE_URL=https://api.catalog.example.com
EVENT_BUS_NAME=ecommerce-event-bus
LOG_LEVEL=INFO
EOF
```

#### CDK Context Configuration

```bash
# cdk.context.json (in each service's infrastructure folder)
cat > services/orders-service/infrastructure/cdk.context.json << EOF
{
  "dev": {
    "catalogServiceUrl": "https://api.catalog.dev.example.com",
    "eventBusName": "ecommerce-event-bus-dev",
    "stage": "dev"
  },
  "prod": {
    "catalogServiceUrl": "https://api.catalog.example.com",
    "eventBusName": "ecommerce-event-bus",
    "stage": "prod"
  }
}
EOF
```

---

### Step 2: Build Process

#### Build All Services

```bash
# From root directory
npm run build

# This runs:
# 1. lerna run build (builds all packages)
# 2. Compiles TypeScript to JavaScript
# 3. Generates .d.ts declaration files
```

#### Build Output Structure

```
services/orders-service/
├── src/                    # Source TypeScript
└── dist/                   # Compiled JavaScript
    ├── handlers/
    │   ├── api/
    │   │   ├── create-order.js
    │   │   └── create-order.js.map
    │   └── events/
    ├── domain/
    ├── application/
    └── infrastructure/
```

---

### Step 3: Shared Infrastructure Deployment

#### Deploy Event Bus (First!)

```bash
cd infrastructure/event-bus

# Review the changes
cdk diff

# Deploy
cdk deploy

# Output will show:
# ✅ EventBusStack
# Outputs:
# EventBusStack.EventBusName = ecommerce-event-bus
# EventBusStack.EventBusArn = arn:aws:events:us-east-1:xxx:event-bus/ecommerce-event-bus
```

**What Gets Created**:
- EventBridge Event Bus
- Default event archive (30 days retention)
- CloudWatch Log Group for event debugging

---

### Step 4: Service Deployment

#### Deploy Orders Service

```bash
cd services/orders-service

# Synthesize CloudFormation template (optional)
npm run synth

# Deploy
npm run deploy

# Or with specific context
npm run deploy -- --context env=prod
```

**Deployment Output**:

```
✨ Deployment time: 120s

✅ OrdersServiceStack

Outputs:
OrdersServiceStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod
OrdersServiceStack.OrdersTableName = orders
OrdersServiceStack.EventBusName = ecommerce-event-bus

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789:stack/OrdersServiceStack/xxx
```

**Resources Created**:
- 4 Lambda functions (create-order, get-order, list-orders, payment-completed)
- 1 DynamoDB table (orders) with 2 GSIs
- 1 API Gateway REST API
- 1 EventBridge rule (payment.completed)
- CloudWatch Log Groups
- IAM roles and policies
- X-Ray tracing

#### Deploy Catalog Service

```bash
cd ../catalog-service
npm run deploy
```

**Resources Created**:
- 3 Lambda functions (get-product, list-products, update-product)
- 1 DynamoDB table (products) with 3 GSIs
- 1 API Gateway REST API
- CloudWatch alarms
- Lambda layer (shared code)

#### Deploy Rewards Service

```bash
cd ../rewards-service
npm run deploy
```

**Resources Created**:
- 2 Lambda functions (get-rewards, redeem-reward)
- 1 Lambda event handler (order-completed)
- 1 DynamoDB table (rewards)
- 1 EventBridge rule (order.completed)

---

### Step 5: Verification

#### Check CloudFormation Stacks

```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Should show:
# - EventBusStack
# - OrdersServiceStack
# - CatalogServiceStack
# - RewardsServiceStack
```

#### Check Lambda Functions

```bash
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `orders-`)].FunctionName'

# Output:
# [
#   "orders-create-order",
#   "orders-get-order",
#   "orders-list-orders",
#   "orders-payment-completed"
# ]
```

#### Check DynamoDB Tables

```bash
aws dynamodb list-tables

# Output should include:
# - orders
# - products
# - rewards
```

#### Check EventBridge Rules

```bash
aws events list-rules --event-bus-name ecommerce-event-bus

# Should show rules for:
# - payment.completed → orders-payment-completed
# - order.completed → rewards-order-completed
```

---

## Testing the Deployment

### 1. Seed Catalog with Products

```bash
# Create a product
curl -X POST $CATALOG_API_URL/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Mouse",
    "description": "Ergonomic wireless mouse",
    "price": 29.99,
    "currency": "USD",
    "sku": "MOUSE-001",
    "category": "Electronics",
    "stockQuantity": 100
  }'

# Response:
# {
#   "productId": "prod-abc123",
#   "name": "Wireless Mouse",
#   "price": 29.99,
#   "inStock": true
# }
```

### 2. Create an Order

```bash
curl -X POST $ORDERS_API_URL/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "items": [
      {
        "productId": "prod-abc123",
        "quantity": 2
      }
    ]
  }'

# Response:
# {
#   "orderId": "order-xyz789",
#   "customerId": "customer-123",
#   "items": [...],
#   "totalAmount": 59.98,
#   "status": "PENDING"
# }
```

### 3. Check Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/orders-create-order --follow

# Look for:
# [CreateOrderHandler] Received request
# [CreateOrderUseCase] Starting order creation
# [HTTP Cache] MISS: https://api.catalog.com/products/prod-abc123
# [EventPublisher] Event published successfully: order.created
```

### 4. Verify Event Processing

```bash
# Check Rewards service logs (should show order.created event received)
aws logs tail /aws/lambda/rewards-order-completed --follow

# Look for:
# [OrderCompletedHandler] Received event
# [RewardService] Issuing reward points
```

---

## Environment-Specific Deployments

### Development Environment

```bash
# Deploy to dev environment
cd services/orders-service
cdk deploy --context env=dev --profile dev-account

# Different resources will be created:
# - orders-dev table
# - orders-create-order-dev function
# - API Gateway stage: dev
```

### Staging Environment

```bash
cd services/orders-service
cdk deploy --context env=staging --profile staging-account
```

### Production Environment

```bash
cd services/orders-service
cdk deploy --context env=prod --profile prod-account --require-approval never
```

---

## Monitoring Setup

### CloudWatch Dashboards

After deployment, create a dashboard:

```bash
aws cloudwatch put-dashboard --dashboard-name EcommercePlatform \
  --dashboard-body file://monitoring/dashboard.json
```

**Dashboard Contents**:
- API Gateway request count, latency, errors
- Lambda invocations, duration, errors, throttles
- DynamoDB read/write capacity, throttles
- EventBridge events published/delivered
- Cache hit rate
- Circuit breaker state

### CloudWatch Alarms

CDK automatically creates alarms for:
- Lambda errors > 5 in 5 minutes
- API Gateway 5xx errors > 10 in 5 minutes
- DynamoDB throttled requests > 5 in 1 minute

### X-Ray Tracing

Enabled by default. View traces at:
```
https://console.aws.amazon.com/xray/home
```

---

## Rollback Strategy

### Automatic Rollback

CDK supports automatic rollback on deployment failure:

```bash
cdk deploy --rollback true
```

### Manual Rollback

```bash
# List stack history
aws cloudformation list-stack-instances \
  --stack-set-name OrdersServiceStack

# Rollback to previous version
cdk deploy --previous-version
```

### Zero-Downtime Updates

Lambda functions support versioning and aliases:

```typescript
// In CDK stack
const version = fn.currentVersion;
const alias = new lambda.Alias(this, 'Alias', {
  aliasName: 'prod',
  version: version
});

// Gradual rollout
alias.addAutoScaling({ maxCapacity: 10 });
```

---

## Cost Estimation

### Development Environment (Low Traffic)

| Service | Monthly Cost |
|---------|-------------|
| Lambda (1000 requests/day) | $0.20 |
| DynamoDB (PAY_PER_REQUEST) | $2.50 |
| API Gateway | $3.50 |
| EventBridge | $1.00 |
| CloudWatch Logs | $0.50 |
| **Total** | **~$8/month** |

### Production Environment (100K requests/day)

| Service | Monthly Cost |
|---------|-------------|
| Lambda (with caching) | $20 |
| DynamoDB | $75 |
| API Gateway | $350 |
| EventBridge | $10 |
| CloudWatch Logs | $5 |
| X-Ray | $5 |
| **Total** | **~$465/month** |

**With Caching Optimization**: ~$25/month savings (95% cache hit rate)

---

## Troubleshooting

### Issue: Lambda Function Not Found

```bash
# Check if function exists
aws lambda get-function --function-name orders-create-order

# If not found, redeploy
cd services/orders-service
npm run build
npm run deploy
```

### Issue: DynamoDB Throttling

```bash
# Check throttle metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=orders \
  --start-time 2025-10-03T00:00:00Z \
  --end-time 2025-10-03T23:59:59Z \
  --period 3600 \
  --statistics Sum

# Solution: Switch to provisioned capacity or increase on-demand throughput
```

### Issue: API Gateway 5xx Errors

```bash
# Check Lambda logs
aws logs tail /aws/lambda/orders-create-order --follow

# Common causes:
# 1. Missing environment variables
# 2. IAM permission issues
# 3. Timeout (increase in CDK)
```

### Issue: EventBridge Events Not Delivered

```bash
# Check dead letter queue
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/xxx/OrdersEventDLQ

# Check EventBridge metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name FailedInvocations \
  --dimensions Name=RuleName,Value=PaymentCompletedRule \
  --start-time 2025-10-03T00:00:00Z \
  --end-time 2025-10-03T23:59:59Z \
  --period 300 \
  --statistics Sum
```

---

## Cleanup

### Delete All Resources

```bash
# Delete services (in reverse order)
cd services/rewards-service
cdk destroy

cd ../catalog-service
cdk destroy

cd ../orders-service
cdk destroy

# Delete shared infrastructure
cd ../../infrastructure/event-bus
cdk destroy

# Verify all stacks deleted
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE
```

### Cleanup DynamoDB Data (Optional)

```bash
# If tables still exist, delete manually
aws dynamodb delete-table --table-name orders
aws dynamodb delete-table --table-name products
aws dynamodb delete-table --table-name rewards
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          npx lerna bootstrap
      
      - name: Build
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy
        run: npm run deploy:all
```

---

## Next Steps

1. ✅ Set up custom domain names for APIs
2. ✅ Configure AWS WAF for security
3. ✅ Set up AWS Backup for DynamoDB
4. ✅ Implement API authentication (Cognito)
5. ✅ Set up multi-region deployment
6. ✅ Configure VPC endpoints for private communication
7. ✅ Set up automated testing in CI/CD
8. ✅ Configure CloudWatch Insights queries
9. ✅ Set up SNS for alarm notifications
10. ✅ Implement cost optimization with Compute Savings Plans

---

## Support & Documentation

- **AWS CDK**: https://docs.aws.amazon.com/cdk/
- **AWS Lambda**: https://docs.aws.amazon.com/lambda/
- **EventBridge**: https://docs.aws.amazon.com/eventbridge/
- **DynamoDB**: https://docs.aws.amazon.com/dynamodb/

**Deployment complete! 🎉**
