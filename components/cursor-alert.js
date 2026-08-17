(function () {
  "use strict";

  if (window.top !== window.self) return;
  if (typeof chrome === "undefined" || !chrome.storage) return;

  const POLL_MS = 4000;
  const WARN_AT = 0.6;
  const DANGER_AT = 1.0;

  let enabled = true;
  let proximity = 0;
  let haloEl = null;
  let mouseX = -9999;
  let mouseY = -9999;
  let hasMouse = false;

  function todayKey() {
    return new Date().toDateString();
  }

  function domainMatches(hostname, typed) {
    if (!typed) return false;
    const a = hostname.replace(/^www\./, "").toLowerCase();
    const b = typed
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .replace(/^www\./, "")
      .toLowerCase();
    return a === b;
  }

  function computeProximity(callback) {
    const today = todayKey();
    chrome.storage.local.get(
      [
        today,
        "siteLimits",
        "dailyLimitHours",
        "ignoreList",
        "cursorAlertEnabled",
      ],
      (data) => {
        if (chrome.runtime.lastError) return callback(0);

        enabled = data.cursorAlertEnabled !== false;
        if (!enabled) return callback(0);

        const hostname = location.hostname;
        if (!hostname) return callback(0);

        const ignoreList = data.ignoreList || [];
        if (ignoreList.some((d) => domainMatches(hostname, d))) {
          return callback(0);
        }

        const tabData = data[today] || {};
        const usedForSite =
          (tabData[hostname] && tabData[hostname].runtime) || 0;

        let siteProximity = 0;
        const siteLimits = data.siteLimits || {};
        for (const key in siteLimits) {
          if (domainMatches(hostname, key)) {
            const limitMs = (siteLimits[key] || 0) * 60000;
            if (limitMs > 0) {
              siteProximity = Math.max(siteProximity, usedForSite / limitMs);
            }
          }
        }

        const dailyLimitMs = (data.dailyLimitHours || 6) * 3600000;
        const totalUsed = Object.values(tabData).reduce(
          (sum, d) => sum + ((d && d.runtime) || 0),
          0,
        );
        const dailyProximity = dailyLimitMs > 0 ? totalUsed / dailyLimitMs : 0;

        callback(Math.max(siteProximity, dailyProximity));
      },
    );
  }

  function ensureHalo() {
    if (haloEl && haloEl.isConnected) return haloEl;
    haloEl = document.createElement("div");
    haloEl.id = "__tab-time-tracker-cursor-glow__";
    Object.assign(haloEl.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0px",
      height: "0px",
      borderRadius: "50%",
      pointerEvents: "none",
      zIndex: "2147483647",
      transform: "translate(-50%, -50%)",
      willChange: "transform, opacity, width, height, box-shadow",
    });
    (document.body || document.documentElement).appendChild(haloEl);
    return haloEl;
  }

  function removeHalo() {
    if (haloEl) {
      haloEl.remove();
      haloEl = null;
    }
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouse = true;
    },
    { passive: true },
  );

  function tick() {
    requestAnimationFrame(tick);

    if (!enabled || proximity < WARN_AT || !hasMouse) {
      removeHalo();
      return;
    }

    const el = ensureHalo();
    const t = performance.now() / 1000;

    const climb = Math.min(
      Math.max((proximity - WARN_AT) / (DANGER_AT - WARN_AT), 0),
      1,
    );
    const over = Math.min(Math.max(proximity - DANGER_AT, 0), 1);

    const freq = 0.5 + climb * 2 + over * 3.5; // Hz
    const pulse = (Math.sin(t * Math.PI * 2 * freq) + 1) / 2; // 0..1

    const size = 24 + climb * 16 + over * 12 + pulse * 10;
    const blur = 12 + climb * 16 + over * 10 + pulse * 10;
    const coreOpacity = 0.15 + climb * 0.35 + over * 0.2 + pulse * 0.3;
    const glowOpacity = 0.25 + climb * 0.35 + over * 0.25 + pulse * 0.3;

    const g = Math.max(0, Math.round(120 - climb * 100 - over * 20));
    const b = Math.max(0, Math.round(90 - climb * 80 - over * 20));

    el.style.left = mouseX + "px";
    el.style.top = mouseY + "px";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.background = `radial-gradient(circle, rgba(255,${g},${b},${Math.min(
      coreOpacity,
      0.9,
    )}) 0%, rgba(255,${g},${b},0) 70%)`;
    el.style.boxShadow = `0 0 ${blur}px ${blur / 2}px rgba(255,${g},${b},${Math.min(
      glowOpacity,
      0.85,
    )})`;
  }

  function poll() {
    computeProximity((p) => {
      proximity = p;
    });
  }

  poll();
  setInterval(poll, POLL_MS);
  requestAnimationFrame(tick);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (
      changes[todayKey()] ||
      changes.siteLimits ||
      changes.dailyLimitHours ||
      changes.ignoreList ||
      changes.cursorAlertEnabled
    ) {
      poll();
    }
  });
})();
