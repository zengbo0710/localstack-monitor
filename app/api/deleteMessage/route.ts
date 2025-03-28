import { NextResponse } from 'next/server';
import { DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../../../utils/sqsClient';

export async function POST(request: Request) {
  try {
    const { queueUrl, receiptHandle } = await request.json();
    
    if (!queueUrl || !receiptHandle) {
      return NextResponse.json(
        { error: 'Queue URL and receipt handle are required', success: false },
        { status: 400 }
      );
    }

    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    });

    await sqsClient.send(command);
    
    return NextResponse.json({ 
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message from SQS queue:', error);
    return NextResponse.json(
      { error: 'Failed to delete message', success: false },
      { status: 500 }
    );
  }
}