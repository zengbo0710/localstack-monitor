// Queue message management functionality for the chrome extension
// This file contains functions for viewing, sending, and deleting SQS messages

import { state, saveState } from './popup.js';
import { showNotification } from './notifications.js';

// Format timestamp to a readable format
function formatTimestamp(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(date));
}

// Format visibility timeout in a human-readable way
function formatVisibilityTimeout(seconds) {
  if (!seconds) return 'Not available';
  
  const secs = parseInt(seconds);
  if (isNaN(secs)) return 'Invalid';
  
  if (secs < 60) {
    return `${secs} second${secs !== 1 ? 's' : ''}`;
  } else if (secs < 3600) {
    const mins = Math.floor(secs / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(secs / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}

// Format message body for display - handle JSON properly
function formatMessageBody(body) {
  if (!body) return '<empty message>';
  
  try {
    // Check if it's already formatted JSON with newlines
    if (body.includes('\n')) {
      return `<pre class="json-body">${escapeHtml(body)}</pre>`;
    }
    
    // Try to parse as JSON and pretty print
    const jsonObj = JSON.parse(body);
    return `<pre class="json-body">${escapeHtml(JSON.stringify(jsonObj, null, 2))}</pre>`;
  } catch (e) {
    // Not JSON or already formatted, return as is
    return escapeHtml(body);
  }
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Select a queue to view its messages
export function selectQueue(queueUrl) {
  console.log(`Selected queue: ${queueUrl}`);
  
  // Set the selected queue in state
  state.selectedQueue = queueUrl;
  saveState();
  
  // Extract the queue name for display and API calls
  const queueName = getQueueName(queueUrl);
  // Store the queue name in the state for API calls
  state.selectedQueueName = queueName;
  
  // Store the queue region in state (useful for API calls)
  const queueRegion = extractRegionFromQueueUrl(queueUrl);
  if (queueRegion) {
    state.selectedQueueRegion = queueRegion;
  }
  
  // Update queue detail title
  document.getElementById('queueDetailTitle').textContent = `Queue: ${queueName}`;
  
  // Show queue detail view, hide queue list view
  document.getElementById('queueListView').style.display = 'none';
  document.getElementById('queueDetailView').style.display = 'block';
  
  // Clear message input and messages
  document.getElementById('messageBody').value = '';
  state.messageBody = '';
  
  // Fetch messages from the selected queue
  fetchMessages();
}

// Extract region from queue URL
function extractRegionFromQueueUrl(queueUrl) {
  try {
    // Format: http://sqs.REGION.localhost.localstack.cloud:4566/...
    const matches = queueUrl.match(/sqs\.([\w-]+)\./i);
    return matches && matches[1] ? matches[1] : 'ap-southeast-1';
  } catch (e) {
    console.error('Error extracting region from queue URL:', e);
    return 'ap-southeast-1';
  }
}

// Get queue name from URL for display purposes 
function getQueueName(queueUrl) {
  const queue = state.queues.find((q) => q.url === queueUrl);
  if (queue) {
    return queue.name;
  }
  
  // Extract queue name from URL as fallback
  try {
    // URL format: http://sqs.region.localhost.localstack.cloud:4566/accountId/queueName
    const queueUrlParts = queueUrl.split('/');
    return queueUrlParts[queueUrlParts.length - 1] || 'Unknown Queue';
  } catch (e) {
    return 'Unknown Queue';
  }
}

// Fetch messages from the selected queue - direct LocalStack request
export async function fetchMessages() {
  if (!state.selectedQueue) return;
  
  state.messagesLoading = true;
  document.getElementById('messagesContainer').innerHTML = '<div class="loading">Loading messages...</div>';
  
  try {
    console.log('Fetching messages from queue:', state.selectedQueueName);
    
    // For LocalStack compatibility, use the exact format expected by SQS Query API
    const params = new URLSearchParams();
    params.append('Action', 'ReceiveMessage');
    params.append('Version', '2012-11-05');
    params.append('QueueUrl', state.selectedQueue);
    params.append('MaxNumberOfMessages', '10');
    params.append('WaitTimeSeconds', '0');
    params.append('VisibilityTimeout', '0');
    
    // Based on the AWS SQS documentation, AttributeNames is more correct than AttributeName.1
    params.append('AttributeNames.1', 'All');
    params.append('MessageAttributeNames.1', 'All');
    
    // Add debug info
    console.log('Queue URL:', state.selectedQueue);
    console.log('Queue name:', state.selectedQueueName);
    
    const url = `http://localhost:4566/?${params.toString()}`;
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
    }
    
    // Check content type
    const contentType = response.headers.get('content-type') || '';
    console.log('Response content type:', contentType);
    
    // Handle XML response
    const xmlText = await response.text();
    console.log('Raw response:', xmlText);
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Inspect the full XML structure
    console.log('XML document structure:', xmlDoc.documentElement.nodeName);
    
    // Log the entire XML for debugging
    console.log('Complete XML structure:', xmlText);
    
    // Get messages from XML - they are inside ReceiveMessageResult
    let messageElements = [];
    
    // First check for the proper structure (ReceiveMessageResponse -> ReceiveMessageResult -> Message)
    const receiveMessageResult = xmlDoc.getElementsByTagName('ReceiveMessageResult');
    if (receiveMessageResult.length > 0) {
      // Check if the ReceiveMessageResult element has any content or is empty
      const resultContent = receiveMessageResult[0].innerHTML.trim();
      if (resultContent) {
        messageElements = receiveMessageResult[0].getElementsByTagName('Message');
        console.log('Found messages inside ReceiveMessageResult:', messageElements.length);
      } else {
        console.log('ReceiveMessageResult is empty - no messages in queue');
      }
    } else {
      // Fallback to direct Message lookup
      messageElements = xmlDoc.getElementsByTagName('Message');
      console.log('Found message elements directly:', messageElements.length);
    }
    
    // Extract messages
    const messages = [];
    for (let i = 0; i < messageElements.length; i++) {
      const msg = messageElements[i];
      const messageId = msg.getElementsByTagName('MessageId')[0]?.textContent || '';
      const receiptHandle = msg.getElementsByTagName('ReceiptHandle')[0]?.textContent || '';
      const body = msg.getElementsByTagName('Body')[0]?.textContent || '';
      
      // Try to parse the body as JSON if it looks like JSON
      let parsedBody = body;
      if (body && body.trim().startsWith('{') && body.trim().endsWith('}')) {
        try {
          parsedBody = JSON.parse(body);
          console.log('Parsed message body as JSON:', parsedBody);
        } catch (e) {
          console.log('Body looks like JSON but failed to parse:', e);
          // Keep original body if parsing fails
        }
      }
      
      // Create a complete message object with all necessary properties
      const messageObj = {
        MessageId: messageId,
        ReceiptHandle: receiptHandle,
        Body: body, // Keep the original body string for rendering
        // Add a display version of the body for rendering JSON nicely
        DisplayBody: typeof parsedBody === 'object' ? JSON.stringify(parsedBody, null, 2) : body
      };
      
      // Add to our messages array
      console.log('Adding message to array:', messageObj);
      messages.push(messageObj);
    }
    
    console.log('Parsed messages:', messages);
    
    // *** CRITICAL FIX - Force direct display of messages ***
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer && messages.length > 0) {
      console.log('DIRECT DISPLAY: Found message container and have messages, forcing display');
      
      // Create a simple HTML representation of messages
      let html = `<div style="padding: 10px;">
        <h4 style="margin-bottom: 10px;">Found ${messages.length} SQS Messages:</h4>
      `;
      
      // Add each message
      messages.forEach((msg, i) => {
        html += `
          <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
            <div style="font-weight: bold; margin-bottom: 5px;">Message #${i+1} - ID: ${msg.MessageId || 'Unknown'}</div>
            <pre style="background-color: #f0f0f0; padding: 8px; border-radius: 3px; overflow: auto; max-height: 150px; margin: 5px 0;">${
              msg.Body || JSON.stringify(msg, null, 2)
            }</pre>
            <button class="direct-delete-btn" data-receipt-handle="${msg.ReceiptHandle}" 
              style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
              Delete Message
            </button>
          </div>
        `;
      });
      
      html += '</div>';
      
      // Set the HTML directly
      messagesContainer.innerHTML = html;
      
      // Add event listeners to delete buttons
      document.querySelectorAll('.direct-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const receiptHandle = e.target.getAttribute('data-receipt-handle');
          if (receiptHandle) {
            deleteMessage(receiptHandle);
          }
        });
      });
    } else if (messagesContainer) {
      if (messages.length === 0) {
        messagesContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #666;">
            <p>No messages found in this queue.</p>
            <p style="font-size: 0.9em; margin-top: 10px;">
              SQS messages may be temporarily invisible after being received. Try again in a few seconds or send a new message.
            </p>
          </div>
        `;
      } else {
        console.error('Message container found but no messages to display');
      }
    } else {
      console.error('Message container not found!');
    }
    
    // Still update the state for other functions
    state.messages = messages;
    
    // Update messages last updated timestamp
    const messagesLastUpdated = document.getElementById('messagesLastUpdated');
    if (messagesLastUpdated) {
      messagesLastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    document.getElementById('messagesContainer').innerHTML = `
      <div class="empty-messages">
        <p>Error fetching messages from queue.</p>
        <p><small>${error.message}</small></p>
      </div>
    `;
  } finally {
    state.messagesLoading = false;
  }
}

// Send a message to the selected queue - direct LocalStack request
export async function sendMessage(messageBody) {
  if (!state.selectedQueue || !messageBody.trim()) return;
  
  state.sendingMessage = true;
  
  try {
    console.log('Sending message to queue:', state.selectedQueueName);
    
    // Get queue name for FIFO detection
    const queueName = getQueueName(state.selectedQueue);
    
    // Prepare request body
    const requestBody = {
      QueueUrl: state.selectedQueue,
      MessageBody: messageBody
    };
    
    // Add FIFO queue parameters if needed
    if (queueName.endsWith('.fifo')) {
      requestBody.MessageGroupId = 'default';
      requestBody.MessageDeduplicationId = Date.now().toString();
      console.log('Adding FIFO queue parameters for .fifo queue');
    }
    
    // Direct request to LocalStack SQS endpoint with URL query parameters
    const params = new URLSearchParams({
      'Action': 'SendMessage',
      'Version': '2012-11-05',
      'QueueUrl': state.selectedQueue,
      'MessageBody': messageBody
    });
    
    // Add FIFO parameters if needed
    if (queueName.endsWith('.fifo')) {
      params.append('MessageGroupId', 'default');
      params.append('MessageDeduplicationId', Date.now().toString());
    }
    
    const url = `http://localhost:4566/?${params.toString()}`;
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
    }
    
    // Handle XML response
    const xmlText = await response.text();
    console.log('Raw response:', xmlText);
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check if there's a MessageId in the response
    const messageIdElements = xmlDoc.getElementsByTagName('MessageId');
    const messageId = messageIdElements.length > 0 ? messageIdElements[0].textContent : 'Unknown';
    
    console.log('Message sent successfully with ID:', messageId);
    
    // Show success notification
    showNotification('Message sent successfully!', 'success');
    
    // Clear message body
    document.getElementById('messageBody').value = '';
    state.messageBody = '';
    
    // Refresh messages
    await fetchMessages();
    
    // Also refresh queues to update message count
    // This is important to keep UI consistent
    try {
      // Safely check if these functions exist before calling
      if (window.fetchQueues && typeof window.fetchQueues === 'function') {
        if (state.showAllRegions && window.fetchQueuesFromAllRegions && 
            typeof window.fetchQueuesFromAllRegions === 'function') {
          window.fetchQueuesFromAllRegions();
        } else {
          window.fetchQueues();
        }
      }
    } catch (e) {
      console.log('Unable to refresh queues:', e);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification(`Error sending message: ${error.message}`, 'error');
  } finally {
    state.sendingMessage = false;
  }
}

// Delete a message from the queue - direct LocalStack request
export async function deleteMessage(receiptHandle) {
  if (!state.selectedQueue || !receiptHandle) return;
  
  state.deleteLoading = receiptHandle;
  
  try {
    console.log('Deleting message from queue:', state.selectedQueueName);
    
    // Direct request to LocalStack SQS endpoint with URL query parameters
    const params = new URLSearchParams({
      'Action': 'DeleteMessage',
      'Version': '2012-11-05',
      'QueueUrl': state.selectedQueue,
      'ReceiptHandle': receiptHandle
    });
    
    const url = `http://localhost:4566/?${params.toString()}`;
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
    }
    
    // Handle XML response
    const xmlText = await response.text();
    console.log('Raw response:', xmlText);
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for successful response (look for ResponseMetadata)
    const requestIdElements = xmlDoc.getElementsByTagName('RequestId');
    const success = requestIdElements.length > 0;
    
    console.log('Message deleted successfully:', success);
    
    // Show success notification
    showNotification('Message deleted successfully!', 'success');
    
    // Remove message from list
    state.messages = state.messages.filter(msg => msg.ReceiptHandle !== receiptHandle);
    
    // Re-render messages
    renderMessages();
    
    // Also refresh queues to update message count
    // This is important to keep UI consistent
    try {
      // Safely check if these functions exist before calling
      if (window.fetchQueues && typeof window.fetchQueues === 'function') {
        if (state.showAllRegions && window.fetchQueuesFromAllRegions && 
            typeof window.fetchQueuesFromAllRegions === 'function') {
          window.fetchQueuesFromAllRegions();
        } else {
          window.fetchQueues();
        }
      }
    } catch (e) {
      console.log('Unable to refresh queues:', e);
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    showNotification(`Error deleting message: ${error.message}`, 'error');
  } finally {
    state.deleteLoading = null;
  }
}

// Render the messages in the selected queue
export function renderMessages() {
  const messagesContainer = document.getElementById('messagesContainer');
  if (!messagesContainer) {
    console.error('messagesContainer element not found!');
    return;
  }
  
  console.log('Rendering messages, container found:', messagesContainer);
  
  if (state.messagesLoading) {
    messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';
    return;
  }
  
  // Ensure we have messages
  if (!state.messages || !Array.isArray(state.messages) || state.messages.length === 0) {
    console.log('No messages to display:', state.messages);
    messagesContainer.innerHTML = `
      <div class="empty-messages">
        <p>No messages available in this queue.</p>
        <p>SQS messages may be temporarily invisible after being received. Try again in a few seconds or send a new message.</p>
      </div>
    `;
    return;
  }
  
  // Display how many messages we have
  console.log(`Rendering ${state.messages.length} messages`);
  
  // Debugging: Log the state.messages to see its structure
  console.log('Rendering messages, state.messages:', state.messages);
  
  // Generate HTML for each message
  const messagesHtml = state.messages.map((message, index) => {
    // Debug log each message being rendered
    console.log(`Rendering message ${index}:`, message);
    
    // Check if message has attributes (may not exist for all messages)
    const hasAttributes = message.Attributes && Object.keys(message.Attributes).length > 0;
    
    // Format attributes HTML
    let attributesHtml = '';
    if (hasAttributes) {
      attributesHtml = Object.entries(message.Attributes)
        .filter(([key]) => key !== 'VisibilityTimeout') // Don't show VisibilityTimeout (will be shown separately)
        .map(([key, value]) => `
          <div class="attribute-item">
            <span class="attribute-name">${key}:</span>
            <span class="attribute-value">${value}</span>
          </div>
        `).join('');
    }
    
    // Get visibility timeout if available (may not exist for all messages)
    const visibilityTimeout = message.Attributes?.VisibilityTimeout;
    const formattedVisibilityTimeout = hasAttributes && visibilityTimeout ? 
      formatVisibilityTimeout(visibilityTimeout) : null;
    
    return `
      <div class="message-row">
        <div class="message-header">
          <div>
            <span class="message-number">#${index + 1}</span>
            <span class="message-id">ID: ${message.MessageId}</span>
            ${visibilityTimeout ? `
              <span class="visibility-timeout">
                <svg class="icon" viewBox="0 0 24 24" width="12" height="12">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Visibility: ${formattedVisibilityTimeout}
              </span>
            ` : ''}
          </div>
          <div class="message-actions">
            <button class="delete-button" data-receipt-handle="${message.ReceiptHandle}" ${state.deleteLoading === message.ReceiptHandle ? 'disabled' : ''}>
              ${state.deleteLoading === message.ReceiptHandle ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        <div class="message-body">${formatMessageBody(message.Body || message.DisplayBody || '')}</div>
        ${hasAttributes ? `<div class="message-attributes">${attributesHtml}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // ULTRA SIMPLE APPROACH - Just create a very basic display of messages
  // This ignores all the fancy formatting and just ensures we at least see something
  let simpleHtml = '<div class="simple-messages">';
  
  // Add a header with count
  simpleHtml += `<div class="message-count">Found ${state.messages.length} messages:</div>`;
  
  // Add each message in a simple format
  state.messages.forEach((msg, idx) => {
    simpleHtml += `
      <div class="simple-message" style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 5px;">#${idx + 1} ID: ${msg.MessageId || 'unknown'}</div>
        <pre style="background: #f5f5f5; padding: 8px; overflow: auto; max-height: 150px;">${
          msg.Body || msg.DisplayBody || JSON.stringify(msg, null, 2)
        }</pre>
        <button class="simple-delete" data-receipt="${msg.ReceiptHandle || ''}" 
          style="background: #ff4d4d; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 5px;">
          Delete Message
        </button>
      </div>
    `;
  });
  
  // Close the container
  simpleHtml += '</div>';
  
  // Set the HTML
  messagesContainer.innerHTML = simpleHtml;
  
  // Add click handlers for the delete buttons (with simpler selector)
  document.querySelectorAll('.simple-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const receipt = btn.getAttribute('data-receipt');
      if (receipt) {
        console.log('Deleting message with receipt:', receipt);
        deleteMessage(receipt);
      } else {
        console.error('No receipt handle found for delete button');
      }
    });
  });
  
  // Add debugging button if it doesn't exist yet
  const messagesHeader = document.querySelector('.messages-header, .section-title');
  if (messagesHeader && !document.querySelector('.debug-display-button')) {
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Display';
    debugButton.className = 'debug-display-button';
    debugButton.style.marginLeft = '10px';
    debugButton.style.padding = '2px 8px';
    debugButton.style.backgroundColor = '#4caf50';
    debugButton.style.color = 'white';
    debugButton.style.border = 'none';
    debugButton.style.borderRadius = '4px';
    debugButton.style.cursor = 'pointer';
    debugButton.style.fontSize = '12px';
    
    debugButton.onclick = () => {
      // Force display messages from state directly
      if (state.messages && state.messages.length > 0) {
        const debugHtml = `
          <div class="debug-info">
            <h4>Debug Info - ${state.messages.length} messages in state</h4>
            <pre style="background:#f0f0f0;padding:10px;overflow:auto;max-height:300px;font-size:12px;">
              ${JSON.stringify(state.messages, null, 2)}
            </pre>
          </div>
        `;
        messagesContainer.innerHTML = debugHtml + messagesContainer.innerHTML;
        showNotification(`Found ${state.messages.length} messages in state!`, 'success');
      } else {
        showNotification('No messages found in state', 'error');
      }
    };
    
    messagesHeader.appendChild(debugButton);
  }
}

