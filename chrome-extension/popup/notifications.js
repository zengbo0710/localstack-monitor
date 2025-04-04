// Simple notification system for the Chrome extension
export function showNotification(message, type = 'info') {
  // Create notification element if it doesn't exist
  let notificationContainer = document.getElementById('notificationContainer');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.bottom = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <p>${message}</p>
    </div>
  `;

  // Apply styles
  notification.style.backgroundColor = type === 'error' ? '#f8d7da' : 
                                      type === 'success' ? '#d4edda' : '#cce5ff';
  notification.style.color = type === 'error' ? '#721c24' : 
                            type === 'success' ? '#155724' : '#004085';
  notification.style.padding = '10px 15px';
  notification.style.margin = '5px 0';
  notification.style.borderRadius = '4px';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.style.transition = 'all 0.3s ease';

  // Add to container
  notificationContainer.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}
