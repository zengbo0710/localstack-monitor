// Import required functions from object handlers
import { showObjectListView, showBucketListView, fetchBucketObjects, renderBucketObjects, handleFileUpload } from './popup-object-handlers.js';

// Import queue message management functionality
import { initQueueMessages, renderPagination } from './queue-messages.js';

// Global state
export let state = {
  activeTab: 'health',
  healthData: null,
  healthLastUpdated: null,
  // Health monitoring specific state
  monitoredServices: [], // Services that are being monitored
  availableServices: [], // All available services
  defaultMonitoredServices: ['SQS', 'S3', 'DynamoDB', 'Lambda', 'EventBridge', 'SSM', 'Firehose'], // Default services to monitor
  allAvailableServices: ['SQS', 'S3', 'DynamoDB', 'Lambda', 'SNS', 'CloudWatch', 'API Gateway', 'Step Functions', 'ElasticSearch', 'Kinesis', 'SES', 'IAM', 'EC2', 'SSM', 'EventBridge', 'RDS', 'Firehose'], // All services that could be monitored
  refreshingServices: {}, // Track which services are currently refreshing
  showSettings: false, // Whether to show the settings panel
  settingsLoading: false, // Loading state for updating settings
  
  buckets: [],
  bucketSearchQuery: '',
  bucketSortField: 'name',
  bucketSortOrder: 'asc',
  bucketLastUpdated: null,
  queues: [],
  queueSearchQuery: '',
  queueSortField: 'messageCount', // Change default sort field to messageCount
  queueSortOrder: 'desc', // Change default sort order to descending
  queueLastUpdated: null,
  queueRegion: 'ap-southeast-1',
  showAllRegions: false, // Default to single region mode
  selectedQueue: null, // Selected queue for viewing messages
  messages: [], // Messages in the selected queue
  messagesLoading: false, // Loading state for messages
  messageBody: '', // Message body for sending new messages
  sendingMessage: false, // Loading state for sending messages
  deleteLoading: null, // Loading state for deleting messages (stores receipt handle)
  currentPage: 1, // Current page for pagination
  queuesPerPage: 10, // Number of queues per page
  autoRefreshInterval: null,
  autoRefreshTime: null,
  // Object listing related state
  currentBucket: null,
  bucketObjects: [],
  objectSearchQuery: '',
  objectSortField: 'Key',
  objectSortOrder: 'asc',
  objectLastUpdated: null,
  viewMode: 'bucketList' // 'bucketList' or 'objectList'
};

// LocalStack endpoint
export const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
document.getElementById('endpointUrl').textContent = LOCALSTACK_ENDPOINT;

/**
 * Show a toast notification
 * @param {string} message - Message to display in the toast
 * @param {string} [type='success'] - Type of toast (success, error, info)
 * @param {number} [duration=3000] - Duration in milliseconds
 */
function showToast(message, type = 'success', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}-toast`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300); // Wait for fade out animation
  }, duration);
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tab navigation
  initTabs();
  
  // Initialize event listeners
  initEventListeners();
  
  // Initialize queue message functionality
  initQueueMessages(renderQueues);
  
  // Load state from Chrome storage
  chrome.storage.local.get('localstackMonitorState', (result) => {
    if (result.localstackMonitorState) {
      // Merge saved state with default state
      state = { ...state, ...result.localstackMonitorState };
      
      // Apply saved state to UI
      document.getElementById('bucketSearch').value = state.bucketSearchQuery;
      document.getElementById('queueSearch').value = state.queueSearchQuery;
      document.getElementById('autoRefreshSelect').value = state.autoRefreshTime || '';
      
      // Set the region dropdown to the saved region
      if (state.queueRegion) {
        document.getElementById('queueRegionSelect').value = state.queueRegion;
      }
      
      // Set the show all regions checkbox state
      if (state.showAllRegions !== undefined) {
        document.getElementById('showAllRegions').checked = state.showAllRegions;
        // Also disable the region selector if showing all regions
        document.getElementById('queueRegionSelect').disabled = state.showAllRegions;
      }
      
      // Check if we should be in object list view
      if (state.viewMode === 'objectList' && state.currentBucket) {
        // Need to delay this to ensure the DOM is ready
        setTimeout(() => {
          document.getElementById('bucketListView').classList.add('hidden');
          document.getElementById('bucketObjectsView').classList.remove('hidden');
          document.getElementById('currentBucketName').textContent = state.currentBucket;
        }, 100);
      }
      
      // Initialize monitoring preferences if needed
      if (!state.monitoredServices || state.monitoredServices.length === 0) {
        initializeMonitoringPreferences();
      }
      
      // Set active tab
      setActiveTab(state.activeTab);
      
      // Resume auto-refresh if it was active
      if (state.autoRefreshTime) {
        startAutoRefresh(state.autoRefreshTime);
      }
    } else {
      // Initialize monitoring preferences with defaults
      initializeMonitoringPreferences();
      // Initialize data loading if no saved state
      loadTabData(state.activeTab);
    }
  });
});

// Tab initialization
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      setActiveTab(tabName);
    });
  });
}

// Set active tab
function setActiveTab(tabName) {
  // Update state
  state.activeTab = tabName;
  saveState();
  
  // Update UI
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    if (button.dataset.tab === tabName) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    if (content.id === `${tabName}Tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Load data for the active tab if not already loaded
  loadTabData(tabName);
}

// Initialize event listeners
function initEventListeners() {
  // Refresh buttons
  document.getElementById('refreshHealth').addEventListener('click', () => refreshData('health'));
  document.getElementById('refreshS3').addEventListener('click', () => refreshData('s3'));
  document.getElementById('refreshSQS').addEventListener('click', () => refreshData('sqs'));
  document.getElementById('refreshObjects')?.addEventListener('click', () => refreshBucketObjects());
  
  // Add back button listener for bucket objects view
  document.getElementById('backToBuckets')?.addEventListener('click', () => {
    showBucketListView();
  });
  
  // Add file upload button listener
  document.getElementById('uploadButton')?.addEventListener('click', () => {
    document.getElementById('fileUpload').click();
  });
  
  // Add file input change listener
  document.getElementById('fileUpload')?.addEventListener('change', () => {
    handleFileUpload();
  });
  
  // Add listener for the refreshBuckets custom event
  document.addEventListener('refreshBuckets', () => {
    console.log('Received refreshBuckets event, fetching buckets');
    fetchBuckets();
  });
  
  // Search inputs
  document.getElementById('bucketSearch').addEventListener('input', (e) => {
    state.bucketSearchQuery = e.target.value;
    // Only call render and save if we haven't already in the success case above
    if (!state.bucketLastUpdated || state.bucketLastUpdated < Date.now() - 1000) {
      renderBuckets();
      saveState();
    }
  });
  
  document.getElementById('queueSearch').addEventListener('input', (e) => {
    state.queueSearchQuery = e.target.value;
    renderQueues();
    saveState();
  });
  
  // Region selector for SQS queues
  document.getElementById('queueRegionSelect').addEventListener('change', (e) => {
    state.queueRegion = e.target.value;
    console.log(`Queue region changed to: ${state.queueRegion}`);
    saveState();
    // Only refresh if we're not showing all regions
    if (!state.showAllRegions) {
      fetchQueues();
    }
  });
  
  // All regions toggle
  document.getElementById('showAllRegions').addEventListener('change', (e) => {
    state.showAllRegions = e.target.checked;
    console.log(`Show all regions toggle changed to: ${state.showAllRegions}`);
    
    // IMPORTANT: Save state immediately
    saveState();
    
    // Update the region selector disabled state
    document.getElementById('queueRegionSelect').disabled = state.showAllRegions;
    
    // Refresh the queue data based on the toggle state
    if (state.showAllRegions) {
      console.log('Toggled ON - Fetching queues from all regions');
      // Force clear previous queue data to ensure fresh load
      state.queues = [];
      state.queueLastUpdated = null;
      fetchQueuesFromAllRegions();
    } else {
      console.log('Toggled OFF - Fetching queues from single region:', state.queueRegion);
      // Force clear previous queue data to ensure fresh load
      state.queues = [];
      state.queueLastUpdated = null;
      fetchQueues();
    }
  });
  
  document.getElementById('objectSearch')?.addEventListener('input', (e) => {
    state.objectSearchQuery = e.target.value;
    renderBucketObjects();
    saveState();
  });
  
  // Auto-refresh select
  document.getElementById('autoRefreshSelect').addEventListener('change', (e) => {
    const seconds = e.target.value;
    state.autoRefreshTime = seconds;
    saveState();
    
    if (seconds) {
      startAutoRefresh(seconds);
    } else {
      stopAutoRefresh();
    }
  });
  
}