// Update the renderQueues function to add view messages buttons
export function enhanceRenderQueues(originalRenderQueues) {
  // Return a wrapped version of the original function
  return function enhancedRenderQueues() {
    // Call original function first
    originalRenderQueues();
    
    // Now enhance the queue table with view messages buttons
    const queuesContainer = document.getElementById('queuesContainer');
    
    // If no queues container or no table, return
    if (!queuesContainer || !queuesContainer.querySelector('table')) return;
    
    // Get the table
    const table = queuesContainer.querySelector('table');
    
    // Add "Actions" column to header if not already there
    const headerRow = table.querySelector('thead tr');
    if (!headerRow.querySelector('th:last-child').textContent.includes('Actions')) {
      const actionsHeader = document.createElement('th');
      actionsHeader.textContent = 'Actions';
      headerRow.appendChild(actionsHeader);
    }
    
    // Add "View Messages" button to each row
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
      // Check if row already has an actions cell
      if (!row.querySelector('td:last-child button')) {
        // Get queue URL from state based on index
        // This depends on the current filtered and sorted queue array
        // which is not directly accessible here, so we'll use an attribute
        
        // Create a new cell for actions
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';
        
        // Create view messages button matching web app style
        const viewButton = document.createElement('button');
        viewButton.className = 'button view-messages-button';
        viewButton.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" width="16" height="16">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          View Messages
        `;
        
        // Add data attribute with queue name to use for lookup
        const queueName = row.querySelector('td:first-child').textContent;
        viewButton.dataset.queueName = queueName;
        
        // Add click event listener
        viewButton.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Find the queue with this name in state
          const queue = state.queues.find(q => q.name === queueName);
          if (queue) {
            selectQueue(queue.url);
          }
        });
        
        actionsCell.appendChild(viewButton);
        row.appendChild(actionsCell);
      }
    });
    
    // Finally, if a queue is selected and if we have a detail view open,
    // hide the queue list and show the detail view
    if (state.selectedQueue) {
      const detailView = document.getElementById('queueDetailView');
      const listView = document.getElementById('queueListView');
      
      if (detailView && listView) {
        listView.style.display = 'none';
        detailView.style.display = 'block';
      }
    }
  };
}

// Render pagination for queues
export function renderPagination() {
  const paginationContainer = document.getElementById('paginationContainer');
  if (!paginationContainer) return;
  
  // Filter queues based on search query
  let filteredQueues = state.queues;
  if (state.queueSearchQuery) {
    const query = state.queueSearchQuery.toLowerCase();
    filteredQueues = state.queues.filter(queue => 
      queue.name.toLowerCase().includes(query)
    );
  }
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredQueues.length / state.queuesPerPage);
  
  // Don't show pagination if only one page
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  // Generate pagination HTML
  let paginationHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    paginationHtml += `
      <button class="page-button ${state.currentPage === i ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }
  
  paginationContainer.innerHTML = paginationHtml;
  
  // Add event listeners to page buttons
  document.querySelectorAll('.page-button').forEach(button => {
    button.addEventListener('click', () => {
      state.currentPage = parseInt(button.dataset.page);
      saveState();
      
      // Re-render queues with new page
      window.renderQueues();
      
      // Also update pagination
      renderPagination();
    });
  });
}

// Initialize queue message handlers
export function initQueueMessageHandlers() {
  console.log('Initializing queue message handlers');
  
  // Add diagnostic button to help debug
  setTimeout(() => {
    // Add a diagnostic button to the messages section
    const messagesSection = document.querySelector('.messages-section');
    if (messagesSection) {
      const diagnosticBtn = document.createElement('button');
      diagnosticBtn.textContent = 'Force Refresh Messages';
      diagnosticBtn.style.backgroundColor = '#3498db';
      diagnosticBtn.style.color = 'white';
      diagnosticBtn.style.border = 'none';
      diagnosticBtn.style.padding = '5px 10px';
      diagnosticBtn.style.borderRadius = '4px';
      diagnosticBtn.style.marginLeft = '10px';
      diagnosticBtn.style.cursor = 'pointer';
      
      diagnosticBtn.onclick = async () => {
        if (state.selectedQueue) {
          try {
            await fetchMessages();
          } catch (error) {
            console.error('Error in diagnostic fetch:', error);
          }
        } else {
          alert('No queue selected! Please select a queue first.');
        }
      };
      
      const sectionTitle = messagesSection.querySelector('.section-title');
      if (sectionTitle) {
        sectionTitle.appendChild(diagnosticBtn);
      }
    }
  }, 1000); // Give the DOM time to load
  
  // Back to queues button
  const backBtn = document.getElementById('backToQueues');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      state.selectedQueue = null;
      saveState();
      
      // Show queue list, hide detail view
      document.getElementById('queueListView').style.display = 'block';
      document.getElementById('queueDetailView').style.display = 'none';
    });
  }
  
  // Refresh messages button
  const refreshBtn = document.getElementById('refreshMessages');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchMessages();
    });
  }
  
  // Send message form
  const sendForm = document.getElementById('sendMessageForm');
  if (sendForm) {
    sendForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const messageBody = document.getElementById('messageBody').value;
      if (!messageBody.trim()) return;
      
      sendMessage(messageBody);
    });
  }
  
  // Message body input
  document.getElementById('messageBody').addEventListener('input', (e) => {
    state.messageBody = e.target.value;
    saveState();
  });
}

