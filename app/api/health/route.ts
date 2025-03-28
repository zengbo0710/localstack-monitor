import { NextResponse } from 'next/server';
import { ListQueuesCommand } from '@aws-sdk/client-sqs';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { ListRulesCommand } from '@aws-sdk/client-eventbridge';
import { ListDeliveryStreamsCommand } from '@aws-sdk/client-firehose';
import { DescribeElasticsearchDomainCommand } from '@aws-sdk/client-elasticsearch-service';
import { DescribeParametersCommand } from '@aws-sdk/client-ssm';
import { ListTopicsCommand } from '@aws-sdk/client-sns';
import { DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { GetRestApisCommand } from '@aws-sdk/client-api-gateway';
import { ListStateMachinesCommand } from '@aws-sdk/client-sfn';
import { ListStreamsCommand } from '@aws-sdk/client-kinesis';
import { ListIdentitiesCommand } from '@aws-sdk/client-ses';
import { ListRolesCommand } from '@aws-sdk/client-iam';
import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { sqsClient, s3Client, awsServiceClients } from '@/utils/awsClients';

interface ServiceHealth {
  name: string;
  status: string;
  latency: number | null;
  details: any;
}

export async function GET(request: Request) {
  // Get URL parameters to check if we're requesting a specific service
  const url = new URL(request.url);
  const requestedService = url.searchParams.get('service');
  
  // Fetch the current list of services that should be monitored
  let monitoredServicesResponse;
  try {
    monitoredServicesResponse = await fetch(`${url.origin}/api/updateMonitoringPreferences`);
    monitoredServicesResponse = await monitoredServicesResponse.json();
  } catch (error) {
    console.error('Failed to fetch monitoring preferences:', error);
    // Fall back to default monitored services
    monitoredServicesResponse = {
      success: true,
      monitoredServices: [
        'SQS', 'S3', 'DynamoDB', 'Lambda', 'EventBridge',
        'SSM', 'Firehose', 'ElasticSearch'
      ],
      allAvailableServices: [
        'SQS', 'S3', 'DynamoDB', 'Lambda', 'SNS', 'CloudWatch', 
        'API Gateway', 'Step Functions', 'ElasticSearch', 'Kinesis',
        'SES', 'IAM', 'EC2', 'SSM', 'EventBridge', 'RDS', 'Firehose'
      ]
    };
  }
  
  const monitoredServices = monitoredServicesResponse.monitoredServices || [];
  
  // Define all services to check (or just the requested one)
  const servicesToCheck: ServiceHealth[] = [
    ...monitoredServices.map((name: string) => ({
      name,
      status: 'unknown',
      latency: null,
      details: null
    }))
  ].filter(service => !requestedService || service.name === requestedService);

  // Check SQS health
  if ((!requestedService || requestedService === 'SQS') && monitoredServices.includes('SQS')) {
    try {
      const listQueuesResponse = await fetch('http://localhost:3000/api/listQueues');
      const listQueuesData = await listQueuesResponse.json();
      
      const startTime = Date.now();
      const sqsApiResponse = await sqsClient.send(new ListQueuesCommand({ 
        QueueNamePrefix: '',
        MaxResults: 1000
      }));
      const endTime = Date.now();
      
      const sqsService = servicesToCheck.find(s => s.name === 'SQS');
      if (sqsService) {
        if (listQueuesData.success) {
          sqsService.status = 'healthy';
          sqsService.latency = endTime - startTime;
          sqsService.details = {
            queueCount: listQueuesData.queues.length,
            queues: listQueuesData.queues.map((q: any) => q.name).join(', ')
          };
        } else {
          sqsService.status = 'healthy';
          sqsService.latency = endTime - startTime;
          sqsService.details = {
            queueCount: sqsApiResponse.QueueUrls?.length || 0,
            queues: (sqsApiResponse.QueueUrls || [])
              .map(url => url.split('/').pop() || '')
              .join(', ')
          };
        }
      }
    } catch (error: any) {
      console.error('Health check SQS error:', error);
      
      try {
        const response = await fetch('http://localhost:4566/?Action=ListQueues', {
          headers: {
            'Accept': 'application/json'
          }
        });
        const text = await response.text();
        
        const matches = text.match(/https?:\/\/[^<]+/g) || [];
        const queueUrls = matches.filter(url => url.includes('queue'));
        
        const sqsService = servicesToCheck.find(s => s.name === 'SQS');
        if (sqsService) {
          sqsService.status = queueUrls.length > 0 ? 'healthy' : 'error';
          sqsService.latency = 0;
          sqsService.details = {
            queueCount: queueUrls.length,
            queues: queueUrls.map(url => url.split('/').pop() || '').join(', '),
            message: 'Using direct LocalStack connection'
          };
        }
      } catch (directError: any) {
        const sqsService = servicesToCheck.find(s => s.name === 'SQS');
        if (sqsService) {
          sqsService.status = 'error';
          sqsService.details = {
            message: `Failed to get queue count: ${error.message}`,
            code: error.code
          };
        }
      }
    }
  }

  // Check S3 health
  if ((!requestedService || requestedService === 'S3') && monitoredServices.includes('S3')) {
    try {
      const startTime = Date.now();
      const s3Response = await s3Client.send(new ListBucketsCommand({}));
      const endTime = Date.now();
      
      const s3Service = servicesToCheck.find(s => s.name === 'S3');
      if (s3Service) {
        s3Service.status = 'healthy';
        s3Service.latency = endTime - startTime;
        s3Service.details = {
          bucketCount: s3Response.Buckets?.length || 0
        };
      }
    } catch (error: any) {
      const s3Service = servicesToCheck.find(s => s.name === 'S3');
      if (s3Service) {
        s3Service.status = 'error';
        s3Service.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check DynamoDB health
  if ((!requestedService || requestedService === 'DynamoDB') && monitoredServices.includes('DynamoDB')) {
    try {
      const dynamoClient = await awsServiceClients.getClient('dynamodb');
      const startTime = Date.now();
      const dynamoResponse = await dynamoClient.send(new ListTablesCommand({}));
      const endTime = Date.now();
      
      const dynamoService = servicesToCheck.find(s => s.name === 'DynamoDB');
      if (dynamoService) {
        dynamoService.status = 'healthy';
        dynamoService.latency = endTime - startTime;
        dynamoService.details = {
          tableCount: dynamoResponse.TableNames?.length || 0
        };
      }
    } catch (error: any) {
      const dynamoService = servicesToCheck.find(s => s.name === 'DynamoDB');
      if (dynamoService) {
        dynamoService.status = 'error';
        dynamoService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check Lambda health
  if ((!requestedService || requestedService === 'Lambda') && monitoredServices.includes('Lambda')) {
    try {
      const lambdaClient = await awsServiceClients.getClient('lambda');
      const startTime = Date.now();
      const lambdaResponse = await lambdaClient.send(new ListFunctionsCommand({}));
      const endTime = Date.now();
      
      const lambdaService = servicesToCheck.find(s => s.name === 'Lambda');
      if (lambdaService) {
        lambdaService.status = 'healthy';
        lambdaService.latency = endTime - startTime;
        lambdaService.details = {
          functionCount: lambdaResponse.Functions?.length || 0
        };
      }
    } catch (error: any) {
      const lambdaService = servicesToCheck.find(s => s.name === 'Lambda');
      if (lambdaService) {
        lambdaService.status = 'error';
        lambdaService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check EventBridge health
  if ((!requestedService || requestedService === 'EventBridge') && monitoredServices.includes('EventBridge')) {
    try {
      const eventsClient = await awsServiceClients.getClient('events');
      const startTime = Date.now();
      const eventsResponse = await eventsClient.send(new ListRulesCommand({
        Limit: 10
      }));
      const endTime = Date.now();
      
      const eventsService = servicesToCheck.find(s => s.name === 'EventBridge');
      if (eventsService) {
        eventsService.status = 'healthy';
        eventsService.latency = endTime - startTime;
        eventsService.details = {
          ruleCount: eventsResponse.Rules?.length || 0
        };
      }
    } catch (error: any) {
      const eventsService = servicesToCheck.find(s => s.name === 'EventBridge');
      if (eventsService) {
        eventsService.status = 'error';
        eventsService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check SSM health
  if ((!requestedService || requestedService === 'SSM') && monitoredServices.includes('SSM')) {
    try {
      const ssmClient = await awsServiceClients.getClient('ssm');
      const startTime = Date.now();
      const ssmResponse = await ssmClient.send(new DescribeParametersCommand({
        MaxResults: 10
      }));
      const endTime = Date.now();
      
      const ssmService = servicesToCheck.find(s => s.name === 'SSM');
      if (ssmService) {
        ssmService.status = 'healthy';
        ssmService.latency = endTime - startTime;
        ssmService.details = {
          parameterCount: ssmResponse.Parameters?.length || 0
        };
      }
    } catch (error: any) {
      const ssmService = servicesToCheck.find(s => s.name === 'SSM');
      if (ssmService) {
        ssmService.status = 'error';
        ssmService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check Firehose health
  if ((!requestedService || requestedService === 'Firehose') && monitoredServices.includes('Firehose')) {
    try {
      const firehoseClient = await awsServiceClients.getClient('firehose');
      const startTime = Date.now();
      const firehoseResponse = await firehoseClient.send(new ListDeliveryStreamsCommand({}));
      const endTime = Date.now();
      
      const firehoseService = servicesToCheck.find(s => s.name === 'Firehose');
      if (firehoseService) {
        firehoseService.status = 'healthy';
        firehoseService.latency = endTime - startTime;
        firehoseService.details = {
          deliveryStreamCount: firehoseResponse.DeliveryStreamNames?.length || 0
        };
      }
    } catch (error: any) {
      const firehoseService = servicesToCheck.find(s => s.name === 'Firehose');
      if (firehoseService) {
        firehoseService.status = 'error';
        firehoseService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }

  // Check ElasticSearch health
  if ((!requestedService || requestedService === 'ElasticSearch') && monitoredServices.includes('ElasticSearch')) {
    try {
      const esClient = await awsServiceClients.getClient('es');
      const startTime = Date.now();
      const esResponse = await esClient.send(new DescribeElasticsearchDomainCommand({
        DomainName: 'dummy-domain'
      }));
      const endTime = Date.now();
      
      const esService = servicesToCheck.find(s => s.name === 'ElasticSearch');
      if (esService) {
        esService.status = 'healthy';
        esService.latency = endTime - startTime;
        esService.details = {
          domain: esResponse.DomainStatus?.DomainName || 'test-domain'
        };
      }
    } catch (error: any) {
      const esService = servicesToCheck.find(s => s.name === 'ElasticSearch');
      if (esService) {
        esService.status = 'error';
        esService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }
  
  // SNS health check
  if ((!requestedService || requestedService === 'SNS') && monitoredServices.includes('SNS')) {
    try {
      const snsClient = await awsServiceClients.getClient('sns');
      const startTime = Date.now();
      const snsResponse = await snsClient.send(new ListTopicsCommand({}));
      const endTime = Date.now();
      
      const snsService = servicesToCheck.find(s => s.name === 'SNS');
      if (snsService) {
        snsService.status = 'healthy';
        snsService.latency = endTime - startTime;
        snsService.details = {
          topicCount: snsResponse.Topics?.length || 0
        };
      }
    } catch (error: any) {
      const snsService = servicesToCheck.find(s => s.name === 'SNS');
      if (snsService) {
        snsService.status = 'error';
        snsService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }
  
  // CloudWatch health check
  if ((!requestedService || requestedService === 'CloudWatch') && monitoredServices.includes('CloudWatch')) {
    try {
      const cloudwatchClient = await awsServiceClients.getClient('cloudwatch');
      const startTime = Date.now();
      const cwResponse = await cloudwatchClient.send(new DescribeLogGroupsCommand({
        limit: 10
      }));
      const endTime = Date.now();
      
      const cwService = servicesToCheck.find(s => s.name === 'CloudWatch');
      if (cwService) {
        cwService.status = 'healthy';
        cwService.latency = endTime - startTime;
        cwService.details = {
          logGroupCount: cwResponse.logGroups?.length || 0
        };
      }
    } catch (error: any) {
      const cwService = servicesToCheck.find(s => s.name === 'CloudWatch');
      if (cwService) {
        cwService.status = 'error';
        cwService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }
  
  // API Gateway health check
  if ((!requestedService || requestedService === 'API Gateway') && monitoredServices.includes('API Gateway')) {
    try {
      const apiGatewayClient = await awsServiceClients.getClient('apigateway');
      const startTime = Date.now();
      const apiResponse = await apiGatewayClient.send(new GetRestApisCommand({
        limit: 10
      }));
      const endTime = Date.now();
      
      const apiService = servicesToCheck.find(s => s.name === 'API Gateway');
      if (apiService) {
        apiService.status = 'healthy';
        apiService.latency = endTime - startTime;
        apiService.details = {
          apiCount: apiResponse.items?.length || 0
        };
      }
    } catch (error: any) {
      const apiService = servicesToCheck.find(s => s.name === 'API Gateway');
      if (apiService) {
        apiService.status = 'error';
        apiService.details = {
          message: error.message,
          code: error.code
        };
      }
    }
  }
  
  // For single service refresh, add it back to the full services list to keep proper context
  let allServices = servicesToCheck;
  
  if (requestedService) {
    allServices = monitoredServices.map((name: string) => {
      const updatedService = servicesToCheck.find(s => s.name === name);
      if (updatedService) {
        return updatedService;
      }
      return {
        name,
        status: 'unknown',
        latency: null,
        details: null
      };
    });
  }

  // Calculate overall health status
  const healthyCount = allServices.filter(service => service.status === 'healthy').length;
  const totalCount = allServices.length;
  let overallStatus = 'error';
  
  if (healthyCount === totalCount) {
    overallStatus = 'healthy';
  } else if (healthyCount > 0) {
    overallStatus = 'degraded';
  }

  // Return the health check results along with all available services for the UI
  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: requestedService ? servicesToCheck : allServices,
    allAvailableServices: monitoredServicesResponse.allAvailableServices || []
  });
}