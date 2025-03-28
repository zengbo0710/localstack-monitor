import { NextResponse } from 'next/server';

// Default list of services to monitor
const DEFAULT_MONITORED_SERVICES = [
  'SQS', 'S3', 'DynamoDB', 'Lambda', 'EventBridge',
  'SSM', 'Firehose'
];

// Using in-memory storage for demo purposes
// In production, this would be stored in a database
let monitoredServices = [...DEFAULT_MONITORED_SERVICES];

export async function GET() {
  return NextResponse.json({
    success: true,
    monitoredServices,
    allAvailableServices: [
      'SQS', 'S3', 'DynamoDB', 'Lambda', 'SNS', 'CloudWatch', 
      'API Gateway', 'Step Functions', 'ElasticSearch', 'Kinesis',
      'SES', 'IAM', 'EC2', 'SSM', 'EventBridge', 'RDS', 'Firehose'
    ]
  });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate that services is an array
    if (!data.services || !Array.isArray(data.services)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input: services must be an array of service names' 
        },
        { status: 400 }
      );
    }

    // Update the monitored services list
    monitoredServices = [...data.services];
    
    return NextResponse.json({
      success: true,
      monitoredServices
    });
  } catch (error: any) {
    console.error('Error updating monitoring preferences:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to update monitoring preferences: ${error.message || 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

// Reset to defaults
export async function DELETE() {
  monitoredServices = [...DEFAULT_MONITORED_SERVICES];
  
  return NextResponse.json({
    success: true,
    monitoredServices
  });
}