// Debug function to test message fetching
async function debugFetchMessages() {
  console.log('🔍 DEBUG: Testing message fetch...');
  
  try {
    if (!state.selectedQueue) {
      console.error('No queue selected!');
      showNotification('No queue selected!', 'error');
      return;
    }
    
    // Show a notification that we're testing
    showNotification('Testing message fetch...', 'info');
    
    // Try a direct approach using the AWS CLI format
    const params = new URLSearchParams();
    params.append('Action', 'ReceiveMessage');
    params.append('Version', '2012-11-05');
    params.append('QueueUrl', state.selectedQueue);
    params.append('MaxNumberOfMessages', '10');
    
    // Alternative format to try
    const url = `http://localhost:4566/?${params.toString()}`;
    console.log('DEBUG: Making request to:', url);
    
    const response = await fetch(url, { method: 'GET' });
    
    if (!response.ok) {
      console.error('HTTP error:', response.status);
      showNotification(`Error: HTTP ${response.status}`, 'error');
      return;
    }
    
    const responseText = await response.text();
    console.log('DEBUG: Raw response:', responseText);
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, 'text/xml');
    
    // Simple check for messages
    const messages = xmlDoc.getElementsByTagName('Message');
    console.log(`DEBUG: Found ${messages.length} messages directly`);
    
    // Check response structure
    const metadata = xmlDoc.getElementsByTagName('ResponseMetadata');
    const requestId = metadata.length > 0 ? 
      metadata[0].getElementsByTagName('RequestId')[0]?.textContent : 'None';
    console.log('DEBUG: Request ID:', requestId);
    
    // Display results in notification
    if (messages.length > 0) {
      showNotification(`Found ${messages.length} messages!`, 'success');
      
      // Extract minimal message info for display
      const messageInfo = [];
      for (let i = 0; i < messages.length; i++) {
        const msgElement = messages[i];
        const msgId = msgElement.getElementsByTagName('MessageId')[0]?.textContent || 'unknown';
        const body = msgElement.getElementsByTagName('Body')[0]?.textContent || 'empty';
        messageInfo.push({ id: msgId, body: body.substring(0, 20) + '...' });
      }
      console.log('Message details:', messageInfo);
    } else {
      // Try to send a test message
      showNotification('No messages found, sending test message...', 'info');
      
      // Attempt to send a test message
      const sendParams = new URLSearchParams();
      sendParams.append('Action', 'SendMessage');
      sendParams.append('Version', '2012-11-05');
      sendParams.append('QueueUrl', state.selectedQueue);
      sendParams.append('MessageBody', JSON.stringify({debug: 'test message', timestamp: new Date().toISOString()}));
      
      // Add FIFO parameters if needed
      if (state.selectedQueueName.endsWith('.fifo')) {
        sendParams.append('MessageGroupId', 'debug');
        sendParams.append('MessageDeduplicationId', Date.now().toString());
      }
      
      const sendUrl = `http://localhost:4566/?${sendParams.toString()}`;
      const sendResponse = await fetch(sendUrl, { method: 'GET' });
      
      if (sendResponse.ok) {
        showNotification('Test message sent! Try refreshing now.', 'success');
      } else {
        showNotification('Failed to send test message.', 'error');
      }
    }
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    showNotification(`Debug error: ${error.message}`, 'error');
  }
}

