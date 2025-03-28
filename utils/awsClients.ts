import { SQSClient } from '@aws-sdk/client-sqs';
import { S3Client } from '@aws-sdk/client-s3';

// Create AWS service clients with the appropriate configuration
const commonConfig = {
  endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  }
};

// Export the clients
export const sqsClient = new SQSClient(commonConfig);
export const s3Client = new S3Client(commonConfig);

// Create placeholders for other service clients
// These will be initialized on-demand in the health check to avoid
// requiring all AWS SDK packages until they're actually used
export const awsServiceClients = {
  // Already initialized clients
  sqs: sqsClient,
  s3: s3Client,
  
  // Function to create clients when needed
  getClient: async (serviceName: string) => {
    try {
      switch(serviceName.toLowerCase()) {
        case 'lambda':
          const { LambdaClient } = await import('@aws-sdk/client-lambda');
          return new LambdaClient(commonConfig);
        
        case 'dynamodb':
          const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
          return new DynamoDBClient(commonConfig);
          
        case 'eventbridge':
        case 'events':
          const { EventBridgeClient } = await import('@aws-sdk/client-eventbridge');
          return new EventBridgeClient(commonConfig);
          
        case 'ssm':
          const { SSMClient } = await import('@aws-sdk/client-ssm');
          return new SSMClient(commonConfig);
          
        case 'firehose':
          const { FirehoseClient } = await import('@aws-sdk/client-firehose');
          return new FirehoseClient(commonConfig);

        case 'elasticsearch':
        case 'es':
          const { ElasticsearchServiceClient } = await import('@aws-sdk/client-elasticsearch-service');
          return new ElasticsearchServiceClient(commonConfig);
          
        default:
          throw new Error(`Unsupported service: ${serviceName}`);
      }
    } catch (error) {
      console.error(`Failed to initialize ${serviceName} client:`, error);
      throw error;
    }
  }
};