// AWS SDK Configuration for Chrome Extension
// This file configures AWS SDK v2 for direct use with LocalStack

// Configure AWS globally with options for Chrome extension
AWS.config.update({
  region: 'ap-southeast-1',
  credentials: new AWS.Credentials({
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }),
  httpOptions: {
    timeout: 5000 // 5 second timeout
  },
  // Important for Chrome extensions
  sslEnabled: false,
  s3ForcePathStyle: true
});

// Create SQS service object with explicit endpoint
const sqs = new AWS.SQS({
  apiVersion: '2012-11-05',
  endpoint: 'http://localhost:4566',
  // Disable CORS for LocalStack connections
  cors: true
});

// Export the configured SQS client
window.awsServices = {
  sqs: sqs
};

console.log('AWS SDK initialized for LocalStack endpoint: http://localhost:4566');
