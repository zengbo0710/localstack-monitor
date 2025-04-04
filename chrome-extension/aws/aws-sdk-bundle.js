// Import the AWS SQS client and commands
import { 
  SQSClient, 
  ReceiveMessageCommand, 
  SendMessageCommand, 
  DeleteMessageCommand 
} from "@aws-sdk/client-sqs";

// Configure SQS client for LocalStack
const sqsClient = new SQSClient({
  region: "ap-southeast-1",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  maxAttempts: 3
});

// Export the configured client and commands
export { 
  sqsClient, 
  ReceiveMessageCommand, 
  SendMessageCommand, 
  DeleteMessageCommand 
};
