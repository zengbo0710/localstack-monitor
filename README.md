# LocalStack Monitor

A comprehensive web-based monitoring and management tool for [LocalStack](https://localstack.cloud/) services, built with Next.js 15, React 19, and TypeScript. This application allows developers to interact with and monitor AWS services running locally in LocalStack through an intuitive user interface.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Using the Application](#using-the-application)
  - [Health Status Page](#health-status-page)
  - [S3 Buckets Page](#s3-buckets-page)
  - [SQS Queues Page](#sqs-queues-page)
- [Configuration](#configuration)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)

## Features

- **Health Status Dashboard**: Monitor the health of all LocalStack services in real-time
- **S3 Management**: Browse, search, and manage S3 buckets and objects
- **SQS Queue Management**: View, create, delete queues and send/receive messages
- **Data Caching**: Intelligent caching across tabs for improved performance
- **Refresh Controls**: Manual refresh buttons to fetch the latest data on demand
- **Auto-refresh**: Configurable auto-refresh intervals for SQS queues (5s, 10s, 20s, 30s)
- **Persistent Preferences**: Search filters and sort settings are preserved between tab navigation
- **Responsive UI**: Modern, responsive design that works on various screen sizes

## Project Structure

```
/
├── app/                 # Application routes and components using Next.js App Router
│   ├── api/             # API route handlers for interacting with LocalStack
│   ├── components/      # Shared UI components
│   ├── dashboard/       # S3 Buckets page
│   ├── health/          # Health Status page
│   ├── queues/          # SQS Queues page
│   └── page.tsx         # Root page (redirects to health status)
├── public/              # Static assets
├── utils/               # Utility functions and AWS SDK clients
│   ├── DataContext.tsx  # Context for caching and sharing data between tabs
│   ├── sqsClient.ts     # SQS client configuration
│   └── s3Client.ts      # S3 client configuration
└── package.json         # Project dependencies and scripts
```

## Getting Started

First, make sure LocalStack is running in your environment:

```bash
# Start LocalStack
localstack start
```

Then, install dependencies including all required AWS SDK packages:

```bash
# Install base dependencies
npm install

# Install ALL required AWS SDK modules to avoid any errors:
npm install \
  @aws-sdk/client-sqs \
  @aws-sdk/client-s3 \
  @aws-sdk/client-dynamodb \
  @aws-sdk/client-lambda \
  @aws-sdk/client-sns \
  @aws-sdk/client-cloudwatch \
  @aws-sdk/client-api-gateway \
  @aws-sdk/client-sfn \
  @aws-sdk/client-elasticsearch-service \
  @aws-sdk/client-kinesis \
  @aws-sdk/client-ses \
  @aws-sdk/client-iam \
  @aws-sdk/client-ec2 \
  @aws-sdk/client-ssm \
  @aws-sdk/client-eventbridge \
  @aws-sdk/client-rds \
  @aws-sdk/client-firehose \
  @aws-sdk/client-cloudwatch-logs \
  @aws-sdk/s3-request-presigner
```

Finally, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the LocalStack Monitor dashboard.

## Using the Application

### Health Status Page

The Health Status page provides a real-time overview of all LocalStack services:

- **Service Status**: View which services are available and their current status
- **Latency Information**: See response times for each service
- **Timestamp**: Check when the health data was last updated
- **Manual Refresh**: Use the refresh button to get the latest health status

### S3 Buckets Page

The S3 Buckets page allows you to manage your LocalStack S3 buckets:

- **View Buckets**: See a list of all S3 buckets in your LocalStack instance
- **Search**: Filter buckets by name with the search bar
- **Create Buckets**: Create new buckets with the "Create Bucket" button
- **Bucket Details**: View creation date and status of each bucket
- **Refresh**: Update the bucket list with the latest data from LocalStack
- **Persistent Search**: Your search filters persist when navigating between tabs

### SQS Queues Page

The SQS Queues page provides comprehensive management of SQS queues:

- **Queue List**: View all SQS queues in your LocalStack instance
- **Queue Details**: See message count and queue attributes
- **Message Management**: Send messages to queues and view/delete existing messages
- **Search**: Filter queues by name
- **Sorting**: Sort queues by name or message count
- **Auto-refresh**: Set intervals (5s, 10s, 20s, 30s) for automatic data refresh
- **Manual Refresh**: Use the refresh button to get the latest queue data
- **Persistent Settings**: Your search filters and sort order persist across tab navigation

#### Using Auto-refresh

1. Navigate to the SQS Queues page
2. Find the "Auto-refresh" dropdown next to the refresh button
3. Select your preferred refresh interval (5s, 10s, 20s, or 30s)
4. The page will now automatically refresh at the selected interval
5. Select "Off" to disable auto-refresh

## Configuration

By default, the application connects to LocalStack at `http://localhost:4566`. If your LocalStack instance is running on a different port or host, you can configure this in the environment variables by modifying the AWS client configurations in the `utils` directory:

- `utils/s3Client.ts`
- `utils/sqsClient.ts`

## Technologies Used

- **Next.js 15.2.4**: React framework for server-rendered applications
- **React 19**: UI library for building component-based interfaces
- **TypeScript**: For type safety and improved developer experience
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **AWS SDK v3**: For interacting with LocalStack services
- **CSS Modules**: For component-scoped styling
- **React Icons**: For UI icons

### Key Application Features

#### Data Caching
The application implements intelligent data caching across tabs, meaning:
- Data is only retrieved from the API on the first tab click or when explicitly refreshed
- Subsequent navigation to the same tab reuses cached data for a faster experience
- Each service (S3, SQS) maintains its own cached state

#### Refresh Controls
- **Manual Refresh**: All pages feature refresh buttons to manually fetch the latest data
- **Auto-Refresh for SQS Queues**: The SQS Queues page includes an auto-refresh dropdown with options for 5s, 10s, 20s, and 30s intervals

#### Persistent User Preferences
- Search filters and results are preserved when switching between tabs
- Sort settings (column and direction) are maintained across tab navigation
- This allows you to pick up exactly where you left off when returning to a previously viewed tab

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
