let activeDomain = null;
let lastTimestamp = 0;
chrome.tabs.onActivated.addListener((activeInfo) => {
  const currentTime = new Date().getTime();
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      const domain = new URL(tab.url).hostname;
      console.log(domain);
      if (domain) {
        activeDomain = domain;
        lastTimestamp = currentTime;
        console.log("lastTimeStamp", lastTimestamp);
        console.log("currentTime", currentTime);
        console.log("activeDomain", activeDomain);
      }
    }
  });
  console.log(currentTime);
});
function updateTabRuntime(domain, currentTime) {
  chrome.storage.local.get("tabData", (data) => {
    let tabData = data.tabData;
    const elaspedTime = currentTime - lastTimestamp;
    console.log(elaspedTime);
    if (elaspedTime > 0) {
      if (tabData[domain]) {
        tabData[domain].runtime += elaspedTime;
      } else {
        tabData[domain] = { runtime: elaspedTime };
      }
      chrome.storage.local.set({ tabData });
    }

    console.log(tabData);
  });
}
chrome.tabs.onUpdated.addListener((changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const currentTime = new Date().getTime();
    const domain = new URL(tab.url).hostname;
    if (activeDomain !== null && domain !== activeDomain) {
      updateTabRuntime(activeDomain, currentTime);
    }
    if (domain) {
      activeDomain = domain;
      lastTimestamp = currentTime;
      console.log("dsde", lastTimestamp);
      console.log("currentTime", currentTime);
      console.log("activeDomain", activeDomain);
    }
  }
});