// Load data for the active tab
function loadTabData(tabName) {
  switch (tabName) {
    case 'health':
      if (!state.healthData || isDataStale(state.healthLastUpdated)) {
        fetchHealthStatus();
      } else {
        renderHealthStatus();
      }
      break;
    case 's3':
      if (state.viewMode === 'objectList' && state.currentBucket) {
        // If we're in object list view, load objects
        if (state.bucketObjects.length === 0 || isDataStale(state.objectLastUpdated)) {
          fetchBucketObjects(state.currentBucket);
        } else {
          renderBucketObjects();
        }
      } else {
        // Otherwise load buckets
        if (state.buckets.length === 0 || isDataStale(state.bucketLastUpdated)) {
          fetchBuckets();
        } else {
          renderBuckets();
        }
      }
      break;
    case 'sqs':
      console.log('Loading SQS tab data, showAllRegions:', state.showAllRegions);
      
      // ALWAYS set the checkbox and region dropdown to match saved state
      const showAllRegionsCheckbox = document.getElementById('showAllRegions');
      showAllRegionsCheckbox.checked = state.showAllRegions;
      document.getElementById('queueRegionSelect').disabled = state.showAllRegions;
      
      if (state.queues.length === 0 || isDataStale(state.queueLastUpdated)) {
        // Use the appropriate fetch method based on the toggle state
        if (state.showAllRegions) {
          console.log('Fetching queues from all regions...');
          fetchQueuesFromAllRegions();
        } else {
          console.log('Fetching queues from single region:', state.queueRegion);
          fetchQueues();
        }
      } else {
        renderQueues();
      }
      break;
  }
}

// Check if data is stale (older than 5 minutes)
function isDataStale(timestamp) {
  if (!timestamp) return true;
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - timestamp > fiveMinutes;
}

// Refresh data for the specified tab
function refreshData(tabName) {
  switch (tabName) {
    case 'health':
      fetchHealthStatus();
      break;
    case 's3':
      if (state.viewMode === 'objectList' && state.currentBucket) {
        fetchBucketObjects(state.currentBucket);
      } else {
        fetchBuckets();
      }
      break;
    case 'sqs':
      fetchQueues();
      break;
  }
}

// Auto-refresh functions
function startAutoRefresh(seconds) {
  stopAutoRefresh();
  
  const interval = parseInt(seconds, 10) * 1000;
  state.autoRefreshInterval = setInterval(() => {
    if (state.activeTab === 'sqs') {
      refreshData('sqs');
    }
  }, interval);
}

function stopAutoRefresh() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
  }
}

// Save state to Chrome storage
export function saveState() {
  const stateToSave = {
    activeTab: state.activeTab,
    bucketSearchQuery: state.bucketSearchQuery,
    bucketSortField: state.bucketSortField,
    bucketSortOrder: state.bucketSortOrder,
    queueSearchQuery: state.queueSearchQuery,
    queueSortField: state.queueSortField,
    queueSortOrder: state.queueSortOrder,
    queueRegion: state.queueRegion,
    autoRefreshTime: state.autoRefreshTime,
    // Also save object view state
    currentBucket: state.currentBucket,
    objectSearchQuery: state.objectSearchQuery,
    objectSortField: state.objectSortField,
    objectSortOrder: state.objectSortOrder,
    viewMode: state.viewMode
  };
  
  chrome.storage.local.set({ 'localstackMonitorState': stateToSave });
}

// Direct request to LocalStack
export async function proxyRequest(options) {
  try {
    console.log('Making direct request to:', options.url);
    
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'Accept': 'application/json',
      },
      // Add CORS mode to ensure proper handling
      mode: 'cors'
    };
    
    // Only add Content-Type if not already present in headers
    if (!options.headers || !options.headers['Content-Type']) {
      fetchOptions.headers['Content-Type'] = 'application/json';
    }
    
    // Add body for non-GET methods
    if (options.body && options.method !== 'GET' && options.method !== 'HEAD') {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    
    const response = await fetch(options.url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }
    
    // Parse response based on content type
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType && contentType.includes('application/xml') || 
               contentType && contentType.includes('text/xml')) {
      return await response.text();
    }
    
    // Return text for other responses
    return await response.text();
  } catch (error) {
    console.error('Direct request error:', error);
    throw error;
  }
}

// Helper function to find Attributes property path in an object
function findAttributesInObject(obj, path = '') {
  if (!obj || typeof obj !== 'object') return null;
  
  // Direct match for Attributes object
  if (obj.Attributes && typeof obj.Attributes === 'object') {
    return path ? path + '.Attributes' : 'Attributes';
  }
  
  // Search recursively (limited depth)
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const newPath = path ? `${path}.${key}` : key;
      // Limit recursion to avoid stack overflow
      if (newPath.split('.').length < 5) {
        const result = findAttributesInObject(obj[key], newPath);
        if (result) return result;
      }
    }
  }
  
  return null;
}

// Helper function to extract attributes recursively from an object
function findAttributesRecursively(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  // Check if this object has an Attributes property that looks like queue attributes
  if (obj.Attributes && typeof obj.Attributes === 'object') {
    // Verify this looks like queue attributes
    if (obj.Attributes.QueueArn || 
        obj.Attributes.CreatedTimestamp || 
        obj.Attributes.ApproximateNumberOfMessages !== undefined) {
      return obj.Attributes;
    }
  }
  
  // Look for common attribute property patterns
  if (obj.ApproximateNumberOfMessages !== undefined) {
    return { ApproximateNumberOfMessages: obj.ApproximateNumberOfMessages };
  }
  
  // Search recursively (limited depth)
  let result = null;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      result = findAttributesRecursively(obj[key]);
      if (result) return result;
    }
  }
  
  return null;
}

// Helper function to find a specific value in an object structure
function findValueInObject(obj, key, maxDepth = 5, currentDepth = 0) {
  // Base case: depth limit or null/undefined object
  if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
    return undefined;
  }
  
  // Check if the key exists directly in this object
  if (obj[key] !== undefined) {
    return obj[key];
  }
  
  // Special case for Name/Value pair array (LocalStack format)
  if (Array.isArray(obj) && obj.length > 0 && obj[0].Name !== undefined) {
    for (const item of obj) {
      if (item.Name === key && item.Value !== undefined) {
        return item.Value;
      }
    }
  }
  
  // Recursively search in child objects/arrays
  for (const prop in obj) {
    if (typeof obj[prop] === 'object' && obj[prop] !== null) {
      const result = findValueInObject(obj[prop], key, maxDepth, currentDepth + 1);
      if (result !== undefined) {
        return result;
      }
    }
  }
  
  return undefined;
}

// Helper function to find message count recursively
function findMessageCountRecursively(obj) {
  if (!obj || typeof obj !== 'object') return NaN;
  
  // Check for ApproximateNumberOfMessages at this level
  if (obj.ApproximateNumberOfMessages !== undefined) {
    return parseInt(obj.ApproximateNumberOfMessages, 10);
  }
  
  // Check for Attributes.ApproximateNumberOfMessages at this level
  if (obj.Attributes && obj.Attributes.ApproximateNumberOfMessages !== undefined) {
    return parseInt(obj.Attributes.ApproximateNumberOfMessages, 10);
  }
  
  // Search recursively (limited depth)
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const result = findMessageCountRecursively(obj[key]);
      if (!isNaN(result)) return result;
    }
  }
  
  return NaN;
}

// Fetch health status
/**
 * Initialize monitoring preferences with defaults or from storage
 */
function initializeMonitoringPreferences() {
  console.log('Initializing monitoring preferences');
  console.log('Current monitored services:', state.monitoredServices);
  console.log('Default monitored services:', state.defaultMonitoredServices);
  
  // If we have no monitored services yet, set defaults
  if (!state.monitoredServices || state.monitoredServices.length === 0) {
    console.log('Setting default monitored services');
    state.monitoredServices = [...state.defaultMonitoredServices];
  }
  
  // Make sure all services from allAvailableServices are in availableServices
  // if they aren't already discovered from the API
  if (!state.availableServices || state.availableServices.length === 0) {
    console.log('Setting available services from defaults');
    state.availableServices = [...state.allAvailableServices];
  } else {
    // Add any missing services from allAvailableServices
    const newAvailableServices = new Set([...state.availableServices, ...state.allAvailableServices]);
    state.availableServices = Array.from(newAvailableServices);
  }
  
  console.log('After initialization:');
  console.log('Monitored services:', state.monitoredServices);
  console.log('Available services:', state.availableServices);
  
  // Save to persist the defaults
  saveState();
}

/**
 * Fetch health status from LocalStack
 * @param {string} [specificService] - Service name to refresh specifically
 */
