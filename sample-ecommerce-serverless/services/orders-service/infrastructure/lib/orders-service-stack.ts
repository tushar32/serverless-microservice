import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Orders Service Stack
 * 
 * This CDK stack defines all AWS resources for the Orders microservice:
 * - DynamoDB table for orders
 * - Lambda functions for API and event handling
 * - API Gateway for REST API
 * - EventBridge rules for event subscriptions
 * - IAM permissions
 * - Monitoring and logging
 */
export class OrdersServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================
    // DynamoDB Table
    // ============================================
    
    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: 'orders',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      
      // Encryption
      encryption: dynamodb.TableEncryption.AWS_MANAGED
    });

    // GSI for querying by customer
    ordersTable.addGlobalSecondaryIndex({
      indexName: 'CustomerIdIndex',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for querying by status
    ordersTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'orderStatus', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // ============================================
    // EventBridge Event Bus (shared)
    // ============================================
    
    const eventBus = events.EventBus.fromEventBusName(
      this,
      'SharedEventBus',
      'ecommerce-event-bus'
    );

    // ============================================
    // Lambda Layer (shared code)
    // ============================================
    
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('../../shared/dist'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared libraries (domain-primitives, http-client, etc.)'
    });

    // Common Lambda configuration
    const lambdaCommonProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ORDERS_TABLE_NAME: ordersTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
        CATALOG_SERVICE_URL: this.node.tryGetContext('catalogServiceUrl') || 'https://api.catalog.example.com',
        LOG_LEVEL: 'INFO'
      },
      layers: [commonLayer],
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK
    };

    // ============================================
    // Lambda Functions
    // ============================================

    // Create Order Lambda
    const createOrderFunction = new lambda.Function(this, 'CreateOrderFunction', {
      ...lambdaCommonProps,
      functionName: 'orders-create-order',
      handler: 'create-order.handler',
      code: lambda.Code.fromAsset('dist/handlers/api'),
      description: 'Create a new order'
    });

    // Get Order Lambda
    const getOrderFunction = new lambda.Function(this, 'GetOrderFunction', {
      ...lambdaCommonProps,
      functionName: 'orders-get-order',
      handler: 'get-order.handler',
      code: lambda.Code.fromAsset('dist/handlers/api'),
      description: 'Get order by ID'
    });

    // List Orders Lambda
    const listOrdersFunction = new lambda.Function(this, 'ListOrdersFunction', {
      ...lambdaCommonProps,
      functionName: 'orders-list-orders',
      handler: 'list-orders.handler',
      code: lambda.Code.fromAsset('dist/handlers/api'),
      description: 'List orders for a customer'
    });

    // Payment Completed Event Handler
    const paymentCompletedFunction = new lambda.Function(this, 'PaymentCompletedFunction', {
      ...lambdaCommonProps,
      functionName: 'orders-payment-completed',
      handler: 'payment-completed.handler',
      code: lambda.Code.fromAsset('dist/handlers/events'),
      description: 'Handle payment completed event'
    });

    // ============================================
    // IAM Permissions
    // ============================================

    // Grant DynamoDB permissions
    ordersTable.grantReadWriteData(createOrderFunction);
    ordersTable.grantReadData(getOrderFunction);
    ordersTable.grantReadData(listOrdersFunction);
    ordersTable.grantReadWriteData(paymentCompletedFunction);

    // Grant EventBridge permissions
    eventBus.grantPutEventsTo(createOrderFunction);
    eventBus.grantPutEventsTo(paymentCompletedFunction);

    // ============================================
    // API Gateway
    // ============================================

    const api = new apigateway.RestApi(this, 'OrdersApi', {
      restApiName: 'Orders Service API',
      description: 'API for orders management',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    // /orders resource
    const orders = api.root.addResource('orders');
    
    // POST /orders (create)
    orders.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createOrderFunction),
      {
        requestValidator: new apigateway.RequestValidator(this, 'CreateOrderValidator', {
          restApi: api,
          validateRequestBody: true
        })
      }
    );

    // GET /orders (list)
    orders.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listOrdersFunction)
    );

    // GET /orders/{orderId} (get by ID)
    const order = orders.addResource('{orderId}');
    order.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getOrderFunction)
    );

    // ============================================
    // EventBridge Rules (Event Subscriptions)
    // ============================================

    // Subscribe to payment.completed events
    const paymentCompletedRule = new events.Rule(this, 'PaymentCompletedRule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['payment-service'],
        detailType: ['payment.completed']
      },
      description: 'Forward payment completed events to Orders service'
    });

    paymentCompletedRule.addTarget(
      new targets.LambdaFunction(paymentCompletedFunction, {
        retryAttempts: 3
      })
    );

    // ============================================
    // CloudWatch Alarms
    // ============================================

    // Alarm for Lambda errors
    createOrderFunction.metricErrors({
      period: cdk.Duration.minutes(5)
    }).createAlarm(this, 'CreateOrderErrorAlarm', {
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when create order function has errors'
    });

    // Alarm for API Gateway 5xx errors
    api.metricServerError({
      period: cdk.Duration.minutes(5)
    }).createAlarm(this, 'ApiServerErrorAlarm', {
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when API has server errors'
    });

    // ============================================
    // Outputs
    // ============================================

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Orders API URL'
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Orders DynamoDB table name'
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
      description: 'Event bus name'
    });
  }
}
