// Background script for LocalStack Monitor extension

// Constants
const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const ALARM_NAME = 'localstack-health-check';

// Initialize background script
chrome.runtime.onInstalled.addListener(() => {
  console.log('LocalStack Monitor extension installed');
  
  // Set default settings
  chrome.storage.local.get('localstackEndpoint', (result) => {
    if (!result.localstackEndpoint) {
      chrome.storage.local.set({ 'localstackEndpoint': LOCALSTACK_ENDPOINT });
    }
  });
  
  // Set up health check alarm (every 5 minutes)
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  
  // Run initial connection test
  testConnection();
});

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkHealthStatus();
  }
});

// Check LocalStack health status
function checkHealthStatus() {
  try {
    chrome.storage.local.get('localstackEndpoint', (result) => {
      const endpoint = result.localstackEndpoint || LOCALSTACK_ENDPOINT;
      
      fetch(`${endpoint}/_localstack/health`)
        .then(response => {
          if (!response.ok) {
            updateBadge('!', '#E11D48'); // Red badge for error
            return Promise.reject('Failed to fetch health status');
          }
          return response.json();
        })
        .then(data => {
          const services = Object.values(data.services || {});
          
          // Count available services
          const availableServices = services.filter(
            service => service.status === 'available' || service.running
          ).length;
          
          // Update badge with count of available services
          if (availableServices === 0) {
            updateBadge('!', '#E11D48'); // Red badge for no services
          } else {
            updateBadge(availableServices.toString(), '#10B981'); // Green badge with count
          }
        })
        .catch(error => {
          console.error('Error checking health status:', error);
          updateBadge('!', '#E11D48'); // Red badge for error
        });
    });
  } catch (error) {
    console.error('Error in checkHealthStatus:', error);
    updateBadge('!', '#E11D48'); // Red badge for error
  }
}

// Update extension badge
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Test connection to LocalStack
function testConnection() {
  console.log('Running LocalStack connection test...');

  // Test different endpoint variations
  const endpoints = [
    'http://localhost:4566',
    'http://127.0.0.1:4566'
  ];

  // Test each endpoint
  endpoints.forEach(endpoint => {
    console.log(`Testing connection to ${endpoint}/_localstack/health...`);
    
    fetch(`${endpoint}/_localstack/health`)
      .then(response => {
        if (!response.ok) {
          console.error(`❌ Connection failed with status: ${response.status}`);
          return Promise.reject(`Failed with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Connection successful!', data);
        // Set badge to green with number of available services
        const availableServices = Object.values(data.services || {})
          .filter(svc => svc.status === 'available' || svc.running).length;
        
        updateBadge(availableServices.toString(), '#10B981');
      })
      .catch(error => {
        console.error(`❌ Connection error to ${endpoint}:`, error);
      });
  });
}

// Proxy service for making requests to LocalStack
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxy-request') {
    makeProxyRequest(request.options)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

// Make the actual request to LocalStack
async function makeProxyRequest(options) {
  console.log('Proxy making request:', options);
  
  try {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    
    // Only add body for POST, PUT, etc.
    if (options.body && options.method !== 'GET' && options.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(options.url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    console.error('Proxy request error:', error);
    throw error;
  }
}