// Listen for extension icon clicks
chrome.action.onClicked.addListener(() => {
  // Check if a tab with our extension page is already open
  chrome.tabs.query({
    url: chrome.runtime.getURL('popup/index.html')
  }, (tabs) => {
    if (tabs.length > 0) {
      // If tab exists, focus it
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      // Otherwise open a new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('popup/index.html')
      });
    }
  });
});
