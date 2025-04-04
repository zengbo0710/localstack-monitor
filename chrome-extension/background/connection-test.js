// Simple test script to verify LocalStack connection
// This will run when the extension is loaded

console.log('Running LocalStack connection test...');

// Test different endpoint variations
const endpoints = [
  'http://localhost:4566',
  'http://127.0.0.1:4566'
];

// Test health endpoint
async function testConnection() {
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing connection to ${endpoint}/_localstack/health...`);
      
      const response = await fetch(`${endpoint}/_localstack/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Connection successful!', data);
        // Set badge to green with number of available services
        const availableServices = Object.values(data.services || {})
          .filter(svc => svc.status === 'available' || svc.running).length;
        
        chrome.action.setBadgeText({ text: availableServices.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        
        return true;
      } else {
        console.error(`❌ Connection failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Connection error to ${endpoint}:`, error);
    }
  }
  
  // If we get here, all connection attempts failed
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#E11D48' });
  return false;
}

// Run test immediately and then every 30 seconds
testConnection();
setInterval(testConnection, 30000);
