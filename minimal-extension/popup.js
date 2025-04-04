// LocalStack Monitor Lite - popup script
document.addEventListener('DOMContentLoaded', function() {
  // Default endpoint
  let localstackEndpoint = 'http://localhost:4566';
  
  // Load saved endpoint if available
  chrome.storage.local.get('endpoint', function(data) {
    if (data.endpoint) {
      localstackEndpoint = data.endpoint;
      document.getElementById('endpoint').value = localstackEndpoint;
    } else {
      document.getElementById('endpoint').value = localstackEndpoint;
    }
    
    // Load data automatically when popup opens
    fetchAllData();
  });
  
  // Tab navigation
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      document.querySelector('.tab.active').classList.remove('active');
      tab.classList.add('active');
      
      // Show corresponding content
      document.querySelector('.tab-content.active').classList.remove('active');
      document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
    });
  });
  
  // Refresh button
  document.getElementById('refresh').addEventListener('click', fetchAllData);
  
  // Save settings
  document.getElementById('saveSettings').addEventListener('click', function() {
    const endpoint = document.getElementById('endpoint').value.trim();
    if (endpoint) {
      localstackEndpoint = endpoint;
      chrome.storage.local.set({endpoint: endpoint}, function() {
        console.log('Endpoint saved:', endpoint);
        fetchAllData();
      });
    }
  });
  
  // Fetch all data
  function fetchAllData() {
    fetchHealthStatus();
    fetchS3Buckets();
    fetchSQSQueues();
  }
  
  // Fetch health status
  function fetchHealthStatus() {
    const servicesList = document.getElementById('servicesList');
    servicesList.innerHTML = '<div class="message">Loading health status...</div>';
    
    fetch(`${localstackEndpoint}/_localstack/health`)
      .then(response => {
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!data.services || Object.keys(data.services).length === 0) {
          servicesList.innerHTML = '<div class="message">No services found.</div>';
          return;
        }
        
        let html = '';
        Object.entries(data.services).forEach(([name, info]) => {
          const isAvailable = info.status === 'available' || info.running;
          const statusClass = isAvailable ? 'status-available' : 'status-unavailable';
          const status = isAvailable ? '✓ Available' : '✗ Unavailable';
          
          html += `
            <div class="service">
              <div>${name}</div>
              <div class="${statusClass}">${status}</div>
            </div>
          `;
        });
        
        servicesList.innerHTML = html;
      })
      .catch(error => {
        servicesList.innerHTML = `<div class="message">Error loading health status: ${error.message}</div>`;
        console.error('Health fetch error:', error);
      });
  }
  
  // Fetch S3 buckets
  function fetchS3Buckets() {
    const bucketsList = document.getElementById('bucketsList');
    bucketsList.innerHTML = '<div class="message">Loading buckets...</div>';
    
    // Using direct URL for S3 listing to avoid AWS SDK dependency
    fetch(`${localstackEndpoint}`)
      .then(response => {
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return response.text();
      })
      .then(xmlText => {
        // Simple XML parsing for buckets
        const bucketNames = [];
        const regex = /<Name>(.*?)<\/Name>/g;
        let match;
        while ((match = regex.exec(xmlText)) !== null) {
          bucketNames.push(match[1]);
        }
        
        if (bucketNames.length === 0) {
          bucketsList.innerHTML = '<div class="message">No buckets found.</div>';
          return;
        }
        
        let html = '';
        bucketNames.forEach(name => {
          html += `
            <div class="service">
              <div>${name}</div>
            </div>
          `;
        });
        
        bucketsList.innerHTML = html;
      })
      .catch(error => {
        bucketsList.innerHTML = `<div class="message">Error loading buckets: ${error.message}</div>`;
        console.error('S3 fetch error:', error);
      });
  }
  
  // Fetch SQS queues
  function fetchSQSQueues() {
    const queuesList = document.getElementById('queuesList');
    queuesList.innerHTML = '<div class="message">Loading queues...</div>';
    
    // Using a simplified approach for SQS
    fetch(`${localstackEndpoint}/?Action=ListQueues&Version=2012-11-05`)
      .then(response => {
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return response.text();
      })
      .then(xmlText => {
        // Simple XML parsing for queues
        const queueUrls = [];
        const regex = /<QueueUrl>(.*?)<\/QueueUrl>/g;
        let match;
        while ((match = regex.exec(xmlText)) !== null) {
          queueUrls.push(match[1]);
        }
        
        if (queueUrls.length === 0) {
          queuesList.innerHTML = '<div class="message">No queues found.</div>';
          return;
        }
        
        let html = '';
        queueUrls.forEach(url => {
          const name = url.split('/').pop();
          html += `
            <div class="service">
              <div>${name}</div>
            </div>
          `;
        });
        
        queuesList.innerHTML = html;
      })
      .catch(error => {
        queuesList.innerHTML = `<div class="message">Error loading queues: ${error.message}</div>`;
        console.error('SQS fetch error:', error);
      });
  }
});
