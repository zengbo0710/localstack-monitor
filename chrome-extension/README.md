# LocalStack Monitor - Chrome Extension

A Chrome extension for monitoring and managing [LocalStack](https://localstack.cloud/) services directly from your browser. This extension allows you to quickly check service health, manage S3 buckets, and monitor SQS queues without leaving your browser.

## Features

- **Persistent Badge**: Shows the number of available LocalStack services in the extension icon
- **Health Status Dashboard**: Monitor the health of all LocalStack services in real-time
- **S3 Bucket Management**: Browse, search, and view S3 buckets
- **SQS Queue Monitoring**: View, search, and monitor message counts in SQS queues
- **Auto-refresh**: Configure automatic refresh intervals for SQS queues
- **Responsive UI**: Compact but comprehensive interface optimized for extension popup
- **Persistent Preferences**: Your search filters and sort settings are saved between sessions

## Installation

### Development Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `chrome-extension` directory
5. The LocalStack Monitor extension should now be installed and visible in your extensions list

### Usage

1. Ensure LocalStack is running on your machine (default: http://localhost:4566)
2. Click the LocalStack Monitor icon in your Chrome toolbar
3. Use the tab navigation to switch between Health Status, S3 Buckets, and SQS Queues
4. Configure auto-refresh for SQS queues using the dropdown menu
5. Access settings by clicking the "Settings" link in the footer

### Configuration

By default, the extension connects to LocalStack at `http://localhost:4566`. If your LocalStack instance is running on a different port or host:

1. Click on "Settings" in the extension popup
2. Enter your custom LocalStack endpoint
3. Click "Save Settings"

## Architecture

This Chrome extension was converted from a Next.js web application and follows these architectural principles:

- **Popup UI**: React-like components built with vanilla JavaScript
- **Background Script**: Monitors LocalStack health and updates the extension badge
- **Options Page**: Allows configuration of connection settings
- **Storage**: Uses Chrome's storage API to persist settings and state
- **Direct API Access**: Makes direct HTTP requests to LocalStack API endpoints

## Development

### Project Structure

```
chrome-extension/
├── manifest.json       # Extension manifest file
├── popup/              # Popup UI that appears when clicking the extension icon
│   ├── index.html
│   ├── popup.css
│   └── popup.js
├── background/         # Background script for badge updates and health checking
│   └── background.js
├── options/            # Options page for configuration settings
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Future Improvements

- Add the ability to create and delete buckets and queues
- Implement message viewing and sending for SQS queues
- Add support for other LocalStack services like Lambda and DynamoDB
- Create a dark mode theme
- Add notification features for service status changes