async function fetchHealthStatus(specificService = null) {
  try {
    // If refreshing a specific service, mark it as refreshing
    if (specificService) {
      state.refreshingServices[specificService] = true;
      renderHealthStatus(); // Update UI to show loading state
    } else {
      // Only show loading indicator if refreshing all services
      document.getElementById('healthStatusContainer').innerHTML = `
        <div class="loading-indicator">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <div>Loading health status...</div>
        </div>
      `;
    }
    
    console.log('Fetching health status from:', LOCALSTACK_ENDPOINT);
    
    const data = await proxyRequest({
      url: `${LOCALSTACK_ENDPOINT}/_localstack/health`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Health data:', data);
    
    // Process discovered services for monitoring preferences
    const serviceNames = Object.keys(data.services || {});
    
    // Add any newly discovered services to available services
    const newAvailableServices = new Set([...state.availableServices, ...serviceNames]);
    state.availableServices = Array.from(newAvailableServices);
    
    // Initialize monitored services if needed
    if (!state.monitoredServices || state.monitoredServices.length === 0) {
      initializeMonitoringPreferences();
    }
    
    state.healthData = data;
    state.healthLastUpdated = Date.now();
    
    // Reset refreshing state for the specific service
    if (specificService) {
      state.refreshingServices[specificService] = false;
    }
    
    renderHealthStatus();
    saveState();
  } catch (error) {
    console.error('Health status error:', error);
    
    // Reset refreshing state for the specific service
    if (specificService) {
      state.refreshingServices[specificService] = false;
      renderHealthStatus(); // Update UI to show error state
    } else {
      document.getElementById('healthStatusContainer').innerHTML = `
        <div class="error-message">
          <p>Error connecting to LocalStack health endpoint. Please ensure LocalStack is running.</p>
          <p>${error.message}</p>
        </div>
      `;
      
      // Still initialize monitoring preferences even if health fetch fails
      if (!state.monitoredServices || state.monitoredServices.length === 0) {
        initializeMonitoringPreferences();
      }
    }
  }
}

/**
 * Refresh a specific service's health status
 * @param {string} serviceName - Name of the service to refresh
 */
function refreshServiceHealth(serviceName) {
  console.log(`Refreshing health for service: ${serviceName}`);
  fetchHealthStatus(serviceName);
}

// Helper function to extract service status consistently
function getServiceStatus(info) {
  if (typeof info === 'string') {
    // If info is a string like "running", "available", "disabled"
    return info;
  } else if (info && info.running) {
    return 'running';
  } else if (info && info.status) {
    return info.status;
  }
  return 'unknown';
}

/**
 * Format service name consistently for display
 * @param {string} name - Raw service name
 * @returns {string} - Properly formatted service name for display
 */
function formatServiceName(name) {
  // First, handle special cases like 'S3', 'SQS', etc. that are acronyms
  const specialCases = {
    's3': 'S3',
    'sqs': 'SQS',
    'sns': 'SNS',
    'ssm': 'SSM',
    'ec2': 'EC2',
    'rds': 'RDS',
    'iam': 'IAM',
    'ses': 'SES',
    'dynamodb': 'DynamoDB',
    'lambda': 'Lambda',
    'cloudwatch': 'CloudWatch',
    'eventbridge': 'EventBridge',
    'firehose': 'Firehose',
    'kinesis': 'Kinesis',
    'elasticsearch': 'ElasticSearch',
  };
  
  const lowerName = name.toLowerCase();
  
  // If we have a special case mapping, return it
  if (specialCases[lowerName]) {
    return specialCases[lowerName];
  }
  
  // Otherwise, convert to title case
  // Split by spaces and capitalize each word
  return lowerName.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Helper function to map service status to standardized categories
function mapStatusToCategory(status) {
  const lowerStatus = String(status).toLowerCase();
  
  // Healthy statuses
  if (lowerStatus === 'running' || lowerStatus === 'available' ||
      lowerStatus === 'healthy' || lowerStatus === 'active') {
    return 'healthy';
  }
  
  // Degraded statuses
  if (lowerStatus === 'degraded' || lowerStatus === 'initializing' ||
      lowerStatus === 'starting' || lowerStatus === 'warming') {
    return 'degraded';
  }
  
  // Error statuses
  if (lowerStatus === 'stopped' || lowerStatus === 'error' ||
      lowerStatus === 'unavailable' || lowerStatus === 'disabled' ||
      lowerStatus === 'unknown') {
    return 'error';
  }
  
  // Default to error for any other status
  return 'error';
}

// Get appropriate status icon HTML based on status
function getStatusIconHTML(status) {
  const category = mapStatusToCategory(status);
  
  if (category === 'healthy') {
    return '<svg class="status-icon status-icon-healthy" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else if (category === 'degraded') {
    return '<svg class="status-icon status-icon-degraded" viewBox="0 0 24 24" width="16" height="16"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else {
    return '<svg class="status-icon status-icon-error" viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
}

// Get appropriate class for latency values
function getLatencyClass(latency) {
  if (latency === null || latency === undefined) return '';
  
  if (latency < 200) return 'latency-good';
  if (latency < 500) return 'latency-medium';
  return 'latency-bad';
}

// Render health status - Exact match to web app design
function renderHealthStatus() {
  if (!state.healthData) return;
  
  const servicesContainer = document.getElementById('healthStatusContainer');
  const lastUpdatedElement = document.getElementById('healthLastUpdated');
  
  // Format last updated time
  const lastUpdated = new Date(state.healthLastUpdated).toLocaleString();
  
  // Hide last updated element as we'll show it in the status panel
  lastUpdatedElement.style.display = 'none';
  
  // Get services from health data
  let services = Object.entries(state.healthData.services || {});
  console.log('Services from LocalStack:', services.map(([name, _]) => name));
  console.log('Currently monitored services:', state.monitoredServices);
  
  // Normalize service names from API to lowercase for easier comparison
  const normalizedApiServices = services.map(([name, info]) => {
    return [name.toLowerCase(), info];
  });
  
  // Create a map of existing services (lowercase keys) for easier lookup
  const existingServicesMap = new Map(normalizedApiServices);
  
  // Remove any duplicate entries (different cases of the same service name)
  services = normalizedApiServices;
  
  // Check if any monitored services are missing from the health data
  // If so, create placeholder entries for them
  const missingServices = state.monitoredServices.filter(serviceName => 
    !existingServicesMap.has(serviceName.toLowerCase()));
  
  if (missingServices.length > 0) {
    console.log('Creating placeholders for missing monitored services:', missingServices);
    
    // Add placeholder services for any monitored services not in the health data
    const placeholderServices = missingServices.map(name => {
      return [name.toLowerCase(), { status: 'unavailable', latency: null }];
    });
    
    // Combine with existing services
    services = [...services, ...placeholderServices];
  }
  
  // If still no services but we have monitored services, create all placeholders
  if (services.length === 0 && state.monitoredServices.length > 0) {
    console.log('No services available, creating placeholders for all monitored services');
    services = state.monitoredServices.map(name => {
      return [name, { status: 'unavailable', latency: null }];
    });
  }
  
  if (services.length === 0) {
    servicesContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="32" height="32">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>No services found</span>
      </div>
    `;
    return;
  }
  
  // Make sure we only show monitored services
  if (state.monitoredServices.length > 0) {
    console.log('Filtering to show only monitored services');
    // Convert service names to lowercase for case-insensitive comparison
    const monitoredServicesLower = state.monitoredServices.map(s => s.toLowerCase());
    
    // Create placeholder services for any monitored services missing from results
    services = services.filter(([name, _]) => {
      return monitoredServicesLower.includes(name.toLowerCase());
    });
    
    // No need for fallback to show all services - if we've correctly added placeholders
    // for missing services in the earlier code, we should always have at least the monitored
    // services in the list
    
    console.log('After filtering, showing services:', services.map(([name, _]) => name));
  }
  
  // Sort services by status priority: healthy -> degraded -> error/other
  services.sort((a, b) => {
    const statusA = getServiceStatus(a[1]);
    const statusB = getServiceStatus(b[1]);
    
    const categoryA = mapStatusToCategory(statusA);
    const categoryB = mapStatusToCategory(statusB);
    
    // Define category priority (lower number = higher priority)
    const getPriority = (category) => {
      if (category === 'healthy') return 1;
      if (category === 'degraded') return 2;
      return 3; // error or other categories
    };
    
    const priorityA = getPriority(categoryA);
    const priorityB = getPriority(categoryB);
    
    // Sort by priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same priority, sort alphabetically by name
    return a[0].localeCompare(b[0]);
  });
  
  // Calculate overall status
  const healthyCount = services.filter(([_, info]) => 
    mapStatusToCategory(getServiceStatus(info)) === 'healthy'
  ).length;
  
  const degradedCount = services.filter(([_, info]) => 
    mapStatusToCategory(getServiceStatus(info)) === 'degraded'
  ).length;
  
  const errorCount = services.filter(([_, info]) => 
    mapStatusToCategory(getServiceStatus(info)) === 'error'
  ).length;
  
  // Calculate percentage of healthy services
  const totalServices = services.length;
  const healthyPercentage = totalServices > 0 ? Math.round((healthyCount / totalServices) * 100) : 0;
  
  // Determine overall status
  let overallStatus = 'healthy';
  let circleColor = '#10b981'; // Green for healthy
  
  if (errorCount > 0) {
    overallStatus = 'error';
    circleColor = '#ef4444'; // Red for error
  } else if (degradedCount > 0) {
    overallStatus = 'degraded';
    circleColor = '#f59e0b'; // Amber for degraded
  }
  
  // Always show healthy percentage in green
  const percentageColor = '#10b981'; // Always green
  
  // Get the appropriate status icon for overall status - match web app style
  let statusIcon = '';
  if (overallStatus === 'healthy') {
    statusIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else if (overallStatus === 'degraded') {
    statusIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else {
    statusIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  
  // Always use green for the circle progress color as requested
  const circleProgressColor = '#10b981'; // Always green
  
  // No need to show different colors for different statuses as we're keeping it green
  
  // Create settings button for monitoring preferences
  const settingsButton = `
    <button id="healthSettingsBtn" class="service-refresh-button" title="Monitoring Settings">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  
  const html = `
    <!-- Overall Status Panel -->
    <div class="status-panel">
      <div class="status-header">
        <h2 class="status-title">Overall Status</h2>
        <div class="status-time">Last checked: ${lastUpdated}</div>
      </div>
      
      <div class="health-status ${overallStatus}" style="--progress: ${healthyPercentage}%; --progress-color: ${circleProgressColor};">
        <div class="health-status-inner">
          <div class="health-status-percentage" style="color: ${percentageColor}">
            ${healthyPercentage}%
          </div>
          <div class="health-status-text">
            <span style="color: #10b981; font-weight: 600;">healthy</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Health Summary -->
    <div class="health-summary">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <p class="summary-text">
          <span class="healthy-count">${healthyCount} healthy</span>
          ${' | '}
          <span class="error-count">${errorCount} error</span>
          ${' | '}
          <span class="total-count">${state.availableServices.length - services.length} unmonitored</span>
          ${' | '}
          <span class="total-count">${state.availableServices.length} total services</span>
        </p>
        ${settingsButton}
      </div>
    </div>
    
    <!-- Services Grid -->
    <div class="services-grid">
      ${services.map(([name, info]) => {
        // Get service status using helper function
        const status = getServiceStatus(info);
        const category = mapStatusToCategory(status);
        
        // Calculate status class
        const statusClass = category === 'healthy' ? 'serviceStatusHealthy' : 
                           category === 'degraded' ? 'serviceStatusDegraded' : 
                           'serviceStatusError';
        
        // Format service name nicely with consistent capitalization
        const formattedName = formatServiceName(name);
        
        // Get latency with appropriate class
        const latency = info.latency !== undefined ? info.latency : null;
        const latencyClass = latency !== null ? 
                            (latency < 200 ? 'goodLatency' : 
                             latency < 500 ? 'mediumLatency' : 
                             'badLatency') : '';
        
        // Determine if this service is currently refreshing
        const isRefreshing = state.refreshingServices[name] === true;
        const refreshIcon = isRefreshing ? 
          `<svg class="spin-icon" viewBox="0 0 24 24" width="16" height="16">
            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c-4.97 0-9-4.03-9-9m9 9a9 9 0 01-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
           </svg>` :
          `<svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
           </svg>`;
        
        // Stop monitoring icon
        const closeIcon = `<svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        
        return `
          <div class="service-card">
            <div class="service-header">
              <h3 class="service-name">${formattedName}</h3>
              <div class="service-actions">
                <button 
                  class="service-monitor-toggle"
                  data-service="${name}"
                  title="Stop monitoring ${formattedName}"
                >
                  ${closeIcon}
                </button>
                <div class="service-status ${statusClass}">
                  ${category}
                </div>
                <button 
                  class="service-refresh-button"
                  data-service="${name}"
                  ${isRefreshing ? 'disabled' : ''}
                  title="Refresh ${formattedName} status"
                >
                  ${refreshIcon}
                </button>
              </div>
            </div>
            <div class="service-content">
              ${latency !== null ? `
                <div class="service-detail">
                  <span class="service-detail-label">Response Time</span>
                  <div class="service-latency">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="latency-badge ${latencyClass}">${latency}ms</span>
                  </div>
                </div>
              ` : ''}
              ${info.version ? `
                <div class="service-detail">
                  <span class="service-detail-label">Version</span>
                  <div class="service-detail-value">${info.version}</div>
                </div>
              ` : ''}
              ${info.running !== undefined ? `
                <div class="service-detail">
                  <span class="service-detail-label">Status</span>
                  <div class="service-detail-value">${info.running ? 'Running' : 'Stopped'}</div>
                </div>
              ` : ''}
              ${info.endpoint ? `
                <div class="service-detail">
                  <span class="service-detail-label">Endpoint</span>
                  <div class="service-detail-value service-endpoint">${info.endpoint}</div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  servicesContainer.innerHTML = html;
  
  // Add event listener for settings button
  document.getElementById('healthSettingsBtn')?.addEventListener('click', toggleHealthSettings);
  
  // Add click handlers for service monitor toggle buttons (delete/remove service)
  const removeButtons = document.querySelectorAll('.service-monitor-toggle');
  removeButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const serviceName = event.currentTarget.getAttribute('data-service');
      if (serviceName) {
        console.log('Clicked to remove service:', serviceName);
        
        // Find closest service card for immediate visual feedback
        const serviceCard = event.currentTarget.closest('.service-card');
        if (serviceCard) {
          // Apply visual feedback immediately
          serviceCard.style.opacity = '0.5';
          serviceCard.style.pointerEvents = 'none';
        }
        
        // Remove the service
        const removed = removeServiceFromMonitor(serviceName);
        
        if (removed) {
          showToast(`${formatServiceName(serviceName)} removed from monitoring`, 'info');
          
          // Force complete re-render with a slight delay for animation
          setTimeout(() => {
            renderHealthStatus();
          }, 100);
        } else {
          // If removal failed, restore the card
          if (serviceCard) {
            serviceCard.style.opacity = '';
            serviceCard.style.pointerEvents = '';
          }
          showToast(`Error removing ${formatServiceName(serviceName)}`, 'error');
        }
      }
    });
  });
  
  // Add click handlers for service refresh buttons
  const refreshButtons = document.querySelectorAll('.service-refresh-button');
  refreshButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const serviceName = event.currentTarget.getAttribute('data-service');
      if (serviceName && !button.hasAttribute('disabled')) {
        console.log('Refreshing service health:', serviceName);
        refreshServiceHealth(serviceName);
      }
    });
  });
}

