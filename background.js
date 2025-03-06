let activeDomain = null;
let lastTimestamp = 0;
let intervalId = null;

function updateTabRuntime(domain, currentTime) {
  const today = new Date().toDateString();
  const elapsedTime = currentTime - lastTimestamp;
  chrome.storage.local.get([today], (data) => {
    let tabData = data[today] || {};

    if (elapsedTime > 0) {
      if (tabData[domain]) {
        tabData[domain].runtime += elapsedTime;
      } else {
        tabData[domain] = { runtime: elapsedTime };
      }

      // console.log(elapsedTime);
      chrome.storage.local.set({ [today]: tabData });
    }
  });
}

function startTrackingTime() {
  if (intervalId) clearInterval(intervalId);

  intervalId = setInterval(() => {
    if (activeDomain) {
      const currentTime = new Date().getTime();
      updateTabRuntime(activeDomain, currentTime);
      lastTimestamp = currentTime;
    }
  }, 100);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  const currentTime = new Date().getTime();

  if (activeDomain !== null) {
    updateTabRuntime(activeDomain, currentTime);
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      const domain = new URL(tab.url).hostname;
      activeDomain = domain;
      lastTimestamp = currentTime;

      startTrackingTime();
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const currentTime = new Date().getTime();
    const domain = new URL(tab.url).hostname;
    console.log(currentTime);

    if (activeDomain !== null && domain !== activeDomain) {
      updateTabRuntime(activeDomain, currentTime);
    }

    activeDomain = domain;
    lastTimestamp = currentTime;
    startTrackingTime();
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const currentTime = new Date().getTime();

  if (activeDomain !== null) {
    updateTabRuntime(activeDomain, currentTime);
    activeDomain = null;
    clearInterval(intervalId);
  }
});
