document.addEventListener("DOMContentLoaded", async () => {
  let current = dayjs();
  let chartInstance = null;

  // ─── init ────────────────────────────────────────────────────────────────
  initApp();

  function initApp() {
    setupTabs();
    setupTheme();
    setupSlider();
    setupCalendar();
    setupDeleteBtn();
    setupSettingsHandlers();
    setupFocusHandlers();
    setupExport();

    renderSummary(current.format("ddd MMM DD YYYY"));

    setInterval(() => {
      renderSummary(current.format("ddd MMM DD YYYY"));
    }, 5000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB SWITCHING
  // ═══════════════════════════════════════════════════════════════════════════
  function setupTabs() {
    document.getElementById("openDashboard")?.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".tab-panel")
          .forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        document
          .getElementById(`tab-${btn.dataset.tab}`)
          .classList.remove("hidden");
        if (btn.dataset.tab === "analytics") renderAnalytics();
        if (btn.dataset.tab === "settings") renderSettings();
        if (btn.dataset.tab === "focus") renderFocus();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════════════════
  function setupTheme() {
    const toggle = document.getElementById("toggleTheme");
    chrome.storage.local.get("theme", ({ theme }) => {
      const dark = theme === "dark";
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
      if (toggle) toggle.checked = dark;
    });
    toggle?.addEventListener("change", () => {
      const dark = toggle.checked;
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
      chrome.storage.local.set({ theme: dark ? "dark" : "light" });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  function setupCalendar() {
    document
      .getElementById("calendarInput")
      ?.addEventListener("change", (e) => {
        current = dayjs(e.target.value);
        renderSummary(current.format("ddd MMM DD YYYY"));
      });
  }

  function setupSlider() {
    const slider = document.getElementById("dailyLimitSlider");
    const label = document.getElementById("dailyLimitValue");
    chrome.storage.local.get("dailyLimitHours", ({ dailyLimitHours }) => {
      const h = dailyLimitHours || 6;
      if (slider) slider.value = h;
      if (label) label.textContent = `${h}h`;
    });
    slider?.addEventListener("input", () => {
      const h = parseInt(slider.value);
      chrome.storage.local.set({ dailyLimitHours: h });
      if (label) label.textContent = `${h}h`;
      renderSummary(current.format("ddd MMM DD YYYY"));
    });
  }

  function setupDeleteBtn() {
    document.querySelector(".delete-data")?.addEventListener("click", () => {
      const key = current.format("ddd MMM DD YYYY");
      if (!confirm("Delete data for this day?")) return;
      chrome.storage.local.remove(key, () => renderSummary(key));
    });
  }

  function renderSummary(dateKey) {
    document.getElementById("selectedDate").textContent = dateKey;
    chrome.storage.local.get(
      [dateKey, "dailyLimitHours", "ignoreList"],
      (data) => {
        const tabData = data[dateKey] || {};
        const limitHours = data.dailyLimitHours || 6;
        const ignored = data.ignoreList || [];
        const filtered = Object.fromEntries(
          Object.entries(tabData).filter(([d]) => !ignored.includes(d)),
        );

        const urlList = document.getElementById("tabUrls");
       
        urlList.innerHTML = "";

        const domains = Object.keys(filtered);
        const totalDom = document.querySelector(".totalDomains");

        if (!domains.length) {
          document.querySelector(".totalTimeDisplay").innerHTML =
            `<p class="total-day-heading">Today's Total:</p>0h 0m 0s`;
          urlList.innerHTML = `<p style="color:var(--text-muted);font-size:1.2rem;padding:8px">No data yet.</p>`;
          totalDom.innerHTML = `<i class="fa-regular fa-folder-open"></i> 0`;
          updateLimitUI(0, limitHours);
          return;
        }

        totalDom.innerHTML = `<i class="fa-regular fa-folder-open"></i> ${domains.length}`;
        const limitMs = limitHours * 3600000;
        let total = 0;
        const chartLabels = [],
          chartData = [];

        domains.forEach((domain) => {
          const { runtime = 0, sessions = 1 } = filtered[domain];
          total += runtime;
          const pct = Math.min(Math.round((runtime / limitMs) * 100), 100);
          const short = domain.length > 28 ? domain.slice(0, 28) + "..." : domain;
          urlList.insertAdjacentHTML(
            "beforeend",
            `
          <div class="site-usage-box">
            <img src="${logoUrl(domain)}" class="site-logo" alt=""
              onerror="this.src='https://unavatar.io/${domain}'"/>
            <div style="flex:1;min-width:0">
              <div class="site-info">
                <div class="site-meta">
                  <div class="site-domain">
                    <a href="https://${domain}" target="_blank" title="${domain}">${short}</a>
                  </div>
                </div>
                <div class="site-duration">${fmtMs(runtime)}</div>
              </div>
              <div class="site-progress">
                <div class="site-bar"><div class="site-bar-fill" style="width:${pct}%"></div></div>
              </div>
              <div class="site-row-bottom">
                <span class="site-sessions">${sessions} session(s)</span>
                <span class="site-percent">${pct}%</span>
              </div>
            </div>
          </div>`,
          );
          chartLabels.push(domain);
          chartData.push(runtime / 60000);
        });

        document.querySelector(".totalTimeDisplay").innerHTML =
          `<p class="total-day-heading">Today's Total:</p>${fmtMs(total)}`;
        updateLimitUI(total, limitHours);
        renderStreakBadge(total, limitHours);
        renderPieChart(chartLabels, chartData);
        renderHeatmap();
      },
    );
  }

  function updateLimitUI(ms, limitHours) {
    const pct = Math.min(Math.round((ms / (limitHours * 3600000)) * 100), 100);
    const h = Math.floor(limitHours),
      m = Math.round((limitHours % 1) * 60);
    document.querySelector(".percentage-text").textContent = `${pct}%`;
    document
      .querySelector(".circle")
      ?.setAttribute("stroke-dasharray", `${pct},100`);
    const ld = document.getElementById("limitDisplay");
    if (ld) ld.textContent = `${pct}% of ${h}h${m ? ` ${m}m` : ""}`;
    document.querySelector(".limit-text")?.classList.toggle("red", pct >= 100);
    const ab = document.getElementById("alertBox");
    if (pct >= 100) {
      ab.textContent = "⚠️ Daily browsing limit reached!";
      ab.classList.remove("hidden");
    } else ab.classList.add("hidden");
  }

  function renderPieChart(labels, data) {
    const ctx = document.getElementById("myChart")?.getContext("2d");
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    const colors = labels.map((_, i) => COLORS[i % COLORS.length]);
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 1.5,
            borderRadius: 4,
            borderColor: isDark ? "#18181b" : "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (t) => {
                const h = Math.floor(t.raw / 60),
                  m = Math.floor(t.raw % 60);
                return `${t.label}: ${h}h ${m}m`;
              },
            },
          },
        },
      },
      plugins: [
        {
          id: "center",
          beforeDraw(chart) {
            const {
              width,
              chartArea: { top, bottom },
            } = chart;
            chart.ctx.save();
            const tot = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const h = Math.floor(tot / 60),
              m = Math.floor(tot % 60);
            chart.ctx.font = "bold 13px Inter,sans-serif";
            chart.ctx.fillStyle = isDark ? "#fafafa" : "#18181b";
            chart.ctx.textAlign = "center";
            chart.ctx.textBaseline = "middle";
            chart.ctx.fillText(`${h}h ${m}m`, width / 2, (top + bottom) / 2);
            chart.ctx.restore();
          },
        },
      ],
    });
  
  }

  function renderHeatmap() {
    const grid = document.getElementById("heatmapGrid");
    if (!grid) return;
    const keys = getLastNDayKeys(35).reverse();
    chrome.storage.local.get(keys, (data) => {
      const totals = keys.map((k) =>
        Object.values(data[k] || {}).reduce((s, d) => s + (d.runtime || 0), 0),
      );
      const max = Math.max(...totals, 1);
      grid.innerHTML = keys
        .map((k, i) => {
          const ms = totals[i],
            lv =
              ms === 0
                ? 0
                : ms < max * 0.25
                  ? 1
                  : ms < max * 0.5
                    ? 2
                    : ms < max * 0.75
                      ? 3
                      : 4;
          const tip = `${dayjs(k, "ddd MMM DD YYYY").format("MMM D")}: ${fmtMsShort(ms)}`;
          return `<div class="heatmap-cell s${lv}" data-tip="${tip}" title="${tip}"></div>`;
        })
        .join("");
    });
  }

  function renderStreakBadge(todayMs, limitHours) {
    const limitMs = limitHours * 3600000,
      days = getLastNDayKeys(30);
    chrome.storage.local.get(days, (data) => {
      let streak = 0;
      for (const k of days) {
        const t = Object.values(data[k] || {}).reduce(
          (s, d) => s + (d.runtime || 0),
          0,
        );
        if (t > 0 && t <= limitMs) streak++;
        else if (t > limitMs) break;
      }
      const sb = document.getElementById("streakBadge");
      if (sb)
        sb.innerHTML = `<i class="fa-solid fa-fire"></i> ${streak} day streak`;
      const sc = document.getElementById("streakCount");
      if (sc) sc.textContent = streak;
      const gs = document.getElementById("goalStatus");
      if (gs) {
        gs.textContent = todayMs <= limitMs ? "✓ On track" : "Over limit";
        gs.className =
          "goal-status " + (todayMs <= limitMs ? "on-track" : "over");
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  let analyticsPeriod = 7,
    analyticsChart = null;

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".period-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      analyticsPeriod = parseInt(btn.dataset.period);
      renderAnalytics();
    });
  });

  function renderAnalytics() {
    const keys = getLastNDayKeys(analyticsPeriod).reverse();
    chrome.storage.local.get([...keys, "siteLabels", "ignoreList"], (data) => {
      const ignored = data.ignoreList || [],
        labels = data.siteLabels || {};
      const dayTotals = keys.map((k) =>
        Object.entries(data[k] || {})
          .filter(([d]) => !ignored.includes(d))
          .reduce((s, [, v]) => s + (v.runtime || 0), 0),
      );
      const domainTotals = {};
      keys.forEach((k) =>
        Object.entries(data[k] || {}).forEach(([dom, v]) => {
          if (ignored.includes(dom)) return;
          domainTotals[dom] = (domainTotals[dom] || 0) + (v.runtime || 0);
        }),
      );
      renderAnalyticsChart(keys, dayTotals);
      renderLeaderboard(domainTotals);
      renderProductivity(domainTotals, labels);
    });
  }

  function renderAnalyticsChart(keys, totals) {
    const ctx = document.getElementById("analyticsChart")?.getContext("2d");
    if (!ctx) return;
    if (analyticsChart) analyticsChart.destroy();
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    analyticsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: keys.map((k) => dayjs(k, "ddd MMM DD YYYY").format("MMM D")),
        datasets: [
          {
            data: totals.map((ms) => +(ms / 3600000).toFixed(2)),
            backgroundColor: isDark ? "#4f46e5" : "#818cf8",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: {
              color: isDark ? "#a1a1aa" : "#71717a",
              font: { size: 10 },
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: isDark ? "#a1a1aa" : "#71717a",
              font: { size: 10 },
              callback: (v) => `${v}h`,
            },
            grid: { color: isDark ? "#27272a" : "#f4f4f5" },
          },
        },
      },
    });
  }

  function renderLeaderboard(domainTotals) {
    const lb = document.getElementById("leaderboard");
    if (!lb) return;
    lb.innerHTML = Object.entries(domainTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(
        ([dom, ms], i) => `
      <div class="leaderboard-item">
        <span class="lb-rank">${i + 1}</span>
        <img class="lb-logo" src="${logoUrl(dom)}" alt="" onerror="this.src='https://unavatar.io/${dom}'"/>
        <span class="lb-domain" title="${dom}">${dom.length > 22 ? dom.slice(0, 22) + "..." : dom}</span>
        <span class="lb-time">${fmtMsShort(ms)}</span>
      </div>`,
      )
      .join("");
  }

  function renderProductivity(domainTotals, labels) {
    const total = Object.values(domainTotals).reduce((s, v) => s + v, 0) || 1;
    let p = 0,
      n = 0,
      d = 0;
    Object.entries(domainTotals).forEach(([dom, ms]) => {
      const l = labels[dom] || "neutral";
      if (l === "productive") p += ms;
      else if (l === "distracting") d += ms;
      else n += ms;
    });
    const score = Math.round((p / total) * 100);
    const pctP = Math.round((p / total) * 100),
      pctN = Math.round((n / total) * 100),
      pctD = Math.round((d / total) * 100);
    const se = document.getElementById("prodScore");
    if (se) se.textContent = `${score}%`;
    const be = document.getElementById("prodBars");
    if (!be) return;
    be.innerHTML = `
      <div class="prod-bar-row"><span class="prod-bar-label">Productive</span><div class="prod-bar-track"><div class="prod-bar-fill productive" style="width:${pctP}%"></div></div><span class="prod-bar-pct">${pctP}%</span></div>
      <div class="prod-bar-row"><span class="prod-bar-label">Neutral</span><div class="prod-bar-track"><div class="prod-bar-fill neutral" style="width:${pctN}%"></div></div><span class="prod-bar-pct">${pctN}%</span></div>
      <div class="prod-bar-row"><span class="prod-bar-label">Distracting</span><div class="prod-bar-track"><div class="prod-bar-fill distracting" style="width:${pctD}%"></div></div><span class="prod-bar-pct">${pctD}%</span></div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS
  // ═══════════════════════════════════════════════════════════════════════════
  let pomoMin = 25,
    pomoSec = 0,
    pomoInterval = null,
    pomoRunning = false;

  function setupFocusHandlers() {
    const cursorAlertToggle = document.getElementById("cursorAlertToggle");
    chrome.storage.local.get("cursorAlertEnabled", ({ cursorAlertEnabled }) => {
      if (cursorAlertToggle) cursorAlertToggle.checked = cursorAlertEnabled !== false;
    });
    cursorAlertToggle?.addEventListener("change", () => {
      chrome.storage.local.set({ cursorAlertEnabled: cursorAlertToggle.checked });
    });

    document.querySelectorAll(".pomo-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (pomoRunning) return;
        document
          .querySelectorAll(".pomo-preset")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        pomoMin = parseInt(btn.dataset.min);
        pomoSec = 0;
        updatePomoDisplay();
      });
    });

    document.getElementById("pomoStart")?.addEventListener("click", () => {
      if (pomoRunning) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        document.getElementById("pomoStart").innerHTML =
          '<i class="fa-solid fa-play"></i> Start';
        document.getElementById("pomoTimer").className = "pomo-timer";
        setPomoStatus("", "Paused");
        return;
      }
      pomoRunning = true;
      document.getElementById("pomoStart").innerHTML =
        '<i class="fa-solid fa-pause"></i> Pause';
      document.getElementById("pomoTimer").className = "pomo-timer running";
      setPomoStatus("running", "Focus session running...");
      chrome.storage.local.get("blockSites", ({ blockSites }) => {
        chrome.storage.local.set({
          focusMode: {
            active: true,
            endTime: Date.now() + (pomoMin * 60 + pomoSec) * 1000,
            blocked: blockSites || [],
          },
        });
      });
      pomoInterval = setInterval(() => {
        if (pomoSec === 0) {
          if (pomoMin === 0) {
            clearInterval(pomoInterval);
            pomoRunning = false;
            document.getElementById("pomoStart").innerHTML =
              '<i class="fa-solid fa-play"></i> Start';
            document.getElementById("pomoTimer").className = "pomo-timer done";
            setPomoStatus("done", "🎉 Session complete!");
            chrome.storage.local.set({ focusMode: { active: false } });
            return;
          }
          pomoMin--;
          pomoSec = 59;
        } else pomoSec--;
        updatePomoDisplay();
      }, 1000);
    });

    document.getElementById("pomoReset")?.addEventListener("click", () => {
      clearInterval(pomoInterval);
      pomoRunning = false;
      const a = document.querySelector(".pomo-preset.active");
      pomoMin = a ? parseInt(a.dataset.min) : 25;
      pomoSec = 0;
      updatePomoDisplay();
      document.getElementById("pomoStart").innerHTML =
        '<i class="fa-solid fa-play"></i> Start';
      document.getElementById("pomoTimer").className = "pomo-timer";
      setPomoStatus("", "Ready to focus");
      chrome.storage.local.set({ focusMode: { active: false } });
    });

    document.getElementById("addBlockSite")?.addEventListener("click", () => {
      const inp = document.getElementById("blockSiteInput");
      const domain = inp.value
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (!domain) return;
      chrome.storage.local.get("blockSites", ({ blockSites }) => {
        const list = blockSites || [];
        if (list.includes(domain)) return;
        list.push(domain);
        chrome.storage.local.set({ blockSites: list }, () => {
          inp.value = "";
          renderBlockList(list);
        });
      });
    });

    document.getElementById("addSiteLimit")?.addEventListener("click", () => {
      const dom = document
        .getElementById("siteLimitDomain")
        .value.trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      const min = parseInt(document.getElementById("siteLimitMin").value);
      if (!dom || !min) return;
      chrome.storage.local.get("siteLimits", ({ siteLimits }) => {
        const limits = { ...(siteLimits || {}) };
        limits[dom] = min;
        chrome.storage.local.set({ siteLimits: limits }, () => {
          document.getElementById("siteLimitDomain").value = "";
          document.getElementById("siteLimitMin").value = "";
          renderSiteLimitList(limits);
        });
      });
    });

    document.getElementById("saveSchedule")?.addEventListener("click", () => {
      const lh = parseInt(document.getElementById("workLimitHours").value);
      const s = document.getElementById("workStart").value;
      const e = document.getElementById("workEnd").value;
      if (!lh || !s || !e) return;
      chrome.storage.local.set(
        { scheduleRule: { limitHours: lh, start: s, end: e } },
        () => {
          const el = document.getElementById("scheduleStatus");
          if (el) {
            el.textContent = "✓ Saved";
            setTimeout(() => (el.textContent = ""), 2000);
          }
        },
      );
    });
  }

  function renderFocus() {
    chrome.storage.local.get(
      ["blockSites", "siteLimits", "scheduleRule"],
      (data) => {
        renderBlockList(data.blockSites || []);
        renderSiteLimitList(data.siteLimits || {});
        const r = data.scheduleRule || {};
        const wlh = document.getElementById("workLimitHours");
        if (wlh) wlh.value = r.limitHours || "";
        const ws = document.getElementById("workStart");
        if (ws) ws.value = r.start || "09:00";
        const we = document.getElementById("workEnd");
        if (we) we.value = r.end || "17:00";
      },
    );
  }

  function updatePomoDisplay() {
    const e = document.getElementById("pomoTimer");
    if (e)
      e.textContent = `${String(pomoMin).padStart(2, "0")}:${String(pomoSec).padStart(2, "0")}`;
  }
  function setPomoStatus(cls, txt) {
    const e = document.getElementById("pomoStatus");
    if (e) {
      e.textContent = txt;
      e.className = "pomo-status " + cls;
    }
  }

  function renderBlockList(list) {
    const ul = document.getElementById("blockSiteList");
    if (!ul) return;
    ul.innerHTML = list
      .map(
        (d) => `<li class="tag-item">${d}<button data-d="${d}">✕</button></li>`,
      )
      .join("");
    ul.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        chrome.storage.local.get("blockSites", ({ blockSites }) => {
          const u = (blockSites || []).filter((x) => x !== btn.dataset.d);
          chrome.storage.local.set({ blockSites: u }, () => renderBlockList(u));
        });
      }),
    );
  }

  function renderSiteLimitList(limits) {
    const ul = document.getElementById("siteLimitList");
    if (!ul) return;
    const today = current.format("ddd MMM DD YYYY");
    chrome.storage.local.get(today, (data) => {
      const td = data[today] || {};
      ul.innerHTML = Object.entries(limits)
        .map(([dom, cap]) => {
          const used = Math.floor((td[dom]?.runtime || 0) / 60000),
            over = used >= cap;
          return `<li class="site-limit-item">
          <img src="${logoUrl(dom)}" style="width:16px;height:16px;border-radius:3px" alt="" onerror="this.src='https://unavatar.io/${dom}'"/>
          <span class="site-limit-domain">${dom}</span>
          <span class="site-limit-cap ${over ? "red" : ""}">${used}/${cap}m</span>
          <button data-d="${dom}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1.2rem">✕</button>
        </li>`;
        })
        .join("");
      ul.querySelectorAll("button").forEach((btn) =>
        btn.addEventListener("click", () => {
          chrome.storage.local.get("siteLimits", ({ siteLimits }) => {
            const u = { ...siteLimits };
            delete u[btn.dataset.d];
            chrome.storage.local.set({ siteLimits: u }, () =>
              renderSiteLimitList(u),
            );
          });
        }),
      );
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupSettingsHandlers() {
    document.getElementById("addIgnore")?.addEventListener("click", () => {
      const inp = document.getElementById("ignoreInput");
      const domain = inp.value
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (!domain) return;
      chrome.storage.local.get("ignoreList", ({ ignoreList }) => {
        const list = ignoreList || [];
        if (list.includes(domain)) return;
        list.push(domain);
        chrome.storage.local.set({ ignoreList: list }, () => {
          inp.value = "";
          renderIgnoreList(list);
        });
      });
    });
  }

  function renderSettings() {
    const today = current.format("ddd MMM DD YYYY");
    chrome.storage.local.get(
      [today, "ignoreList", "siteLabels", "dailyLimitHours"],
      (data) => {
        const tabData = data[today] || {},
          ignored = data.ignoreList || {},
          siteLabels = data.siteLabels || {},
          limitH = data.dailyLimitHours || 6;
        const sl = document.getElementById("dailyLimitSlider");
        if (sl) sl.value = limitH;
        const lv = document.getElementById("dailyLimitValue");
        if (lv) lv.textContent = `${limitH}h`;
        const days = getLastNDayKeys(30);
        chrome.storage.local.get(days, (dayData) => {
          const limitMs = limitH * 3600000;
          let streak = 0;
          for (const k of days) {
            const t = Object.values(dayData[k] || {}).reduce(
              (s, d) => s + (d.runtime || 0),
              0,
            );
            if (t > 0 && t <= limitMs) streak++;
            else if (t > limitMs) break;
          }
          const sc = document.getElementById("streakCount");
          if (sc) sc.textContent = streak;
        });
        renderIgnoreList(data.ignoreList || []);
        renderSiteLabels(tabData, siteLabels);
      },
    );
  }

  function renderIgnoreList(list) {
    const ul = document.getElementById("ignoreList");
    if (!ul) return;
    ul.innerHTML = list
      .map(
        (d) => `<li class="tag-item">${d}<button data-d="${d}">✕</button></li>`,
      )
      .join("");
    ul.querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => {
        chrome.storage.local.get("ignoreList", ({ ignoreList }) => {
          const u = (ignoreList || []).filter((x) => x !== btn.dataset.d);
          chrome.storage.local.set({ ignoreList: u }, () =>
            renderIgnoreList(u),
          );
        });
      }),
    );
  }

  function renderSiteLabels(tabData, savedLabels) {
    const c = document.getElementById("siteLabels");
    if (!c) return;
    const domains = Object.keys(tabData);
    if (!domains.length) {
      c.innerHTML = `<p style="color:var(--text-muted);font-size:1.2rem">No sites tracked today yet.</p>`;
      return;
    }
    c.innerHTML = domains
      .map(
        (dom) => `
      <div class="site-label-row">
        <img src="${logoUrl(dom)}" style="width:16px;height:16px;border-radius:3px" alt="" onerror="this.src='https://unavatar.io/${dom}'"/>
        <span class="site-label-domain" title="${dom}">${dom}</span>
        <select class="label-select" data-domain="${dom}">
          <option value="productive"  ${savedLabels[dom] === "productive" ? "selected" : ""}>Productive</option>
          <option value="neutral"     ${!savedLabels[dom] || savedLabels[dom] === "neutral" ? "selected" : ""}>Neutral</option>
          <option value="distracting" ${savedLabels[dom] === "distracting" ? "selected" : ""}>Distracting</option>
        </select>
      </div>`,
      )
      .join("");
    c.querySelectorAll(".label-select").forEach((sel) =>
      sel.addEventListener("change", () => {
        chrome.storage.local.get("siteLabels", ({ siteLabels }) => {
          const u = siteLabels || {};
          u[sel.dataset.domain] = sel.value;
          chrome.storage.local.set({ siteLabels: u });
        });
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  function setupExport() {
    document.getElementById("exportCSV")?.addEventListener("click", () => {
      const keys = getLastNDayKeys(90).reverse();
      chrome.storage.local.get(keys, (data) => {
        let csv = "Date,Domain,Runtime (ms),Runtime (min),Sessions\n";
        keys.forEach((k) =>
          Object.entries(data[k] || {}).forEach(([dom, v]) => {
            csv += `"${k}","${dom}",${v.runtime},${(v.runtime / 60000).toFixed(1)},${v.sessions || 1}\n`;
          }),
        );
        download("tab-tracker.csv", csv, "text/csv");
      });
    });

    document.getElementById("exportJSON")?.addEventListener("click", () => {
      const keys = getLastNDayKeys(90).reverse();
      chrome.storage.local.get(keys, (data) => {
        const out = {};
        keys.forEach((k) => {
          if (data[k]) out[k] = data[k];
        });
        download(
          "tab-tracker.json",
          JSON.stringify(out, null, 2),
          "application/json",
        );
      });
    });

    document.getElementById("clearAllData")?.addEventListener("click", () => {
      if (!confirm("Delete ALL browsing history? Cannot be undone.")) return;
      chrome.storage.local.clear(() => {
        renderSummary(current.format("ddd MMM DD YYYY"));
        renderSettings();
      });
    });
  }

  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const COLORS = [
    "#e63946",
    "#9e0059",
    "#640d14",
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#C9CBCF",
    "#8A2BE2",
    "#00FA9A",
    "#FFD700",
    "#22b8cf",
    "#6a0572",
    "#f72585",
    "#3a0ca3",
    "#f94144",
    "#43aa8b",
    "#f3722c",
  ];

  function fmtMs(ms) {
    const s = Math.floor(ms / 1000) % 60,
      m = Math.floor(ms / 60000) % 60,
      h = Math.floor(ms / 3600000);
    return [h ? `${h}h` : "", m ? `${m}m` : "", `${s}s`]
      .filter(Boolean)
      .join(" ");
  }

  function fmtMsShort(ms) {
    const m = Math.floor(ms / 60000) % 60,
      h = Math.floor(ms / 3600000);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function getLastNDayKeys(n) {
    return Array.from({ length: n }, (_, i) =>
      dayjs().subtract(i, "day").format("ddd MMM DD YYYY"),
    );
  }

  function logoUrl(d) {
    return `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
  }
});
