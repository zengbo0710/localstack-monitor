// Debug helper for LocalStack connections
document.addEventListener('DOMContentLoaded', () => {
  const resultsEl = document.getElementById('results');
  const localstackEndpointEl = document.getElementById('localstack-endpoint');
  const nextjsEndpointEl = document.getElementById('nextjs-endpoint');
  
  // Test buttons
  document.getElementById('test-direct').addEventListener('click', testDirectConnection);
  document.getElementById('test-proxy').addEventListener('click', testProxyConnection);
  document.getElementById('test-health').addEventListener('click', testHealthStatus);
  document.getElementById('clear-log').addEventListener('click', clearLog);

  // Clear log function
  function clearLog() {
    resultsEl.innerHTML = '';
    log('Log cleared', 'info');
  }
  
  // Logging function with timestamps
  function log(message, type = 'normal', data = null) {
    const timestamp = new Date().toISOString().slice(11, 19);
    let logEntry = `[${timestamp}] `;
    
    if (type === 'error') {
      logEntry += `<span class="error">ERROR: ${message}</span>`;
    } else if (type === 'success') {
      logEntry += `<span class="success">SUCCESS: ${message}</span>`;
    } else if (type === 'info') {
      logEntry += `<span class="info">INFO: ${message}</span>`;
    } else {
      logEntry += message;
    }
    
    if (data) {
      if (typeof data === 'object') {
        try {
          logEntry += '\n' + JSON.stringify(data, null, 2);
        } catch (e) {
          logEntry += '\n[Circular object]';
        }
      } else {
        logEntry += '\n' + data;
      }
    }
    
    resultsEl.innerHTML += logEntry + '\n\n';
    resultsEl.scrollTop = resultsEl.scrollHeight;
  }
  
  // Test direct connection to LocalStack
  async function testDirectConnection() {
    const endpoint = localstackEndpointEl.value.trim();
    log(`Testing direct connection to ${endpoint}/_localstack/health...`, 'info');
    
    try {
      // Try with a simple no-cors fetch first (this will likely fail due to CORS)
      try {
        log('Attempt 1: Simple fetch');
        const response = await fetch(`${endpoint}/_localstack/health`);
        const data = await response.json();
        log('Direct connection successful!', 'success', data);
      } catch (error) {
        log(`Simple fetch failed: ${error.message}`, 'error');
        
        // Try with mode: 'no-cors' (this won't give us the response data but can test connection)
        log('Attempt 2: Fetch with no-cors mode');
        const noCorsResponse = await fetch(`${endpoint}/_localstack/health`, {
          mode: 'no-cors'
        });
        log(`no-cors response type: ${noCorsResponse.type}`, 'info');
        
        // Try with specific headers
        log('Attempt 3: Fetch with specific headers');
        const headersResponse = await fetch(`${endpoint}/_localstack/health`, {
          headers: {
            'Accept': 'application/json',
            'Origin': chrome.runtime.getURL('')
          }
        });
        
        if (headersResponse.ok) {
          const data = await headersResponse.json();
          log('Direct connection with headers successful!', 'success', data);
        } else {
          log(`Headers fetch failed with status: ${headersResponse.status}`, 'error');
        }
      }
    } catch (error) {
      log(`All connection attempts failed: ${error.message}`, 'error');
      log('This is likely a CORS error. Check browser console for more details.', 'info');
      log('Next step: Try the proxy connection test instead', 'info');
    }
  }
  
  // Test connection via Next.js proxy
  async function testProxyConnection() {
    const localstackEndpoint = localstackEndpointEl.value.trim();
    const nextjsEndpoint = nextjsEndpointEl.value.trim();
    const proxyUrl = `${nextjsEndpoint}/api/extension-proxy`;
    
    log(`Testing connection via Next.js proxy at ${proxyUrl}...`, 'info');
    log(`Target LocalStack endpoint: ${localstackEndpoint}`, 'info');
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: `${localstackEndpoint}/_localstack/health`,
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        })
      });
      
      // Log full response details
      log(`Response status: ${response.status}`, response.ok ? 'success' : 'error');
      
      // Get response headers
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      log('Response headers:', 'info', headers);
      
      // Get response body
      if (response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        
        if (contentType.includes('application/json')) {
          const data = await response.json();
          log('Proxy connection successful!', 'success', data);
        } else {
          const text = await response.text();
          log('Proxy connection returned non-JSON response:', 'info', text);
        }
      } else {
        log(`Proxy connection failed with status: ${response.status}`, 'error');
        try {
          const errorText = await response.text();
          log('Error details:', 'error', errorText);
        } catch (e) {
          log('Could not read error details', 'error');
        }
      }
    } catch (error) {
      log(`Proxy connection error: ${error.message}`, 'error');
      log('Check if your Next.js server is running at: ' + nextjsEndpoint, 'info');
      log('Also verify that /api/extension-proxy endpoint is correctly implemented', 'info');
    }
  }
  
  // Test health status via the optimal method (direct or proxy)
  async function testHealthStatus() {
    const localstackEndpoint = localstackEndpointEl.value.trim();
    const nextjsEndpoint = nextjsEndpointEl.value.trim();
    const proxyUrl = `${nextjsEndpoint}/api/extension-proxy`;
    
    log('Fetching LocalStack health status...', 'info');
    
    // Try proxy first since it's more likely to work with CORS
    try {
      log('Attempting to fetch via proxy...', 'info');
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: `${localstackEndpoint}/_localstack/health`,
          method: 'GET'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Extract and display service information
        const services = data.services || {};
        const servicesList = Object.entries(services).map(([name, info]) => {
          const status = info.status === 'available' || info.running ? 'available' : 'unavailable';
          return `${name}: ${status}`;
        });
        
        log('Health Status:', 'success');
        log(`LocalStack version: ${data.version || 'unknown'}`, 'info');
        log(`Available services:`, 'info', servicesList.join('\n'));
        return;
      } else {
        log(`Proxy request failed with status: ${response.status}`, 'error');
      }
    } catch (error) {
      log(`Proxy attempt failed: ${error.message}`, 'error');
    }
    
    // Try direct connection as fallback
    try {
      log('Falling back to direct connection...', 'info');
      const response = await fetch(`${localstackEndpoint}/_localstack/health`);
      
      if (response.ok) {
        const data = await response.json();
        log('Direct connection successful!', 'success', data);
      } else {
        log(`Direct connection failed with status: ${response.status}`, 'error');
      }
    } catch (error) {
      log(`Direct connection failed: ${error.message}`, 'error');
      log('Both proxy and direct connection methods failed.', 'error');
      log('Suggestions:', 'info');
      log('1. Make sure LocalStack is running at: ' + localstackEndpoint, 'info');
      log('2. Make sure Next.js app is running at: ' + nextjsEndpoint, 'info');
      log('3. Check if CORS is enabled on LocalStack', 'info');
    }
  }
  
  // Initial log message
  log('LocalStack Connection Debugger Ready!', 'info');
  log(`Next.js endpoint: ${nextjsEndpointEl.value}`, 'info');
  log(`LocalStack endpoint: ${localstackEndpointEl.value}`, 'info');
  log('Click one of the test buttons above to begin debugging', 'info');
});
