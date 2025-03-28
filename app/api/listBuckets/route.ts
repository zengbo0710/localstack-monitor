import { NextResponse } from 'next/server';
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../utils/s3Client";

export async function GET() {
  try {
    // Test connection to S3 client first
    console.log("Attempting to connect to S3 (LocalStack)...");
    
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    
    console.log("S3 response received:", response);
    
    // Format buckets with additional information if available
    const formattedBuckets = (response.Buckets || []).map(bucket => ({
      Name: bucket.Name || '',
      CreationDate: bucket.CreationDate,
    }));
    
    return NextResponse.json({ 
      buckets: formattedBuckets,
      count: formattedBuckets.length
    });
  } catch (error: any) {
    console.error("Error listing buckets:", error);
    
    // Return a proper JSON error response instead of letting Next.js generate an HTML error page
    return NextResponse.json({ 
      error: "Failed to retrieve buckets", 
      details: error.message,
      code: error.Code || error.name || 'UNKNOWN_ERROR' 
    }, { status: 500 });
  }
}