/**
 * Toggle health settings panel display
 */
function toggleHealthSettings() {
  state.showSettings = !state.showSettings;
  
  if (state.showSettings) {
    // Show settings panel
    renderHealthSettings();
  } else {
    // Hide settings panel
    const settingsPanel = document.getElementById('healthSettingsPanel');
    if (settingsPanel) {
      settingsPanel.remove();
    }
  }
}

/**
 * Add a service to be monitored
 * @param {string} serviceName - Service to add to monitoring
 */
function addServiceToMonitor(serviceName) {
  if (!state.monitoredServices.includes(serviceName)) {
    console.log(`Adding service to monitored list: ${serviceName}`);
    state.monitoredServices.push(serviceName);
    saveState();
    
    // If settings panel is open, refresh it
    if (state.showSettings) {
      renderHealthSettings();
    }
    
    // Create a loading state for this service
    state.refreshingServices[serviceName] = true;
    
    // Update health status display immediately with placeholder
    renderHealthStatus();
    
    // Then fetch fresh data to update the status
    fetchHealthData().then(() => {
      // Clear loading state
      delete state.refreshingServices[serviceName];
      // Re-render with the latest data
      renderHealthStatus();
    });
  }
}

/**
 * Remove a service from monitoring
 * @param {string} serviceName - Service to remove from monitoring
 */
function removeServiceFromMonitor(serviceName) {
  console.log('Removing service from monitor:', serviceName);
  console.log('Current monitored services:', state.monitoredServices);
  
  // Convert to lowercase for case-insensitive comparison
  const serviceNameLower = serviceName.toLowerCase();
  
  // Check if service exists (case-insensitive)
  const serviceExists = state.monitoredServices.some(name => 
    name.toLowerCase() === serviceNameLower);
    
  if (serviceExists) {
    console.log('Service found, removing it');
    // Filter out the service (case-insensitive)
    state.monitoredServices = state.monitoredServices.filter(name => 
      name.toLowerCase() !== serviceNameLower);
    saveState();
    
    // If settings panel is open, refresh it
    if (state.showSettings) {
      renderHealthSettings();
    }
    
    // Update health status display
    renderHealthStatus();
    
    console.log('Services after removal:', state.monitoredServices);
    return true;
  } else {
    console.warn('Service not found in monitored services:', serviceName);
    return false;
  }
}

/**
 * Reset monitoring preferences to default (using default monitored services)
 */
