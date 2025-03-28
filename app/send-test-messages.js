// Script to send 2 test messages to an SQS queue

// Browser version - for use in browser console when on the queues page
// Function to send test messages to a selected queue
function sendTestMessages() {
  // Get the currently selected queue URL from the UI
  // If no queue is selected, ask the user to select one first
  const selectedQueueElement = document.querySelector('.selectedRow');
  if (!selectedQueueElement) {
    alert('Please select a queue first!');
    return;
  }
  
  // Extract the queue URL
  const queueUrl = selectedQueueElement.querySelector('button').onclick.toString()
    .match(/setSelectedQueue\(['"](.+?)['"]\)/)[1];
  
  const messages = [
    { body: JSON.stringify({ test: "First test message", timestamp: new Date().toISOString() }) },
    { body: JSON.stringify({ test: "Second test message", timestamp: new Date().toISOString() }) }
  ];

  console.log("Sending messages to queue:", queueUrl);
  
  // Create promises for both message sends
  const sendPromises = messages.map((message, index) => {
    return fetch('/api/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queueUrl: queueUrl,
        messageBody: message.body,
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Message ${index + 1} sent successfully. Message ID: ${data.messageId}`);
        return true;
      } else {
        console.error(`Failed to send message ${index + 1}:`, data.error);
        return false;
      }
    })
    .catch(error => {
      console.error(`Error sending message ${index + 1}:`, error);
      return false;
    });
  });
  
  // Wait for all messages to be sent
  Promise.all(sendPromises)
    .then(results => {
      const successCount = results.filter(Boolean).length;
      console.log(`Done sending test messages. ${successCount} of ${messages.length} messages sent successfully.`);
      
      // Refresh the messages list to show the new messages
      document.querySelector('button.refreshButton').click();
    });
}

// Only add to window when in browser context
if (typeof window !== 'undefined') {
  // Instructions for use
  console.log("To send 2 test messages:");
  console.log("1. Select a queue from the list");
  console.log("2. Run sendTestMessages() in the console");

  // Export for easy access in console
  window.sendTestMessages = sendTestMessages;
}

// NODE.JS COMMAND LINE VERSION
// Only runs when executed directly (not when loaded in browser)
if (typeof window === 'undefined') {
  // Create a simpler script using the built-in https module instead of node-fetch
  const https = require('https');
  const http = require('http');
  
  async function sendTestMessagesNode() {
    // Use a specific queue URL for test-queue
    // This is the common LocalStack format for SQS queue URLs
    const queueUrl = 'http://localhost:4566/000000000000/test-queue';
    
    const messages = [
      { body: JSON.stringify({ test: "First test message", timestamp: new Date().toISOString() }) },
      { body: JSON.stringify({ test: "Second test message", timestamp: new Date().toISOString() }) }
    ];
    
    console.log("Sending messages to test-queue:", queueUrl);
    
    // Promise wrapper for http.request
    function httpRequest(url, options, data) {
      return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestModule = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = requestModule.request(url, options, (res) => {
          let responseBody = '';
          
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          
          res.on('end', () => {
            try {
              const data = JSON.parse(responseBody);
              resolve(data);
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(error);
        });
        
        if (data) {
          req.write(data);
        }
        
        req.end();
      });
    }
    
    async function sendMessage(message, index) {
      const data = JSON.stringify({
        queueUrl: queueUrl,
        messageBody: message.body,
      });
      
      try {
        const result = await httpRequest('http://localhost:3000/api/sendMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }, data);
        
        if (result.success) {
          console.log(`Message ${index + 1} sent successfully. Message ID: ${result.messageId}`);
          return true;
        } else {
          console.error(`Failed to send message ${index + 1}:`, result.error);
          return false;
        }
      } catch (error) {
        console.error(`Error sending message ${index + 1}:`, error);
        return false;
      }
    }
    
    // Send messages one by one
    let successCount = 0;
    for (let i = 0; i < messages.length; i++) {
      const success = await sendMessage(messages[i], i);
      if (success) successCount++;
    }
    
    console.log(`Done sending test messages. ${successCount} of ${messages.length} messages sent successfully.`);
  }
  
  // Run the function when script is executed
  sendTestMessagesNode().catch(console.error);
}