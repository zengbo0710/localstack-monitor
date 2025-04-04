// Functions for handling S3 bucket objects

// Import from popup.js - these will be defined there
import { state, saveState, proxyRequest, LOCALSTACK_ENDPOINT } from './popup.js';

// Switch to object list view
export function showObjectListView(bucketName) {
  console.log(`Switching to object list view for bucket: ${bucketName}`);
  
  // Update state
  state.currentBucket = bucketName;
  state.viewMode = 'objectList';
  
  // Update UI
  document.getElementById('bucketListView').classList.add('hidden');
  document.getElementById('bucketObjectsView').classList.remove('hidden');
  document.getElementById('currentBucketName').textContent = bucketName;
  
  // Always fetch objects when a bucket is clicked
  // This ensures the list is always fresh when navigating to a bucket
  fetchBucketObjects(bucketName);
  
  // Save state
  saveState();
}

// Switch back to bucket list view
export function showBucketListView() {
  console.log('Switching back to bucket list view');
  
  // Update state
  state.viewMode = 'bucketList';
  
  // Update UI
  document.getElementById('bucketListView').classList.remove('hidden');
  document.getElementById('bucketObjectsView').classList.add('hidden');
  
  // Check if we need to refresh bucket data
  // If it's been more than 30 seconds since last refresh or if no data exists
  const needsRefresh = !state.bucketLastUpdated || 
    (Date.now() - state.bucketLastUpdated > 30000) || 
    state.buckets.length === 0;
  
  if (needsRefresh) {
    console.log('Refreshing bucket list after navigation');
    // Dispatch custom event to trigger bucket refresh in popup.js
    document.dispatchEvent(new CustomEvent('refreshBuckets'));
  } else {
    console.log('Using cached bucket data');
    renderBuckets();
  }
  
  // Save state
  saveState();
}

