import { NextResponse } from 'next/server';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../../../utils/sqsClient';

export async function POST(request: Request) {
  try {
    const { queueUrl, messageBody, messageAttributes } = await request.json();

    if (!queueUrl || !messageBody) {
      return NextResponse.json(
        { error: 'Queue URL and message body are required', success: false },
        { status: 400 }
      );
    }

    const params = {
      QueueUrl: queueUrl,
      MessageBody: messageBody,
      MessageAttributes: messageAttributes
    };

    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);
    
    return NextResponse.json({ 
      messageId: response.MessageId,
      success: true 
    });
  } catch (error) {
    console.error('Error sending message to SQS queue:', error);
    return NextResponse.json(
      { error: 'Failed to send message', success: false },
      { status: 500 }
    );
  }
}