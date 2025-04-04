// Simple script to test direct connections to LocalStack

document.getElementById('testLocalhost').addEventListener('click', () => {
  testConnection('http://localhost:4566');
});

document.getElementById('test127').addEventListener('click', () => {
  testConnection('http://127.0.0.1:4566');
});

async function testConnection(endpoint) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `Testing connection to ${endpoint}/_localstack/health...`;

  try {
    // First try direct fetch (most likely to fail due to CORS)
    resultDiv.innerHTML += '<br>Method 1: Direct fetch...';
    
    try {
      const directResponse = await fetch(`${endpoint}/_localstack/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const directData = await directResponse.json();
      resultDiv.innerHTML += '<br>✅ Direct fetch successful: ' + JSON.stringify(directData).substring(0, 100) + '...';
    } catch (directError) {
      resultDiv.innerHTML += '<br>❌ Direct fetch failed: ' + directError.message;
    }
    
    // Try through extension messaging (background script proxy)
    resultDiv.innerHTML += '<br>Method 2: Via background proxy...';
    
    chrome.runtime.sendMessage({
      action: 'proxy-request',
      options: {
        url: `${endpoint}/_localstack/health`,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    }, response => {
      if (response && response.success) {
        resultDiv.innerHTML += '<br>✅ Proxy successful: ' + JSON.stringify(response.data).substring(0, 100) + '...';
      } else {
        resultDiv.innerHTML += '<br>❌ Proxy failed: ' + (response ? response.error : 'Unknown error');
      }
    });
    
    // Check extension permissions
    resultDiv.innerHTML += '<br>Method 3: Checking permissions...';
    
    chrome.permissions.contains({
      origins: [`${endpoint}/*`]
    }, result => {
      if (result) {
        resultDiv.innerHTML += '<br>✅ Extension has permission for ' + endpoint;
      } else {
        resultDiv.innerHTML += '<br>❌ Extension lacks permission for ' + endpoint;
      }
    });
    
  } catch (error) {
    resultDiv.innerHTML += '<br>Error during tests: ' + error.message;
  }
}