// Fetch objects from a specific bucket
export async function fetchBucketObjects(bucketName) {
  if (!bucketName) return;
  
  try {
    document.getElementById('objectsContainer').innerHTML = '<div class="loading">Loading objects...</div>';
    
    console.log(`Fetching objects for bucket: ${bucketName}`);
    
    // Create a simple AWS request signature
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8); // YYYYMMDD format
    
    // Store current bucket name in a variable for verification later
    const targetBucket = bucketName;
    
    // Make sure we're using the correct endpoint format for S3 bucket listing
    const data = await proxyRequest({
      url: `${LOCALSTACK_ENDPOINT}/${targetBucket}?list-type=2`,
      method: 'GET',
      headers: {
        'Host': `${targetBucket}.s3.amazonaws.com`,
        'X-Amz-Date': timestamp,
        'X-Amz-Content-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'Authorization': `AWS4-HMAC-SHA256 Credential=test/${date}/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f4db2c3c4df4a964d63377c903381e4b5df36db5cacaa8599f8cb6c423127721`
      }
    });
    
    console.log('Bucket objects response:', data);
    
    // Parse objects data based on response format
    let objects = [];
    
    if (typeof data === 'string' && data.includes('<?xml')) {
      // Parse XML response
      console.log('Parsing XML response for objects...');
      
      try {
        // Create a DOM parser to handle XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        
        // Verify we have the correct bucket first
        const bucketElements = xmlDoc.getElementsByTagName('Name');
        if (bucketElements.length > 0) {
          const returnedBucket = bucketElements[0].textContent;
          console.log(`XML response is for bucket: ${returnedBucket}`);
          
          if (returnedBucket !== bucketName) {
            console.warn(`Bucket name mismatch: requested ${bucketName} but got ${returnedBucket}`);
            // Try the alternative method with a delay
            setTimeout(() => fetchBucketObjectsV2(bucketName), 300);
            return;
          }
        }
        
        // Extract object information from XML
        const contentElements = xmlDoc.getElementsByTagName('Contents');
        
        for (let i = 0; i < contentElements.length; i++) {
          const keyElement = contentElements[i].getElementsByTagName('Key')[0];
          const sizeElement = contentElements[i].getElementsByTagName('Size')[0];
          const lastModifiedElement = contentElements[i].getElementsByTagName('LastModified')[0];
          
          if (keyElement) {
            objects.push({
              Key: keyElement.textContent,
              Size: sizeElement ? parseInt(sizeElement.textContent, 10) : 0,
              LastModified: lastModifiedElement ? new Date(lastModifiedElement.textContent) : new Date()
            });
          }
        }
        
        console.log(`Parsed ${objects.length} objects for bucket ${bucketName}:`, objects);
      } catch (error) {
        console.error('Error parsing XML for objects:', error);
        objects = [];
      }
    } else if (data && data.Contents) {
      // Handle JSON format
      objects = data.Contents.map(obj => ({
        Key: obj.Key,
        Size: obj.Size,
        LastModified: new Date(obj.LastModified)
      }));
    } else if (data && data.ListBucketResult && data.ListBucketResult.Contents) {
      // Handle alternative JSON format
      const contents = Array.isArray(data.ListBucketResult.Contents) 
        ? data.ListBucketResult.Contents 
        : [data.ListBucketResult.Contents];
        
      objects = contents.map(obj => ({
        Key: obj.Key,
        Size: obj.Size,
        LastModified: new Date(obj.LastModified)
      }));
    }
    
    // Verify we're displaying objects for the correct bucket
    console.log(`Received ${objects.length} objects for bucket: ${bucketName}`);
    
    // This check is now redundant since we have the check above
    // Keeping the code structure intact for backward compatibility
    if (false) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const nameElement = xmlDoc.getElementsByTagName('Name')[0];
      
      if (nameElement && nameElement.textContent !== bucketName) {
        console.warn(`Bucket name mismatch in XML: requested ${bucketName} but received ${nameElement.textContent}`);
        // Force the correct bucket by modifying the request - try a more specific approach
        state.bucketObjects = [];
        state.objectLastUpdated = Date.now();
        
        // Try the ListObjectsV2 request with proper host and query parameters
        setTimeout(() => fetchBucketObjectsV2(bucketName), 300);
        return;
      }
    }
    
    state.bucketObjects = objects;
    state.objectLastUpdated = Date.now();
    
    // Render objects and save state
    renderBucketObjects();
    saveState();
  } catch (error) {
    console.error('Objects fetch error:', error);
    document.getElementById('objectsContainer').innerHTML = `
      <div class="empty-state">
        Error fetching objects.<br>
        ${error.message}
      </div>
    `;
  }
}

