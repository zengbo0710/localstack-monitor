import { NextResponse } from 'next/server';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../../../utils/sqsClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queueUrl } = body;

    if (!queueUrl) {
      return NextResponse.json({ 
        error: 'Queue URL is required', 
        success: false 
      }, { status: 400 });
    }

    // Request all available attributes for the queue
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    });
    
    const response = await sqsClient.send(command);
    
    return NextResponse.json({ 
      attributes: response.Attributes,
      success: true 
    });
  } catch (error: any) {
    console.error('Error getting queue attributes:', error);
    
    return NextResponse.json(
      { 
        error: `Failed to get queue attributes: ${error.message || 'Unknown error'}`, 
        success: false 
      },
      { status: 500 }
    );
  }
}