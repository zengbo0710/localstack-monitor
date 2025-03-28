import { NextResponse } from 'next/server';
import { ListQueuesCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../../../utils/sqsClient';

export async function GET() {
  try {
    console.log('Listing SQS queues - API endpoint called');
    
    // Using ListQueuesCommand with an empty QueueNamePrefix will match all queues
    const command = new ListQueuesCommand({
      QueueNamePrefix: '',
      MaxResults: 1000
    });
    
    console.log('Sending ListQueuesCommand to SQS client');
    const response = await sqsClient.send(command);
    const queueUrls = response.QueueUrls || [];
    
    console.log(`Found ${queueUrls.length} queues`);
    
    // Format the response to include both URL and queue name
    const queuesWithNames = queueUrls.map(url => {
      // Extract queue name from the URL (last part after the last slash)
      const queueName = url.split('/').pop() || url;
      return {
        url: url,
        name: queueName
      };
    });
    
    console.log('Returning formatted queue list to client');
    return NextResponse.json({ 
      queues: queuesWithNames, 
      success: true 
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    // Detailed error logging
    console.error('Error listing SQS queues:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.$metadata?.httpStatusCode || 'Unknown'
    });
    
    return NextResponse.json(
      { 
        error: `Failed to list SQS queues: ${error.message || 'Unknown error'}`, 
        success: false 
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}