// Alternative method to fetch bucket objects using a more specific approach
export async function fetchBucketObjectsV2(bucketName) {
  if (!bucketName) return;
  
  try {
    document.getElementById('objectsContainer').innerHTML = '<div class="loading">Loading objects...</div>';
    
    console.log(`Fetching objects for bucket (alt method): ${bucketName}`);
    
    // Create AWS request signature
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8); // YYYYMMDD format
    
    // Use the direct endpoint format for the bucket specifically
    // This is closer to the AWS SDK format and should work reliably with LocalStack
    const data = await proxyRequest({
      url: `${LOCALSTACK_ENDPOINT}/${bucketName}?list-type=2`,
      method: 'GET',
      headers: {
        'Host': `${bucketName}.s3.amazonaws.com`,
        'X-Amz-Date': timestamp,
        'X-Amz-Content-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'Authorization': `AWS4-HMAC-SHA256 Credential=test/${date}/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f4db2c3c4df4a964d63377c903381e4b5df36db5cacaa8599f8cb6c423127721`
      }
    });
    
    console.log('Bucket objects response (alt method):', data);
    
    // Parse objects data based on response format
    let objects = [];
    
    if (typeof data === 'string' && data.includes('<?xml')) {
      // Parse XML response
      console.log('Parsing XML response for objects...');
      
      try {
        // Create a DOM parser to handle XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        
        // Extract object information from XML
        const contentElements = xmlDoc.getElementsByTagName('Contents');
        
        for (let i = 0; i < contentElements.length; i++) {
          const keyElement = contentElements[i].getElementsByTagName('Key')[0];
          const sizeElement = contentElements[i].getElementsByTagName('Size')[0];
          const lastModifiedElement = contentElements[i].getElementsByTagName('LastModified')[0];
          
          if (keyElement) {
            objects.push({
              Key: keyElement.textContent,
              Size: sizeElement ? parseInt(sizeElement.textContent, 10) : 0,
              LastModified: lastModifiedElement ? new Date(lastModifiedElement.textContent) : new Date()
            });
          }
        }
        
        console.log(`Parsed ${objects.length} objects for bucket ${bucketName}:`, objects);
      } catch (error) {
        console.error('Error parsing XML for objects:', error);
        objects = [];
      }
    } else if (data && data.Contents) {
      // Handle JSON format
      objects = data.Contents.map(obj => ({
        Key: obj.Key,
        Size: obj.Size,
        LastModified: new Date(obj.LastModified)
      }));
    }
    
    // Only update state if we're still on the same bucket
    if (bucketName === state.currentBucket) {
      state.bucketObjects = objects;
      state.objectLastUpdated = Date.now();
      
      // Render objects and save state
      renderBucketObjects();
      saveState();
    } else {
      console.warn(`Bucket changed during fetch: was ${bucketName}, now ${state.currentBucket}`);
    }
  } catch (error) {
    console.error('Objects fetch error (alt method):', error);
    document.getElementById('objectsContainer').innerHTML = `
      <div class="empty-state">
        Error fetching objects.<br>
        ${error.message}
      </div>
    `;
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get file type icon based on extension
function getFileTypeIcon(filename) {
  if (!filename) return 'file'; // Default
  
  const extension = filename.split('.').pop().toLowerCase();
  
  const iconMap = {
    pdf: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M11 16.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm0 0V17"/><path d="M13 13.9a2 2 0 0 0-2 1.1 2 2 0 1 1-2-3 2 2 0 0 1 2 1 2 2 0 0 0 2-1 2 2 0 1 1 2 3 2 2 0 0 1-2-1.1z"/>',
    jpg: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="12" cy="14" r="3"/>',
    jpeg: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="12" cy="14" r="3"/>',
    png: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="12" cy="14" r="3"/>',
    svg: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="12" cy="14" r="3"/>',
    doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 9h1M9 13h6M9 17h6"/>',
    docx: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 9h1M9 13h6M9 17h6"/>',
    xls: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="m9 15 2-2m0 0 2-2m-2 2-2-2m2 2 2 2"/>',
    xlsx: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="m9 15 2-2m0 0 2-2m-2 2-2-2m2 2 2 2"/>',
    csv: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 17h6M9 13h6M9 9h1"/>',
    txt: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 9h6M9 13h6M9 17h6"/>',
    zip: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M12 9v4M12 17h.01"/>',
    json: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M12 12c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2zM8 12c0-1 1-2 2-2"/><path d="M8 18c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z"/>',
    mp3: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="10" cy="15" r="1"/><path d="M14 12a2 2 0 1 1 0 4"/><path d="m9 13 6-2v7"/>',
    mp4: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><circle cx="12" cy="14" r="2"/><polyline points="10 10 12 12 14 10"/>',
    html: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>',
    css: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M8 13h3m1 0h4"/><path d="M10 17h2m1 0h2"/><path d="M11 13v4"/><path d="M15 13v4"/>',
    js: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M10 13v4c0 1.5-.5 2-2 2"/><path d="M14 15c1.5 0 2 .5 2 2s-.5 2-2 2"/>'
  };
  
  return iconMap[extension] || '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>';
}

// Render bucket objects
export function renderBucketObjects() {
  const objectsContainer = document.getElementById('objectsContainer');
  const lastUpdatedElement = document.getElementById('objectLastUpdated');
  
  console.log('Rendering objects state:', state.bucketObjects);
  
  // Format last updated time
  if (state.objectLastUpdated) {
    const lastUpdated = new Date(state.objectLastUpdated).toLocaleTimeString();
    lastUpdatedElement.textContent = `Last updated: ${lastUpdated}`;
  }
  
  // Early check for empty objects
  if (!state.bucketObjects || state.bucketObjects.length === 0) {
    objectsContainer.innerHTML = '<div class="empty-state">No objects found in this bucket</div>';
    return;
  }
  
  // Show object count directly in the container
  const objectCount = state.bucketObjects.length;
  const countEl = document.createElement('div');
  countEl.className = 'item-count';
  countEl.textContent = `${objectCount} object${objectCount !== 1 ? 's' : ''} found`;
  
  // Filter objects based on search query
  let filteredObjects = state.bucketObjects;
  if (state.objectSearchQuery) {
    const query = state.objectSearchQuery.toLowerCase();
    filteredObjects = state.bucketObjects.filter(obj => 
      obj.Key && obj.Key.toLowerCase().includes(query)
    );
  }
  
  if (filteredObjects.length === 0) {
    objectsContainer.innerHTML = '<div class="empty-state">No matching objects found</div>';
    return;
  }
  
  // Create table for objects
  const table = document.createElement('table');
  table.className = 'item-table';
  
  // Create table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // Create column headers
  const nameHeader = document.createElement('th');
  nameHeader.className = 'sortable';
  nameHeader.dataset.sort = 'Key';
  nameHeader.innerHTML = `
    Name
    ${state.objectSortField === 'Key' ? 
      `<span class="sort-indicator">${state.objectSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
  `;
  
  const sizeHeader = document.createElement('th');
  sizeHeader.className = 'sortable';
  sizeHeader.dataset.sort = 'Size';
  sizeHeader.innerHTML = `
    Size
    ${state.objectSortField === 'Size' ? 
      `<span class="sort-indicator">${state.objectSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
  `;
  
  const dateHeader = document.createElement('th');
  dateHeader.className = 'sortable';
  dateHeader.dataset.sort = 'LastModified';
  dateHeader.innerHTML = `
    Last Modified
    ${state.objectSortField === 'LastModified' ? 
      `<span class="sort-indicator">${state.objectSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
  `;
  
  const actionsHeader = document.createElement('th');
  actionsHeader.textContent = 'Actions';
  
  // Add event listeners to headers for sorting
  nameHeader.addEventListener('click', () => {
    if (state.objectSortField === 'Key') {
      state.objectSortOrder = state.objectSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.objectSortField = 'Key';
      state.objectSortOrder = 'asc';
    }
    saveState();
    renderBucketObjects();
  });
  
  sizeHeader.addEventListener('click', () => {
    if (state.objectSortField === 'Size') {
      state.objectSortOrder = state.objectSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.objectSortField = 'Size';
      state.objectSortOrder = 'asc';
    }
    saveState();
    renderBucketObjects();
  });
  
  dateHeader.addEventListener('click', () => {
    if (state.objectSortField === 'LastModified') {
      state.objectSortOrder = state.objectSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      state.objectSortField = 'LastModified';
      state.objectSortOrder = 'asc';
    }
    saveState();
    renderBucketObjects();
  });
  
  // Add headers to the table
  headerRow.appendChild(nameHeader);
  headerRow.appendChild(sizeHeader);
  headerRow.appendChild(dateHeader);
  headerRow.appendChild(actionsHeader);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Sort objects
  console.log('Sorting objects with:', state.objectSortField, state.objectSortOrder);
  filteredObjects.sort((a, b) => {
    if (state.objectSortField === 'LastModified') {
      const dateA = new Date(a.LastModified).getTime();
      const dateB = new Date(b.LastModified).getTime();
      return state.objectSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else if (state.objectSortField === 'Size') {
      const sizeA = a.Size || 0;
      const sizeB = b.Size || 0;
      return state.objectSortOrder === 'asc' ? sizeA - sizeB : sizeB - sizeA;
    } else {
      // Key sorting
      const aValue = a.Key || '';
      const bValue = b.Key || '';
      
      if (state.objectSortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    }
  });
  
  // Create table body
  const tbody = document.createElement('tbody');
  
  // Create rows for each object
  filteredObjects.forEach(obj => {
    const row = document.createElement('tr');
    row.className = 'object-row';
    
    // Name cell
    const nameCell = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'object-name';
    
    // Get file name from path
    const filename = obj.Key.split('/').pop();
    const path = obj.Key.split('/').slice(0, -1).join('/');
    
    nameDiv.innerHTML = `
      <svg class="file-icon" viewBox="0 0 24 24" width="16" height="16">
        ${getFileTypeIcon(filename)}
      </svg>
      ${filename}
    `;
    
    // Add folder path if exists
    if (path) {
      const pathDiv = document.createElement('div');
      pathDiv.className = 'folder-path';
      pathDiv.textContent = path + '/';
      nameCell.appendChild(pathDiv);
    }
    
    nameCell.appendChild(nameDiv);
    
    // Size cell
    const sizeCell = document.createElement('td');
    sizeCell.textContent = formatFileSize(obj.Size || 0);
    
    // Date cell
    const dateCell = document.createElement('td');
    dateCell.textContent = new Date(obj.LastModified).toLocaleString();
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const downloadButton = document.createElement('button');
    downloadButton.className = 'download-button';
    downloadButton.title = 'Download';
    downloadButton.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    
    downloadButton.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadObject(state.currentBucket, obj.Key);
    });
    
    actionsCell.appendChild(downloadButton);
    
    // Add cells to row
    row.appendChild(nameCell);
    row.appendChild(sizeCell);
    row.appendChild(dateCell);
    row.appendChild(actionsCell);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  // Clear container and add elements
  objectsContainer.innerHTML = '';
  objectsContainer.appendChild(countEl);
  objectsContainer.appendChild(table);
}

// Function to upload a file to the current bucket
export async function uploadObject(file, bucketName) {
  if (!bucketName || !file) return;
  
  // Store the original button HTML at function scope level
  let originalHTML = '';
  
  try {
    // Show loading indicator
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
      originalHTML = uploadButton.innerHTML;
      uploadButton.innerHTML = `
        <svg class="icon loading-spinner" viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="30 60"/>
        </svg>
        Uploading...
      `;
      uploadButton.disabled = true;
    }
    
    // Create formData
    const formData = new FormData();
    formData.append('file', file);
    
    // Build the URL for the upload
    const uploadUrl = `${LOCALSTACK_ENDPOINT}/${bucketName}/${file.name}`;
    console.log('Uploading file to:', uploadUrl);
    
    // Upload the file
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-amz-acl': 'public-read' // For LocalStack compatibility
      }
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    console.log('Upload successful:', response);
    
    // Refresh the object list
    await fetchBucketObjects(bucketName);
    
    // Show success message
    alert(`File ${file.name} uploaded successfully!`);
    
    // Reset upload button
    if (uploadButton) {
      uploadButton.innerHTML = originalHTML;
      uploadButton.disabled = false;
    }
    
    // Clear the file input
    document.getElementById('fileUpload').value = '';
    
  } catch (error) {
    console.error('Upload error:', error);
    alert(`Failed to upload file: ${error.message}`);
    
    // Reset upload button
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
      uploadButton.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload File
      `;
      uploadButton.disabled = false;
    }
  }
}

// Function to handle the file upload process
export function handleFileUpload() {
  const fileInput = document.getElementById('fileUpload');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    uploadObject(file, state.currentBucket);
  } else {
    alert('Please select a file to upload');
  }
}

// Function to download an object
export async function downloadObject(bucketName, key) {
  if (!bucketName || !key) return;
  
  try {
    // Get the download button
    const buttons = document.querySelectorAll('.download-button');
    const targetButton = Array.from(buttons).find(button => {
      const row = button.closest('.object-row');
      const nameDiv = row.querySelector('.object-name');
      return nameDiv.textContent.trim() === key.split('/').pop();
    });
    
    if (targetButton) {
      // Show loading spinner
      const originalHTML = targetButton.innerHTML;
      targetButton.innerHTML = `
        <svg class="icon loading-spinner" viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="30 60"/>
        </svg>
      `;
      
      // Create a URL to directly download the file
      const downloadUrl = `${LOCALSTACK_ENDPOINT}/${bucketName}/${key}`;
      console.log('Download URL:', downloadUrl);
      
      // Create a temporary link
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = key.split('/').pop();
      a.target = '_blank'; // Open in new tab
      
      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Restore button
      setTimeout(() => {
        targetButton.innerHTML = originalHTML;
      }, 1000);
    }
  } catch (error) {
    console.error('Download error:', error);
    alert(`Failed to download object: ${error.message}`);
  }
}
