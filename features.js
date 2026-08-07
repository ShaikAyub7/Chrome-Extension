// ═══════════════════════════════════════════════════════════════════════════
// features.js — Integrates Dashboard (site ordering / mini clock), Sync &
// Google Calendar modules with the popup UI.
// ═══════════════════════════════════════════════════════════════════════════

import { Dashboard }      from "./components/dashboard.js";
import { Sync }           from "./components/sync.js";
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
  // Lazy-init settings extras on settings tab
  if (tab === "settings") {
    setTimeout(renderSettingsExtras, 60);
  }
}

// ── Settings extras ──────────────────────────────────────────────────────────
function renderSettingsExtras() {
  renderPanel("syncPanel",     (el) => Sync.renderSyncPanel(el));
  renderPanel("calendarPanel", (el) => GoogleCalendar.renderCalendarPanel(el));
}

// Renders a panel once; re-renders on subsequent visits (no stale data)
const _renderedPanels = new Set();
function renderPanel(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  if (_renderedPanels.has(id)) return;
  _renderedPanels.add(id);
  fn(el);
}

// ── Summary tab: drag-sort + widget visibility ───────────────────────────────
function hookSummaryTab() {
  Dashboard.loadWidgetConfig().then((cfg) => Dashboard.applyWidgetVisibility(cfg));

  const urlList = document.getElementById("tabUrls");
  if (!urlList) return;

  let observerPaused = false; // prevent observer re-entry during applySiteOrder

  const observer = new MutationObserver(() => {
    if (observerPaused) return;

    const stamped = Dashboard.stampDomains(urlList);

    // Enable drag container exactly once
    Dashboard.enableDragSort(urlList, (newOrder) => {
      Dashboard.saveSiteOrder(newOrder);
    });

    // Apply persisted order without triggering the observer
    if (stamped || urlList.querySelectorAll("[data-domain]").length) {
      observerPaused = true;
      Dashboard.applySiteOrder(urlList);
      // Re-enable observer after current microtask queue clears
      Promise.resolve().then(() => { observerPaused = false; });
    }
  });

  observer.observe(urlList, { childList: true });
}
