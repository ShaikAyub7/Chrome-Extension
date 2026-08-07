let activeDomain = null;
let lastTimestamp = 0;
let intervalId = null;
let notifiedToday = null;
let perSiteNotified = {}; // { domain: dateKey } — prevent repeat notifications

function todayKey() {
  return new Date().toDateString();
}

// ─── Core tracking ────────────────────────────────────────────────────────────
function updateTabRuntime(domain, currentTime) {
  const today = todayKey();
  const elapsed = currentTime - lastTimestamp;
  if (elapsed <= 0 || elapsed > 60000) return; // ignore gaps > 1 min

  chrome.storage.local.get(
    [today, "dailyLimitHours", "ignoreList", "siteLimits", "scheduleRule"],
    (data) => {
      const ignored = data.ignoreList || [];
      if (ignored.includes(domain)) return;

      let tabData = data[today] || {};
      if (tabData[domain]) {
        tabData[domain].runtime += elapsed;
      } else {
        tabData[domain] = { runtime: elapsed, sessions: 1 };
      }
      chrome.storage.local.set({ [today]: tabData });

      // Effective daily limit (respects schedule)
      const limitHours = getEffectiveLimit(
        data.dailyLimitHours || 6,
        data.scheduleRule,
      );
      const totalRuntime = Object.values(tabData).reduce(
        (s, d) => s + (d.runtime || 0),
        0,
      );

      checkDailyLimit(totalRuntime, limitHours);
      checkPerSiteLimit(
        domain,
        tabData[domain].runtime,
        data.siteLimits || {},
        today,
      );
    },
  );
}

// ─── Effective limit (considers schedule) ─────────────────────────────────────
function getEffectiveLimit(defaultHours, rule) {
  if (!rule || !rule.start || !rule.end || !rule.limitHours)
    return defaultHours;
  const now = new Date();
  const [sh, sm] = rule.start.split(":").map(Number);
  const [eh, em] = rule.end.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return nowMin >= startMin && nowMin < endMin ? rule.limitHours : defaultHours;
}

// ─── Daily limit notification ─────────────────────────────────────────────────
function checkDailyLimit(totalMs, limitHours) {
  const today = todayKey();
  const limitMs = limitHours * 3600000;
  if (notifiedToday === today || totalMs < limitMs) return;
  notifiedToday = today;
  chrome.notifications.create("dailyLimit", {
    type: "basic",
    iconUrl: "images/image.png",
    title: "Daily Browsing Limit Reached",
    message: `You've used your full ${limitHours}h daily limit. Time for a break!`,
    priority: 2,
  });
}

// ─── Per-site limit notification ──────────────────────────────────────────────
function checkPerSiteLimit(domain, runtimeMs, limits, today) {
  if (!limits[domain]) return;
  const capMs = limits[domain] * 60000;
  const notKey = `${domain}_${today}`;
  if (perSiteNotified[notKey] || runtimeMs < capMs) return;
  perSiteNotified[notKey] = true;
  chrome.notifications.create(`site_${domain}`, {
    type: "basic",
    iconUrl: "images/image.png",
    title: `Time limit reached: ${domain}`,
    message: `You've hit your ${limits[domain]}-minute limit for ${domain}.`,
    priority: 1,
  });
}

// ─── Focus / block mode ───────────────────────────────────────────────────────
function checkFocusBlock(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    chrome.storage.local.get("focusMode", ({ focusMode }) => {
      if (!focusMode?.active) return;
      if (Date.now() > focusMode.endTime) {
        chrome.storage.local.set({ focusMode: { active: false } });
        return;
      }
      const blocked = (focusMode.blocked || []).map((d) =>
        d.replace(/^www\./, ""),
      );
      if (blocked.some((b) => domain.includes(b) || b.includes(domain))) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            // Send a notification instead of closing (less disruptive)
            chrome.notifications.create(`block_${domain}`, {
              type: "basic",
              iconUrl: "images/image.png",
              title: "Site blocked during focus",
              message: `${domain} is blocked during your focus session.`,
              priority: 2,
            });
            // Navigate away from blocked site
            chrome.tabs.update(tabs[0].id, { url: "chrome://newtab/" });
          }
        });
      }
    });
  } catch (_) {}
}

// ─── Session counting ─────────────────────────────────────────────────────────
function incrementSession(domain) {
  const today = todayKey();
  chrome.storage.local.get(today, (data) => {
    const tabData = data[today] || {};
    if (tabData[domain]) {
      tabData[domain].sessions = (tabData[domain].sessions || 1) + 1;
    } else {
      tabData[domain] = { runtime: 0, sessions: 1 };
    }
    chrome.storage.local.set({ [today]: tabData });
  });
}

// ─── Interval tracking ────────────────────────────────────────────────────────
function startTracking() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    if (!activeDomain) return;
    const now = Date.now();
    updateTabRuntime(activeDomain, now);
    lastTimestamp = now;
  }, 1000);
}

// ─── Tab events ───────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener((info) => {
  const now = Date.now();
  if (activeDomain) updateTabRuntime(activeDomain, now);

  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    try {
      const domain = new URL(tab.url).hostname;
      if (!domain) return;
      if (domain !== activeDomain) incrementSession(domain);
      activeDomain = domain;
      lastTimestamp = now;
      startTracking();
      checkFocusBlock(tab.url);
    } catch (_) {}
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) return;
  const now = Date.now();
  try {
    const domain = new URL(tab.url).hostname;
    if (!domain) return;
    if (activeDomain && domain !== activeDomain) {
      updateTabRuntime(activeDomain, now);
    }
    if (domain !== activeDomain) incrementSession(domain);
    activeDomain = domain;
    lastTimestamp = now;
    startTracking();
    checkFocusBlock(tab.url);
  } catch (_) {}
});

chrome.tabs.onRemoved.addListener(() => {
  const now = Date.now();
  if (activeDomain) {
    updateTabRuntime(activeDomain, now);
    activeDomain = null;
    clearInterval(intervalId);
  }
});

// Reset per-site notification cache at midnight
chrome.alarms.create("midnight", {
  when: getMidnight(),
  periodInMinutes: 1440,
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "midnight") perSiteNotified = {};
});

function getMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

// Google Calendar: check every 5 min if auto-block enabled
chrome.alarms.create("calendarCheck", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "midnight") { perSiteNotified = {}; return; }
  if (alarm.name !== "calendarCheck") return;

  chrome.storage.local.get("calendarBlockEnabled", ({ calendarBlockEnabled }) => {
    if (!calendarBlockEnabled) return;
    // Signal popup to re-check (background can't import ES modules easily)
    chrome.runtime.sendMessage({ type: "CALENDAR_CHECK" }).catch(() => {});
  });
});
