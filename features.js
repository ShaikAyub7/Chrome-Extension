import { Dashboard } from "./components/dashboard.js";
import { Sync } from "./components/sync.js";
import { GoogleCalendar } from "./components/google-calendar.js";

document.addEventListener("DOMContentLoaded", () => {
  Dashboard.initMiniClock();

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", handleTabClick);
  });

  hookSummaryTab();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CALENDAR_CHECK") GoogleCalendar.checkAndBlock();
  });
});

function handleTabClick(e) {
  const tab = e.currentTarget.dataset.tab;
  if (tab === "settings") {
    setTimeout(renderSettingsExtras, 60);
  }
}

function renderSettingsExtras() {
  renderPanel("syncPanel", (el) => Sync.renderSyncPanel(el));
  renderPanel("calendarPanel", (el) => GoogleCalendar.renderCalendarPanel(el));
}

const _renderedPanels = new Set();
function renderPanel(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  if (_renderedPanels.has(id)) return;
  _renderedPanels.add(id);
  fn(el);
}

function hookSummaryTab() {
  Dashboard.loadWidgetConfig().then((cfg) =>
    Dashboard.applyWidgetVisibility(cfg),
  );

  const urlList = document.getElementById("tabUrls");
  if (!urlList) return;

  let observerPaused = false;

  const observer = new MutationObserver(() => {
    if (observerPaused) return;

    const stamped = Dashboard.stampDomains(urlList);

    Dashboard.enableDragSort(urlList, (newOrder) => {
      Dashboard.saveSiteOrder(newOrder);
    });

    if (stamped || urlList.querySelectorAll("[data-domain]").length) {
      observerPaused = true;
      Dashboard.applySiteOrder(urlList);
      Promise.resolve().then(() => {
        observerPaused = false;
      });
    }
  });

  observer.observe(urlList, { childList: true });
}
