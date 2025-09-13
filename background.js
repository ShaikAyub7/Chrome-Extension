let activeDomain = null;
let lastTimestamp = 0;
let intervalId = null;

function updateTabRuntime(domain, currentTime) {
  const today = new Date().toDateString();
  const elapsedTime = currentTime - lastTimestamp;

  if (elapsedTime <= 0) return;

  chrome.storage.local.get([today], (data) => {
    let tabData = data[today] || {};

    if (tabData[domain]) {
      tabData[domain].runtime += elapsedTime;
    } else {
      tabData[domain] = { runtime: elapsedTime };
    }

    chrome.storage.local.set({ [today]: tabData });
  });
}

function startTrackingTime() {
  if (intervalId) clearInterval(intervalId);

  intervalId = setInterval(() => {
    if (!activeDomain) return;
    const currentTime = Date.now();
    updateTabRuntime(activeDomain, currentTime);
    lastTimestamp = currentTime;
  }, 100);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  const currentTime = Date.now();

  if (activeDomain) {
    updateTabRuntime(activeDomain, currentTime);
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url && tab.active) {
      const domain = new URL(tab.url).hostname;
      activeDomain = domain;
      lastTimestamp = currentTime;
      startTrackingTime();
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  const currentTime = Date.now();
  const domain = new URL(tab.url).hostname;

  if (activeDomain && domain !== activeDomain) {
    updateTabRuntime(activeDomain, currentTime);
  }

  activeDomain = domain;
  lastTimestamp = currentTime;
  startTrackingTime();
});

// chrome.tabs.onRemoved.addListener(() => {
//   const currentTime = Date.now();

//   if (activeDomain) {
//     updateTabRuntime(activeDomain, currentTime);
//     activeDomain = null;
//     clearInterval(intervalId);
//   }
// });

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "CLOSE_TAB") {
//     if (sender.tab && sender.tab.id) {
//       chrome.tabs.remove(sender.tab.id);
//     } else {
//       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         if (tabs[0]?.id) chrome.tabs.remove(tabs[0].id);
//       });
//     }
//   }
// });
