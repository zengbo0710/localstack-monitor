import { NextResponse } from 'next/server';
import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../../../utils/sqsClient';

export async function POST(request: Request) {
  try {
    const { queueUrl, maxMessages = 10, waitTimeSeconds = 0 } = await request.json();

    if (!queueUrl) {
      return NextResponse.json(
        { error: 'Queue URL is required', success: false },
        { status: 400 }
      );
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All']
    });

    const response = await sqsClient.send(command);
    
    return NextResponse.json({ 
      messages: response.Messages || [],
      success: true 
    });
  } catch (error) {
    console.error('Error receiving messages from SQS queue:', error);
    return NextResponse.json(
      { error: 'Failed to receive messages', success: false },
      { status: 500 }
    );
  }
}