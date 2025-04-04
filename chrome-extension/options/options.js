// Options page script for LocalStack Monitor

// Default values
const DEFAULT_ENDPOINT = 'http://localhost:4566';

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();
  
  // Initialize event listeners
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

// Load settings from Chrome storage
function loadSettings() {
  chrome.storage.local.get('localstackEndpoint', (result) => {
    document.getElementById('localstackEndpoint').value = 
      result.localstackEndpoint || DEFAULT_ENDPOINT;
  });
}

// Save settings to Chrome storage
function saveSettings() {
  const endpoint = document.getElementById('localstackEndpoint').value.trim();
  
  // Validate endpoint
  if (!endpoint) {
    alert('LocalStack endpoint cannot be empty');
    return;
  }
  
  // Save to Chrome storage
  chrome.storage.local.set({ 'localstackEndpoint': endpoint }, () => {
    // Notify background script of the change
    chrome.runtime.sendMessage({
      action: 'updateEndpoint',
      endpoint: endpoint
    });
    
    // Show notification
    showSaveNotification();
  });
}

// Show save notification
function showSaveNotification() {
  const notification = document.getElementById('saveNotification');
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}