function resetMonitoringPreferences() {
  state.settingsLoading = true;
  
  // Reset to the default monitored services from the web app
  state.monitoredServices = [...state.defaultMonitoredServices];
  saveState();
  
  // If settings panel is open, refresh it
  if (state.showSettings) {
    renderHealthSettings();
  }
  
  // Update health status display
  renderHealthStatus();
  
  state.settingsLoading = false;
  
  // Show confirmation toast
  showToast('Reset to default monitoring settings');
}

/**
 * Render health monitoring settings panel - Exact match to web app design
 */
function renderHealthSettings() {
  // Create settings panel element if it doesn't exist
  let settingsPanel = document.getElementById('healthSettingsPanel');
  
  if (!settingsPanel) {
    settingsPanel = document.createElement('div');
    settingsPanel.id = 'healthSettingsPanel';
    settingsPanel.className = 'health-settings-panel';
    
    // Add to DOM after health status container
    const healthContainer = document.getElementById('healthStatusContainer');
    healthContainer.parentNode.insertBefore(settingsPanel, healthContainer.nextSibling);
  }
  
  // Get all available services
  const availableServices = state.availableServices.sort((a, b) => a.localeCompare(b));
  
  // Split into monitored and unmonitored services
  const monitoredServices = state.monitoredServices.sort((a, b) => a.localeCompare(b));
  const unmonitoredServices = availableServices.filter(service => !monitoredServices.includes(service));
  
  // Prepare refresh icon SVG
  const refreshIcon = `
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>
  `;
  
  // Prepare plus icon SVG
  const plusIcon = `
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `;
  
  // Prepare close icon SVG
  const closeIcon = `
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  settingsPanel.innerHTML = `
    <div class="settings-header">
      <h3>Monitoring Settings</h3>
      <button id="closeSettingsBtn" class="service-refresh-button">
        ${closeIcon}
      </button>
    </div>
    <div class="settings-content">
      <p class="settings-description">Select which services to monitor. Changes will take effect immediately.</p>
      
      <!-- Monitored Services Section -->
      <div class="service-section">
        <h3 class="service-section-title">Currently Monitored Services</h3>
        <div class="service-toggles">
          ${monitoredServices.map(service => {
            const formattedName = formatServiceName(service);
            
            return `
              <label class="service-checkbox" data-service="${service.toLowerCase()}">
                <input type="checkbox" checked class="remove-service-checkbox">
                <span>${formattedName}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Available Services Section -->
      ${unmonitoredServices.length > 0 ? `
        <div class="service-section">
          <h3 class="service-section-title">Available Services</h3>
          <div class="service-toggles">
            ${unmonitoredServices.map(service => {
              const formattedName = formatServiceName(service);
              
              return `
                <button class="add-service-button" data-service="${service.toLowerCase()}">
                  ${plusIcon}
                  ${formattedName}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="settings-actions">
        <button id="resetMonitoringBtn" class="reset-button">
          Reset to Defaults
        </button>
        <button id="closeSettingsBtnBottom" class="close-settings-button">
          Close
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById('closeSettingsBtn').addEventListener('click', toggleHealthSettings);
  document.getElementById('closeSettingsBtnBottom').addEventListener('click', toggleHealthSettings);
  document.getElementById('resetMonitoringBtn').addEventListener('click', resetMonitoringPreferences);
  
  // Add event listeners for service add buttons
  const addButtons = settingsPanel.querySelectorAll('.add-service-button');
  addButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const serviceName = event.currentTarget.getAttribute('data-service');
      console.log('Adding service to monitor:', serviceName);
      if (serviceName) {
        addServiceToMonitor(serviceName);
        
        // Show toast notification
        showToast('Service added to monitoring', 'success');
      }
    });
  });
  
  // Add event listeners for service remove checkboxes
  const removeCheckboxes = settingsPanel.querySelectorAll('.remove-service-checkbox');
  removeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const serviceName = event.currentTarget.closest('.service-checkbox').getAttribute('data-service');
      console.log('Removing service from monitor:', serviceName);
      if (serviceName && !event.currentTarget.checked) {
        removeServiceFromMonitor(serviceName);
        
        // Show toast notification
        showToast('Service removed from monitoring', 'info');
      } else {
        // Re-check if unchecked accidentally (since we're using the change event)
        event.currentTarget.checked = true;
      }
    });
  });
}

// Fetch S3 buckets
export async function fetchBuckets() {
  try {
    document.getElementById('bucketsContainer').innerHTML = '<div class="loading">Loading buckets...</div>';
    
    console.log('Fetching buckets from:', LOCALSTACK_ENDPOINT);
    
    // Use AWS SDK pattern similar to the Next.js app
    // This mimics what the AWS SDK would do for a ListBuckets request
    console.log('Using AWS SDK pattern for S3...');
    
    // Create a simple AWS request signature
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8); // YYYYMMDD format
    
    const data = await proxyRequest({
      url: `${LOCALSTACK_ENDPOINT}/`,
      method: 'GET',
      headers: {
        'Host': 's3.amazonaws.com',
        'X-Amz-Date': timestamp,
        'X-Amz-Content-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'Authorization': `AWS4-HMAC-SHA256 Credential=test/${date}/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f4db2c3c4df4a964d63377c903381e4b5df36db5cacaa8599f8cb6c423127721`
      }
    });
    
    console.log('S3 ListBuckets response:', data);
    
    // Parse buckets data based on response format
    if (typeof data === 'string' && data.includes('<?xml')) {
      // Parse XML response
      console.log('Parsing XML response...');
      
      try {
        // Create a DOM parser to handle XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        
        // Extract bucket information from XML
        const bucketElements = xmlDoc.getElementsByTagName('Bucket');
        const buckets = [];
        
        for (let i = 0; i < bucketElements.length; i++) {
          const nameElement = bucketElements[i].getElementsByTagName('Name')[0];
          const dateElement = bucketElements[i].getElementsByTagName('CreationDate')[0];
          
          if (nameElement && dateElement) {
            buckets.push({
              Name: nameElement.textContent,
              CreationDate: new Date(dateElement.textContent)
            });
          }
        }
        
        state.buckets = buckets;
        console.log('Parsed buckets:', buckets);
      } catch (error) {
        console.error('Error parsing XML:', error);
        state.buckets = [];
      }
    } else if (data && data.ListAllMyBucketsResult && data.ListAllMyBucketsResult.Buckets) {
      // Handle XML-converted JSON format
      const buckets = Array.isArray(data.ListAllMyBucketsResult.Buckets.Bucket) 
        ? data.ListAllMyBucketsResult.Buckets.Bucket
        : [data.ListAllMyBucketsResult.Buckets.Bucket];
        
      state.buckets = buckets.map(bucket => ({
        Name: bucket.Name,
        CreationDate: new Date(bucket.CreationDate)
      }));
    } else if (data && Array.isArray(data.Buckets)) {
      // Handle standard AWS SDK format
      state.buckets = data.Buckets;
    } else {
      // Fallback for empty or unexpected format
      console.warn('Unexpected data format:', data);
      state.buckets = [];
    }
    
    state.bucketLastUpdated = Date.now();
    
    // Always render and save state after fetching
    renderBuckets();
    saveState();
  } catch (error) {
    console.error('Buckets error:', error);
    document.getElementById('bucketsContainer').innerHTML = `
      <div class="empty-state">
        Error fetching buckets.<br>
        Make sure LocalStack is running.<br>
        ${error.message}
      </div>
    `;
  }
}

// Render S3 buckets
function renderBuckets() {
  const bucketsContainer = document.getElementById('bucketsContainer');
  const lastUpdatedElement = document.getElementById('s3LastUpdated');
  
  console.log('Rendering buckets state:', state.buckets);
  
  // Format last updated time
  if (state.bucketLastUpdated) {
    const lastUpdated = new Date(state.bucketLastUpdated).toLocaleTimeString();
    lastUpdatedElement.textContent = `Last updated: ${lastUpdated}`;
  }
  
  // Early check for empty buckets
  if (!state.buckets || state.buckets.length === 0) {
    bucketsContainer.innerHTML = '<div class="empty-state">No buckets found</div>';
    return;
  }
  
  // Show bucket count directly in the container
  const bucketCount = state.buckets.length;
  const countEl = document.createElement('div');
  countEl.className = 'item-count';
  countEl.textContent = `${bucketCount} bucket${bucketCount !== 1 ? 's' : ''} found`;
  
  // Filter buckets based on search query
  let filteredBuckets = state.buckets;
  if (state.bucketSearchQuery) {
    const query = state.bucketSearchQuery.toLowerCase();
    filteredBuckets = state.buckets.filter(bucket => 
      bucket.Name && bucket.Name.toLowerCase().includes(query)
    );
  }
  
  if (filteredBuckets.length === 0) {
    bucketsContainer.innerHTML = '<div class="empty-state">No matching buckets found</div>';
    return;
  }
  
  // Create table for buckets
  const table = document.createElement('table');
  table.className = 'item-table';
  
  // Create table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // Create column headers
  const nameHeader = document.createElement('th');
  nameHeader.className = 'sortable';
  nameHeader.dataset.sort = 'Name';
  nameHeader.innerHTML = `
    Bucket Name 
    ${state.bucketSortField === 'Name' ? 
      `<span class="sort-indicator">${state.bucketSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
  `;
  
  const dateHeader = document.createElement('th');
  dateHeader.className = 'sortable';
  dateHeader.dataset.sort = 'CreationDate';
  dateHeader.innerHTML = `
    Creation Date
    ${state.bucketSortField === 'CreationDate' ? 
      `<span class="sort-indicator">${state.bucketSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
  `;
  
  // Add event listeners to headers for sorting
  nameHeader.addEventListener('click', () => {
    if (state.bucketSortField === 'Name') {
      state.bucketSortOrder = state.bucketSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.bucketSortField = 'Name';
      state.bucketSortOrder = 'asc';
    }
    saveState();
    renderBuckets();
  });
  
  dateHeader.addEventListener('click', () => {
    if (state.bucketSortField === 'CreationDate') {
      state.bucketSortOrder = state.bucketSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.bucketSortField = 'CreationDate';
      state.bucketSortOrder = 'asc';
    }
    saveState();
    renderBuckets();
  });
  
  // Add headers to the table
  headerRow.appendChild(nameHeader);
  headerRow.appendChild(dateHeader);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Sort buckets
  console.log('Sorting buckets with:', state.bucketSortField, state.bucketSortOrder);
  filteredBuckets.sort((a, b) => {
    // Handle date sorting properly
    if (state.bucketSortField === 'CreationDate') {
      const dateA = new Date(a.CreationDate).getTime();
      const dateB = new Date(b.CreationDate).getTime();
      return state.bucketSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    // Handle name sorting
    const aValue = a.Name || '';
    const bValue = b.Name || '';
    
    if (state.bucketSortOrder === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });
  
  // Create table body
  const tbody = document.createElement('tbody');
  
  // Create rows for each bucket
  filteredBuckets.forEach(bucket => {
    const row = document.createElement('tr');
    row.className = 'bucket-row';
    
    // Name cell
    const nameCell = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'bucket-name';
    nameDiv.innerHTML = `
      <svg class="bucket-icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2m18 0a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2M3 10a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2m18 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${bucket.Name}
    `;
    nameCell.appendChild(nameDiv);
    
    // Date cell
    const dateCell = document.createElement('td');
    const date = new Date(bucket.CreationDate);
    dateCell.textContent = date.toLocaleString();
    
    // Add cells to row
    row.appendChild(nameCell);
    row.appendChild(dateCell);
    
    // Add click event to view bucket objects
    row.addEventListener('click', () => {
      console.log(`Clicked on bucket: ${bucket.Name}`);
      showObjectListView(bucket.Name);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  // Clear container and add elements
  bucketsContainer.innerHTML = '';
  bucketsContainer.appendChild(countEl);
  bucketsContainer.appendChild(table);
}

// Fetch SQS queues for a single region - closely matching web app implementation
async function fetchQueues() {
  try {
    document.getElementById('queuesContainer').innerHTML = '<div class="loading">Loading queues...</div>';
    
    console.log('Fetching queues from:', LOCALSTACK_ENDPOINT);
    
    // First, create a request to exactly match the AWS SDK ListQueuesCommand format used in the web app
    // This format is taken directly from the Next.js app's implementation
    const params = new URLSearchParams({
      'Action': 'ListQueues',
      'Version': '2012-11-05', // AWS API version
      'MaxResults': '1000' // Match web app's MaxResults parameter
    });
    
    console.log(`Fetching SQS queues for region: ${state.queueRegion}`);
    
    // Make a request that perfectly mirrors the AWS SDK behavior
    // The headers are critical for LocalStack to process the request correctly
    const data = await proxyRequest({
      url: `${LOCALSTACK_ENDPOINT}/?${params.toString()}`,
      method: 'GET',
      headers: {
        'Host': `sqs.${state.queueRegion}.amazonaws.com`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-Amz-Content-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Empty content hash
        'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
        'Authorization': 'AWS4-HMAC-SHA256 Credential=test/20250401/ap-southeast-1/sqs/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f4db2c3c4df4a964d63377c903381e4b5df36db5cacaa8599f8cb6c423127721'
      }
    });
    
    // We're now using a simplified approach that exactly matches the web app's implementation
    // The web app uses the AWS SDK with a specific region (ap-southeast-1)
    console.log(`Using direct approach that matches web app for region: ${state.queueRegion}`);
    
    // We don't need the second fetch attempt that was here previously
    
    console.log('Queues data:', data);
    
    // Handle response formats - simplified to match web app implementation
    let queueUrls = [];
    
    console.log('Raw SQS response type:', typeof data);
    
    if (data) {
      // Direct QueueUrls array - this is what the AWS SDK in the web app returns
      if (data.QueueUrls && Array.isArray(data.QueueUrls)) {
        queueUrls = data.QueueUrls;
        console.log('Found QueueUrls directly in response - matches web app format');
      }
      // XML structure converted to JSON - alternate format
      else if (data.ListQueuesResponse && data.ListQueuesResponse.ListQueuesResult) {
        const result = data.ListQueuesResponse.ListQueuesResult;
        if (result.QueueUrl) {
          if (Array.isArray(result.QueueUrl)) {
            queueUrls = result.QueueUrl;
          } else {
            queueUrls = [result.QueueUrl];
          }
          console.log('Found QueueUrls in ListQueuesResponse structure');
        }
      }
      // Raw XML response - final fallback
      else if (typeof data === 'string' && data.includes('<ListQueuesResponse')) {
        console.log('Parsing XML response - attempting to extract queue URLs');
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, 'text/xml');
          const queueUrlElements = xmlDoc.getElementsByTagName('QueueUrl');
          
          console.log(`Found ${queueUrlElements.length} queue URLs in XML response`);
          
          for (let i = 0; i < queueUrlElements.length; i++) {
            queueUrls.push(queueUrlElements[i].textContent);
          }
        } catch (xmlError) {
          console.error('Error parsing XML queue response:', xmlError);
        }
      }
    }
    
    console.log(`Total queues found: ${queueUrls.length}`, queueUrls);
    
    console.log(`Found ${queueUrls.length} queues:`, queueUrls);
    
    // Display a helpful message if no queues found
    if (queueUrls.length === 0) {
      console.log('No queues found, showing help message');
      document.getElementById('queuesContainer').innerHTML = `
        <div class="empty-state">
          <p>No SQS queues found in region ${state.queueRegion}</p>
          <p><small>To create a queue, use the AWS CLI:</small></p>
          <pre>aws --endpoint-url=http://localhost:4566 --region ${state.queueRegion} sqs create-queue --queue-name my-test-queue</pre>
        </div>
      `;
      return;
    }
    
    console.log('Parsed queue URLs:', queueUrls);
    
    // Get queue attributes (like message count) for each queue
    const queuesWithAttributes = await Promise.all(
      queueUrls.map(async (queueUrl) => {
        const queueName = queueUrl.split('/').pop();
        
        try {
          console.log(`Fetching attributes for queue: ${queueName}`);
          
          // Go back to URL params approach which we know works with LocalStack
          const attrParams = new URLSearchParams({
            'Action': 'GetQueueAttributes',
            'Version': '2012-11-05',
            'QueueUrl': queueUrl,
            'AttributeName.1': 'All'
          });
          
          const attrData = await proxyRequest({
            url: `${LOCALSTACK_ENDPOINT}/?${attrParams.toString()}`,
            method: 'GET',
            headers: {
              'Host': `sqs.${state.queueRegion}.amazonaws.com`,
              'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            }
          });
          
          // If we're here, we received a response (successful or not)
          // Since we might get a 403 error as an exception, we need to catch it at the outer try-catch
          
          console.log(`Attributes for queue ${queueName}:`, attrData);
          
          // Extract attributes from all possible response formats
          let attributes = {};
          
          if (attrData) {
            // Direct Attributes object (AWS SDK v3 JSON format)
            if (attrData.Attributes && typeof attrData.Attributes === 'object') {
              attributes = attrData.Attributes;
              console.log('Found attributes directly in response');
            }
            // AWS SDK-style response
            else if (attrData.GetQueueAttributesResponse && 
                    attrData.GetQueueAttributesResponse.GetQueueAttributesResult && 
                    attrData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes) {
              attributes = attrData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes;
              console.log('Found attributes in GetQueueAttributesResponse structure');
            }
            // XML response
            else if (typeof attrData === 'string' && attrData.includes('<GetQueueAttributesResponse')) {
              try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(attrData, 'text/xml');
                const attrElements = xmlDoc.getElementsByTagName('Attribute');
                
                for (let i = 0; i < attrElements.length; i++) {
                  const nameEl = attrElements[i].getElementsByTagName('Name')[0];
                  const valueEl = attrElements[i].getElementsByTagName('Value')[0];
                  if (nameEl && valueEl) {
                    attributes[nameEl.textContent] = valueEl.textContent;
                  }
                }
                console.log('Parsed attributes from XML response');
              } catch (xmlError) {
                console.error('Error parsing XML attribute response:', xmlError);
              }
            }
            // Try to use our helper to find attributes in a nested object
            else if (typeof attrData === 'object') {
              const attributesPath = findAttributesInObject(attrData);
              if (attributesPath) {
                console.log('Found attributes at path:', attributesPath);
                let current = attrData;
                for (const key of attributesPath.split('.')) {
                  if (current && typeof current === 'object') {
                    current = current[key];
                  } else {
                    current = null;
                    break;
                  }
                }
                if (current && typeof current === 'object') {
                  attributes = current;
                  console.log('Using attributes from found path:', attributes);
                }
              }
            }
          }
          
          // Get queue attributes from response using all possible approach patterns
          console.log(`Raw response data for queue ${queueName}:`, attrData);
          
          // We'll analyze the response and extract attributes regardless of format
          let parsedAttributes = {};
          let messageCount = 0;
          
          try {
            // APPROACH 1: XML Response parsing
            if (typeof attrData === 'string' && attrData.includes('<GetQueueAttributesResponse')) {
              console.log('Parsing XML response');
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(attrData, 'text/xml');
              
              // Look for Attribute elements
              const attrElements = xmlDoc.getElementsByTagName('Attribute');
              console.log(`Found ${attrElements.length} attribute elements in XML`);
              
              for (let i = 0; i < attrElements.length; i++) {
                const nameEl = attrElements[i].getElementsByTagName('Name')[0];
                const valueEl = attrElements[i].getElementsByTagName('Value')[0];
                if (nameEl && valueEl) {
                  parsedAttributes[nameEl.textContent] = valueEl.textContent;
                }
              }
            }
            // APPROACH 2: JSON string parsing
            else if (typeof attrData === 'string' && (attrData.startsWith('{') || attrData.startsWith('['))) {
              try {
                const jsonData = JSON.parse(attrData);
                console.log('Parsed string response as JSON:', jsonData);
                if (jsonData.Attributes) {
                  parsedAttributes = jsonData.Attributes;
                } else if (jsonData.GetQueueAttributesResponse && 
                          jsonData.GetQueueAttributesResponse.GetQueueAttributesResult && 
                          jsonData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes) {
                  parsedAttributes = jsonData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes;
                }
              } catch (e) {
                console.log('Response string is not valid JSON');
              }
            }
            // APPROACH 3: RegEx parsing of string response
            else if (typeof attrData === 'string' && attrData.includes('ApproximateNumberOfMessages')) {
              console.log('Using regex to extract message count from string response');
              // Try XML format
              let match = attrData.match(/<ApproximateNumberOfMessages>(\d+)<\/ApproximateNumberOfMessages>/i);
              if (match && match[1]) {
                parsedAttributes.ApproximateNumberOfMessages = match[1];
              } else {
                // Try JSON/text format
                match = attrData.match(/ApproximateNumberOfMessages["']?\s*[:,]\s*["']?(\d+)["']?/i);
                if (match && match[1]) {
                  parsedAttributes.ApproximateNumberOfMessages = match[1];
                }
              }
            }
            // APPROACH 4: Object response formats
            else if (attrData && typeof attrData === 'object') {
              console.log('Processing object response');
              
              // Check for direct Attributes object (most likely format)
              if (attrData.Attributes && typeof attrData.Attributes === 'object') {
                parsedAttributes = attrData.Attributes;
                console.log('Found attributes directly in response object');
              }
              // Check for GetQueueAttributesResponse structure (nested format) 
              else if (attrData.GetQueueAttributesResponse && 
                      attrData.GetQueueAttributesResponse.GetQueueAttributesResult && 
                      attrData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes) {
                parsedAttributes = attrData.GetQueueAttributesResponse.GetQueueAttributesResult.Attributes;
                console.log('Found attributes in GetQueueAttributesResponse structure');
              }
              // Check for GetQueueAttributesResult with Attribute array (LocalStack response format)
              else if (attrData.GetQueueAttributesResult && 
                      attrData.GetQueueAttributesResult.Attribute && 
                      Array.isArray(attrData.GetQueueAttributesResult.Attribute)) {
                console.log('Found GetQueueAttributesResult with Attribute array');
                // Convert array of Name/Value pairs to object
                const attributeArray = attrData.GetQueueAttributesResult.Attribute;
                attributeArray.forEach(attr => {
                  if (attr.Name && attr.Value !== undefined) {
                    parsedAttributes[attr.Name] = attr.Value;
                  }
                });
                console.log('Converted attribute array to object:', parsedAttributes);
              }
              // Direct ApproximateNumberOfMessages property
              else if (attrData.ApproximateNumberOfMessages !== undefined) {
                parsedAttributes.ApproximateNumberOfMessages = attrData.ApproximateNumberOfMessages;
                console.log('Found ApproximateNumberOfMessages directly in response object');
              }
              // Try to find attributes using our recursive helper
              else {
                const foundAttributes = findAttributesRecursively(attrData);
                if (foundAttributes) {
                  parsedAttributes = foundAttributes;
                  console.log('Found attributes through recursive search');
                }
              }
            }
            
            console.log('Final parsed attributes:', parsedAttributes);
            
            // NOW EXTRACT MESSAGE COUNT - Try multiple approaches
            
            // First try from attributes
            if (parsedAttributes.ApproximateNumberOfMessages !== undefined) {
              messageCount = parseInt(parsedAttributes.ApproximateNumberOfMessages, 10);
              console.log(`Parsed message count from attributes: ${messageCount}`);
            }
            
            // If that didn't work, try our value finder
            if (isNaN(messageCount) || messageCount === 0) {
              const foundCount = findValueInObject(attrData, 'ApproximateNumberOfMessages');
              if (foundCount !== undefined) {
                messageCount = parseInt(foundCount, 10);
                console.log(`Found message count through object search: ${messageCount}`);
              }
            }
            
            // Last try with recursive helper
            if (isNaN(messageCount) || messageCount === 0) {
              const recursiveCount = findMessageCountRecursively(attrData);
              if (!isNaN(recursiveCount)) {
                messageCount = recursiveCount;
                console.log(`Found message count recursively: ${messageCount}`);
              }
            }
          } catch (error) {
            console.error(`Error processing queue attributes for ${queueName}:`, error);
            messageCount = 0;
          }
          
          return {
            name: queueName,
            url: queueUrl,
            messageCount: messageCount || 0, // Ensure a default of 0 if parsing failed
            createdTimestamp: parseInt(parsedAttributes.CreatedTimestamp || '0', 10) * 1000
          };
        } catch (error) {
          console.error(`Error fetching attributes for queue ${queueName}:`, error);
          return {
            name: queueName,
            url: queueUrl,
            messageCount: 0,
            createdTimestamp: 0
          };
        }
      })
    );
    
    state.queues = queuesWithAttributes;
    state.queueLastUpdated = Date.now();
    
    renderQueues();
    saveState();
  } catch (error) {
    console.error('Queues error:', error);
    document.getElementById('queuesContainer').innerHTML = `
      <div class="empty-state">
        Error fetching queues.<br>
        Make sure LocalStack is running.<br>
        <small>Error: ${error.message}</small><br><br>
        <small>If your LocalStack is running and the error persists, you might need to create SQS queues first.</small>
      </div>
    `;
  }
}

// Render SQS queues
function renderQueues() {
  const queuesContainer = document.getElementById('queuesContainer');
  const lastUpdatedElement = document.getElementById('sqsLastUpdated');
  
  // Format last updated time
  if (state.queueLastUpdated) {
    const lastUpdated = new Date(state.queueLastUpdated).toLocaleTimeString();
    lastUpdatedElement.textContent = `Last updated: ${lastUpdated}`;
  }
  
  if (state.queues.length === 0) {
    queuesContainer.innerHTML = '<div class="empty-state">No queues found</div>';
    return;
  }
  
  // Filter queues based on search query
  let filteredQueues = state.queues;
  if (state.queueSearchQuery) {
    const query = state.queueSearchQuery.toLowerCase();
    filteredQueues = state.queues.filter(queue => 
      queue.name.toLowerCase().includes(query)
    );
  }
  
  // Sort queues
  filteredQueues.sort((a, b) => {
    const aValue = state.queueSortField === 'messageCount' 
      ? a.messageCount 
      : a[state.queueSortField];
    const bValue = state.queueSortField === 'messageCount' 
      ? b.messageCount 
      : b[state.queueSortField];
    
    if (state.queueSortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  // Apply pagination
  const indexOfLastQueue = state.currentPage * state.queuesPerPage;
  const indexOfFirstQueue = indexOfLastQueue - state.queuesPerPage;
  const paginatedQueues = filteredQueues.slice(indexOfFirstQueue, indexOfLastQueue);
  
  if (filteredQueues.length === 0) {
    queuesContainer.innerHTML = `
      <div class="empty-state">
        No matching queues found.<br>
        <small>Try clearing your search filter or create new SQS queues in LocalStack.</small>
      </div>`;
    return;
  }
  
  const html = `
    <table class="item-table">
      <thead>
        <tr>
          <th class="sortable ${state.queueSortField === 'name' ? 'sorted-' + state.queueSortOrder : ''}" data-sort="name">
            Queue Name
            ${state.queueSortField === 'name' ? `<span class="sort-indicator">${state.queueSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
          </th>
          <th class="sortable ${state.queueSortField === 'messageCount' ? 'sorted-' + state.queueSortOrder : ''}" data-sort="messageCount">
            Messages
            ${state.queueSortField === 'messageCount' ? `<span class="sort-indicator">${state.queueSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
          </th>
          <th class="sortable ${state.queueSortField === 'createdTimestamp' ? 'sorted-' + state.queueSortOrder : ''}" data-sort="createdTimestamp">
            Created
            ${state.queueSortField === 'createdTimestamp' ? `<span class="sort-indicator">${state.queueSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${paginatedQueues.map(queue => `
          <tr>
            <td>${queue.name}</td>
            <td>${typeof queue.messageCount === 'number' ? queue.messageCount : 0}</td>
            <td>${queue.createdTimestamp ? new Date(queue.createdTimestamp).toLocaleString() : 'Unknown'}</td>
            <td class="actions-cell">
              <button class="button view-messages-button" data-queue-url="${queue.url}">
                <svg class="icon" viewBox="0 0 24 24" width="16" height="16">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                View Messages
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  queuesContainer.innerHTML = html;
  
  // Add sort event listeners
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      
      if (state.queueSortField === field) {
        // Toggle sort order
        state.queueSortOrder = state.queueSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        // Change sort field
        state.queueSortField = field;
        // Use descending order by default for messageCount (high to low)
        // Use ascending order by default for other fields (A-Z, oldest-newest)
        state.queueSortOrder = field === 'messageCount' ? 'desc' : 'asc';
      }
      
      console.log(`Sorting queues by ${field} in ${state.queueSortOrder} order`);
      renderQueues();
      saveState();
    });
  });
  
  // Add event listeners for view message buttons
  document.querySelectorAll('.view-messages-button').forEach(button => {
    button.addEventListener('click', () => {
      const queueUrl = button.dataset.queueUrl;
      if (queueUrl) {
        // Import function from queue-messages.js
        import('./queue-messages.js').then(module => {
          module.selectQueue(queueUrl);
        });
      }
    });
  });
  
  // Render pagination
  renderPagination();
}

// Fetch SQS queues from all regions - with improved implementation matching web app approach
async function fetchQueuesFromAllRegions() {
  document.getElementById('queuesContainer').innerHTML = '<div class="loading">Loading queues from all regions...</div>';
  
  // Get all regions from the region selector
  const regionSelect = document.getElementById('queueRegionSelect');
  const regions = Array.from(regionSelect.options).map(option => option.value);
  
  console.log(`Fetching queues from ${regions.length} regions`);
  
  // Create a container for all regions
  let allRegionsHtml = '';
  let totalQueuesFound = 0;
  
  // For each region, fetch queues
  for (const region of regions) {
    console.log(`Fetching queues for region: ${region}`);
    
    // Update UI to show current region being processed
    document.getElementById('queuesContainer').innerHTML = 
      `<div class="loading">Loading queues from region ${region}...</div>` + allRegionsHtml;
    
    // Fetch queues for this region using the same parameters as the web app
    const params = new URLSearchParams({
      'Action': 'ListQueues',
      'Version': '2012-11-05',
      'MaxResults': '1000' // Match web app's MaxResults parameter
    });
    
    try {
      const data = await proxyRequest({
        url: `${LOCALSTACK_ENDPOINT}/?${params.toString()}`,
        method: 'GET',
        headers: {
          'Host': `sqs.${region}.amazonaws.com`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'X-Amz-Content-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
          'Authorization': `AWS4-HMAC-SHA256 Credential=test/20250401/${region}/sqs/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f4db2c3c4df4a964d63377c903381e4b5df36db5cacaa8599f8cb6c423127721`
        }
      });
      
      // Extract queue URLs using the existing parsing logic
      let queueUrls = [];
      
      if (data) {
        // Direct QueueUrls array
        if (data.QueueUrls && Array.isArray(data.QueueUrls)) {
          queueUrls = data.QueueUrls;
        }
        // AWS SDK XML-like structure (JSON format)
        else if (data.ListQueuesResponse && data.ListQueuesResponse.ListQueuesResult) {
          const result = data.ListQueuesResponse.ListQueuesResult;
          if (result.QueueUrl) {
            if (Array.isArray(result.QueueUrl)) {
              queueUrls = result.QueueUrl;
            } else {
              queueUrls = [result.QueueUrl];
            }
          }
        }
        // Raw XML response
        else if (typeof data === 'string' && data.includes('<ListQueuesResponse')) {
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            const queueUrlElements = xmlDoc.getElementsByTagName('QueueUrl');
            
            for (let i = 0; i < queueUrlElements.length; i++) {
              queueUrls.push(queueUrlElements[i].textContent);
            }
          } catch (xmlError) {
            console.error('Error parsing XML queue response:', xmlError);
          }
        }
      }
      
      console.log(`Found ${queueUrls.length} queues in region ${region}:`, queueUrls);
      totalQueuesFound += queueUrls.length;
      
      // If we have queues in this region, prepare HTML
      if (queueUrls.length > 0) {
        const queueNames = queueUrls.map(url => url.split('/').pop());
        
        // Create a collapsible section for this region
        const regionHtml = `
          <div class="region-section">
            <div class="region-header" data-region="${region}">
              <h3>${getRegionDisplayName(region)} (${queueUrls.length})</h3>
              <span class="toggle-icon">▼</span>
            </div>
            <div class="region-queues" id="region-${region}">
              ${queueNames.map(name => `
                <div class="queue-row">
                  <div class="queue-name">
                    <i class="fas fa-envelope-square queue-icon"></i>
                    ${name}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        
        // Add this region's HTML to our collection
        allRegionsHtml = regionHtml + allRegionsHtml;
        
        // Update the UI as we go
        document.getElementById('queuesContainer').innerHTML = 
          `<div class="loading">Loading queues from region ${region}...</div>` + allRegionsHtml;
      }
    } catch (error) {
      console.error(`Error fetching queues for region ${region}:`, error);
      // Continue with other regions even if one fails
    }
  }
  
  // If we didn't find any queues in any region, show a message
  if (!allRegionsHtml) {
    document.getElementById('queuesContainer').innerHTML = `
      <div class="empty-state">
        <p>No SQS queues found in any region</p>
        <p><small>To create a queue, use the AWS CLI:</small></p>
        <pre>aws --endpoint-url=http://localhost:4566 --region [region] sqs create-queue --queue-name my-test-queue</pre>
      </div>
    `;
    return;
  }
  
  // Final update with all regions
  document.getElementById('queuesContainer').innerHTML = `
    <div class="all-regions-container">
      <div class="summary-section">
        <p>Found ${totalQueuesFound} queues across ${regions.length} regions</p>
      </div>
      ${allRegionsHtml}
    </div>
  `;
  
  // Add click handlers for the region headers (for collapsing/expanding)
  document.querySelectorAll('.region-header').forEach(header => {
    header.addEventListener('click', () => {
      const region = header.getAttribute('data-region');
      const queuesDiv = document.getElementById(`region-${region}`);
      const toggleIcon = header.querySelector('.toggle-icon');
      
      if (queuesDiv.style.display === 'none') {
        queuesDiv.style.display = 'block';
        toggleIcon.textContent = '▼';
      } else {
        queuesDiv.style.display = 'none';
        toggleIcon.textContent = '►';
      }
    });
  });
}

// Helper function to get a display name for a region
function getRegionDisplayName(regionCode) {
  const regionMap = {
    'ap-east-1': 'Asia Pacific (Hong Kong)',
    'ap-south-1': 'Asia Pacific (Mumbai)',
    'ap-northeast-1': 'Asia Pacific (Tokyo)',
    'ap-southeast-1': 'Asia Pacific (Singapore)',
    'ap-southeast-2': 'Asia Pacific (Sydney)',
    'eu-central-1': 'Europe (Frankfurt)',
    'eu-west-1': 'Europe (Ireland)',
    'eu-west-2': 'Europe (London)',
    'us-east-1': 'US East (N. Virginia)',
    'us-east-2': 'US East (Ohio)',
    'us-west-1': 'US West (N. California)',
    'us-west-2': 'US West (Oregon)'
  };
  
  return regionMap[regionCode] || regionCode;
}
