import { S3Client } from "@aws-sdk/client-s3";

// Configuration for localstack
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

export { s3Client };