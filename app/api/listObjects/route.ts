import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client } from "../../../utils/s3Client";

export async function GET(request: NextRequest) {
  // Get the bucket name from the URL query parameters
  const { searchParams } = new URL(request.url);
  const bucketName = searchParams.get('bucket');
  
  if (!bucketName) {
    return NextResponse.json({ 
      error: "Missing bucket name parameter" 
    }, { status: 400 });
  }
  
  console.log(`Attempting to list objects in bucket: ${bucketName}`);
  
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
    });
    
    const response = await s3Client.send(command);
    console.log("S3 listObjects response:", response);
    
    // Format objects with relevant information
    const formattedObjects = (response.Contents || []).map(object => ({
      Key: object.Key,
      Size: object.Size,
      LastModified: object.LastModified,
      ETag: object.ETag,
    }));
    
    return NextResponse.json({ 
      objects: formattedObjects,
      count: formattedObjects.length,
      bucket: bucketName,
    });
  } catch (error: any) {
    console.error(`Error listing objects in bucket ${bucketName}:`, error);
    return NextResponse.json({ 
      error: `Failed to retrieve objects from bucket: ${bucketName}`, 
      details: error.message,
      code: error.Code || error.name || 'UNKNOWN_ERROR' 
    }, { status: 500 });
  }
}