import { SQSClient } from "@aws-sdk/client-sqs";

// Configuration for localstack
const sqsClient = new SQSClient({
  region: "ap-southeast-1", // Updated region to match where queues are created
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  // Adding maximum retry attempts and better error handling
  maxAttempts: 3
});

// Log initialization
console.log("SQS Client initialized with endpoint: http://localhost:4566, region: ap-southeast-1");

export { sqsClient };