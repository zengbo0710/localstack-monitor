import { NextRequest, NextResponse } from 'next/server';
import { s3Client } from '@/utils/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const key = searchParams.get('key');

    if (!bucket || !key) {
      return NextResponse.json(
        { error: 'Missing required parameters: bucket and key' },
        { status: 400 }
      );
    }

    // Create the command
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Create a presigned URL that expires in 5 minutes (300 seconds)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return NextResponse.json({ url: presignedUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: `Failed to generate download URL: ${error.message}` },
      { status: 500 }
    );
  }
}