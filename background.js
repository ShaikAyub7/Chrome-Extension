let activeDomain = null;
let lastTimestamp = 0;

// When a tab is activated (user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  const currentTime = new Date().getTime();
  
  // Get the currently active tab details
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      const domain = new URL(tab.url).hostname;
      
      // If a different domain is activated, update the previous domain's runtime
      if (domain !== activeDomain) {
        if (activeDomain) {
          updateTabRuntime(activeDomain, currentTime);
        }

        // Set the new active domain and timestamp
        activeDomain = domain;
        lastTimestamp = currentTime;
        console.log("New Active Domain:", activeDomain);
      }
    }
  });
});

// Update the runtime for the domain
function updateTabRuntime(domain, currentTime) {
  chrome.storage.local.get("tabData", (data) => {
    let tabData = data.tabData || {};  // Initialize if undefined

    // Calculate the elapsed time
    const elapsedTime = currentTime - lastTimestamp;

    if (elapsedTime > 0) {
      // Update or initialize runtime for the domain
      if (tabData[domain]) {
        // Add the new elapsed time to the previously stored time
        tabData[domain].runtime += elapsedTime;
      } else {
        // Initialize runtime for a new domain
        tabData[domain] = { runtime: elapsedTime };
      }

      // Save updated data back to Chrome storage
      chrome.storage.local.set({ tabData }, () => {
        console.log(`Updated runtime for ${domain}: ${elapsedTime} ms`);
      });
    }
  });
}

// When a tab is updated (e.g., URL change within the same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const currentTime = new Date().getTime();
    const domain = new URL(tab.url).hostname;

    // If we're switching domains, update the previous one's runtime
    if (activeDomain !== null && domain !== activeDomain) {
      updateTabRuntime(activeDomain, currentTime);
    }

    // Set the new active domain and reset the timestamp
    activeDomain = domain;
    lastTimestamp = currentTime;
  }
});
 
 