// Initialize on document load
export function initQueueMessages(renderQueues) {
  // Add debug button
  setTimeout(() => {
    const messagesHeader = document.querySelector('.messages-header');
    if (messagesHeader) {
      const debugButton = document.createElement('button');
      debugButton.textContent = 'Debug SQS';
      debugButton.className = 'debug-button';
      debugButton.style.marginLeft = '10px';
      debugButton.style.padding = '2px 8px';
      debugButton.style.backgroundColor = '#ffbb33';
      debugButton.style.border = 'none';
      debugButton.style.borderRadius = '4px';
      debugButton.style.cursor = 'pointer';
      debugButton.style.color = 'black';
      debugButton.onclick = debugFetchMessages;
      messagesHeader.appendChild(debugButton);
    }
  }, 1000); // Slight delay to ensure the header exists

  // Enhanced version of renderQueues that adds actions column
  const enhancedRenderQueues = enhanceRenderQueues(renderQueues);
  
  // Replace original function with enhanced version
  window.renderQueues = enhancedRenderQueues;
  
  // Initialize message handlers
  initQueueMessageHandlers();
  
  // Initialize message body from state if available
  if (state.messageBody) {
    document.getElementById('messageBody').value = state.messageBody;
  }
  
  // Check if a queue was previously selected
  if (state.selectedQueue) {
    selectQueue(state.selectedQueue);
  }
}
