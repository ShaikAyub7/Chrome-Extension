// ═══════════════════════════════════════════════════════════════════════════
// dashboard.js — full-page dashboard (opened in its own tab from the popup)
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  const COLORS = [
    "#e63946", "#9e0059", "#640d14", "#FF6384", "#36A2EB", "#FFCE56",
    "#4BC0C0", "#9966FF", "#FF9F40", "#C9CBCF",
  ];

  const RING_R = 78;
  const RING_CIRC = 2 * Math.PI * RING_R;

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

  function dayTotal(dayData, ignored) {
    return Object.entries(dayData || {})
      .filter(([d]) => !ignored.includes(d))
      .reduce((s, [, v]) => s + (v.runtime || 0), 0);
  }

  document.getElementById("dashDate").textContent = dayjs().format("dddd, MMM D YYYY");

  const todayKey = dayjs().format("ddd MMM DD YYYY");
  const week = getLastNDayKeys(7).reverse();
  const month = getLastNDayKeys(35).reverse();
  const streakDays = getLastNDayKeys(30);

  chrome.storage.local.get(
    [...new Set([todayKey, ...week, ...month, ...streakDays])].concat([
      "ignoreList",
      "dailyLimitHours",
      "theme",
    ]),
    (data) => {
      document.documentElement.setAttribute(
        "data-theme",
        data.theme === "dark" ? "dark" : "",
      );

      const ignored = data.ignoreList || [];
      const limitHours = data.dailyLimitHours || 6;
      const limitMs = limitHours * 3600000;

      const todayData = data[todayKey] || {};
      const filtered = Object.fromEntries(
        Object.entries(todayData).filter(([d]) => !ignored.includes(d)),
      );
      const sites = Object.entries(filtered).sort((a, b) => (b[1].runtime || 0) - (a[1].runtime || 0));
      const total = sites.reduce((s, [, v]) => s + (v.runtime || 0), 0);

      renderRing(sites, total, limitMs, limitHours);
      renderInsight(total, week, data, ignored);
      renderStreak(streakDays, data, ignored, limitMs);
      renderSiteList(sites);
      renderWeekChart(week, data, ignored);
      renderHeatmap(month, data, ignored);
    },
  );

  function renderRing(sites, total, limitMs, limitHours) {
    const g = document.getElementById("heroRingArcs");
    let offset = 0;
    const top = sites.slice(0, 6);
    top.forEach(([, v], i) => {
      const frac = limitMs > 0 ? Math.min((v.runtime || 0) / limitMs, 1) : 0;
      const len = frac * RING_CIRC;
      if (len <= 0) return;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "94");
      circle.setAttribute("cy", "94");
      circle.setAttribute("r", String(RING_R));
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", COLORS[i % COLORS.length]);
      circle.setAttribute("stroke-width", "15");
      circle.setAttribute("stroke-dasharray", `${len} ${RING_CIRC - len}`);
      circle.setAttribute("stroke-dashoffset", String(-offset));
      circle.setAttribute("transform", "rotate(-90 94 94)");
      if (i === top.length - 1 || i === 5) circle.setAttribute("stroke-linecap", "round");
      g.appendChild(circle);
      offset += len;
    });

    document.getElementById("heroTime").textContent = fmtMsShort(total);
    const pct = limitMs > 0 ? Math.min(Math.round((total / limitMs) * 100), 100) : 0;
    document.getElementById("heroSub").textContent = `${pct}% of ${limitHours}h limit`;
  }

  function renderInsight(total, week, data, ignored) {
    const priorDays = week.slice(0, -1); // exclude today (last entry)
    const priorTotals = priorDays.map((k) => dayTotal(data[k], ignored));
    const validPrior = priorTotals.filter((t) => t > 0);
    const el = document.getElementById("dashInsight");
    if (!validPrior.length) {
      el.textContent = "Not enough history yet for a comparison.";
      el.style.color = "var(--text-muted)";
      return;
    }
    const avg = validPrior.reduce((s, t) => s + t, 0) / validPrior.length;
    if (avg === 0) {
      el.textContent = "First tracked day this week.";
      el.style.color = "var(--text-muted)";
      return;
    }
    const diff = Math.round(((total - avg) / avg) * 100);
    if (diff <= -5) {
      el.textContent = `${Math.abs(diff)}% below your recent average`;
      el.style.color = "var(--success)";
    } else if (diff >= 5) {
      el.textContent = `${diff}% above your recent average`;
      el.style.color = "var(--danger)";
    } else {
      el.textContent = "Right around your recent average";
      el.style.color = "var(--text-muted)";
    }
  }

  function renderStreak(days, data, ignored, limitMs) {
    let streak = 0;
    for (const k of days) {
      const t = dayTotal(data[k], ignored);
      if (t > 0 && t <= limitMs) streak++;
      else if (t > limitMs) break;
    }
    const el = document.getElementById("dashStreak");
    el.innerHTML = streak
      ? `<i class="fa-solid fa-fire"></i> ${streak} day streak`
      : "No active streak";
  }

  function renderSiteList(sites) {
    const c = document.getElementById("dashSiteList");
    if (!sites.length) {
      c.innerHTML = `<p class="dash-empty">No sites tracked today yet.</p>`;
      return;
    }
    c.innerHTML = sites
      .slice(0, 8)
      .map(
        ([dom, v], i) => `
      <div class="dash-site-row">
        <span class="dash-site-dot" style="background:${COLORS[i % COLORS.length]}"></span>
        <span class="dash-site-domain">${dom}</span>
        <span class="dash-site-time">${fmtMsShort(v.runtime || 0)}</span>
      </div>`,
      )
      .join("");
  }

  function renderWeekChart(week, data, ignored) {
    const ctx = document.getElementById("weekChart")?.getContext("2d");
    if (!ctx) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const totals = week.map((k) => dayTotal(data[k], ignored));
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: week.map((k) => dayjs(k, "ddd MMM DD YYYY").format("ddd")),
        datasets: [
          {
            data: totals.map((ms) => +(ms / 3600000).toFixed(2)),
            backgroundColor: totals.map((ms, i) =>
              i === totals.length - 1 ? "#e63946" : (isDark ? "#3f3f46" : "#e4e4e7"),
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: isDark ? "#a1a1aa" : "#71717a" }, grid: { display: false } },
          y: {
            ticks: { color: isDark ? "#a1a1aa" : "#71717a", callback: (v) => `${v}h` },
            grid: { color: isDark ? "#27272a" : "#f4f4f5" },
          },
        },
      },
    });
  }

  function renderHeatmap(month, data, ignored) {
    const grid = document.getElementById("dashHeatmap");
    const totals = month.map((k) => dayTotal(data[k], ignored));
    const max = Math.max(...totals, 1);
    grid.innerHTML = month
      .map((k, i) => {
        const ms = totals[i];
        const lv =
          ms === 0 ? 0 : ms < max * 0.25 ? 1 : ms < max * 0.5 ? 2 : ms < max * 0.75 ? 3 : 4;
        const tip = `${dayjs(k, "ddd MMM DD YYYY").format("MMM D")}: ${fmtMsShort(ms)}`;
        return `<div class="heatmap-cell s${lv}" data-tip="${tip}" title="${tip}"></div>`;
      })
      .join("");
  }
})();
