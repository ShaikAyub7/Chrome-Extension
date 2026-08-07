// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — Drag-and-Drop (handle-only, no glitch) + Widget Toggles
// ═══════════════════════════════════════════════════════════════════════════

export const Dashboard = (() => {

  const WIDGET_DEFS = [
    { id: "pie-chart",   label: "Pie Chart",        selector: ".graph-container"  },
    { id: "heatmap",     label: "Activity Heatmap", selector: ".heatmap-card"     },
    { id: "streak",      label: "Streak Badge",     selector: ".streak-bar"       },
    { id: "daily-limit", label: "Daily Limit Ring", selector: ".navigation-bar"   },
    { id: "site-list",   label: "Site List",        selector: "#tabUrls"          },
    { id: "mini-clock",  label: "Live Clock",       selector: "#mini-clock-widget"},
  ];

  let siteOrder = [];

  // ── Storage ────────────────────────────────────────────────────────────────
  function loadWidgetConfig() {
    return new Promise((resolve) =>
      chrome.storage.local.get(["widgetConfig", "siteOrder"], (data) => {
        const saved = data.widgetConfig || [];
        const merged = WIDGET_DEFS.map((def) => {
          const found = saved.find((s) => s.id === def.id);
          return { ...def, enabled: found ? found.enabled : def.id !== "mini-clock" };
        });
        siteOrder = data.siteOrder || [];
        resolve(merged);
      })
    );
  }

  function saveWidgetConfig(config) {
    chrome.storage.local.set({ widgetConfig: config.map(({ id, enabled }) => ({ id, enabled })) });
  }

  function saveSiteOrder(order) {
    siteOrder = order;
    chrome.storage.local.set({ siteOrder: order });
  }

  // ── Widget visibility ─────────────────────────────────────────────────────
  function applyWidgetVisibility(config) {
    config.forEach((w) => {
      const el = document.querySelector(w.selector);
      if (el) el.style.display = w.enabled ? "" : "none";
    });
  }

  async function renderWidgetPanel(container) {
    const config = await loadWidgetConfig();
    container.innerHTML = `
      <div class="widget-toggle-list">
        ${config.map((w) => `
          <label class="widget-toggle-item">
            <span>${w.label}</span>
            <label class="switch">
              <input type="checkbox" data-wid="${w.id}" ${w.enabled ? "checked" : ""}>
              <span class="slider round"></span>
            </label>
          </label>`).join("")}
      </div>`;

    container.querySelectorAll("input[data-wid]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const item = config.find((c) => c.id === chk.dataset.wid);
        if (item) { item.enabled = chk.checked; saveWidgetConfig(config); applyWidgetVisibility(config); }
      });
    });
    applyWidgetVisibility(config);
  }

  // ── Stamp domains ─────────────────────────────────────────────────────────
  // Returns true if any new boxes were stamped
  function stampDomains(container) {
    let stamped = false;
    container.querySelectorAll(".site-usage-box:not([data-domain])").forEach((box) => {
      const anchor = box.querySelector(".site-domain a") || box.querySelector("a[href^='https://']");
      if (!anchor) return;
      try {
        const domain = new URL(anchor.href).hostname;
        if (!domain) return;
        box.setAttribute("data-domain", domain);
        stamped = true;

        // Drag handle — clicking here is the ONLY way to start a drag
        if (!box.querySelector(".drag-handle")) {
          const handle = document.createElement("span");
          handle.className = "drag-handle";
          handle.setAttribute("draggable", "true"); // draggable on handle only
          handle.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" style="opacity:0.4;pointer-events:none">
            <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
            <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
            <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
            <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
          </svg>`;
          handle.title = "Drag to reorder";
          box.insertBefore(handle, box.firstChild);
        }
      } catch (_) {}
    });
    return stamped;
  }

  // ── Drag-and-drop (handle-only, throttled, no full-row draggable) ──────────
  let _dragSrc   = null;     // the .site-usage-box being dragged
  let _lastAfter = undefined; // track last insertion to avoid redundant DOM moves
  let _rafPending = false;

  function enableDragSort(container, onReorder) {
    if (container.dataset.dragEnabled) return;
    container.dataset.dragEnabled = "1";

    // dragstart fires on the HANDLE (draggable="true"), bubbles up
    container.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) { e.preventDefault(); return; }
      _dragSrc = handle.closest("[data-domain]");
      if (!_dragSrc) { e.preventDefault(); return; }

      _lastAfter = undefined;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", _dragSrc.dataset.domain);

      // Defer so the ghost image is rendered before we style the original
      requestAnimationFrame(() => {
        if (_dragSrc) _dragSrc.classList.add("drag-active");
      });
    });

    container.addEventListener("dragend", () => {
      if (_dragSrc) _dragSrc.classList.remove("drag-active");
      container.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      _dragSrc    = null;
      _lastAfter  = undefined;
      _rafPending = false;
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!_dragSrc || _rafPending) return;

      _rafPending = true;
      requestAnimationFrame(() => {
        _rafPending = false;
        if (!_dragSrc) return;

        const after = getDragAfterElement(container, e.clientY);

        // Only touch DOM if insertion point actually changed
        if (after === _lastAfter) return;
        _lastAfter = after;

        container.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));

        if (after == null) {
          container.appendChild(_dragSrc);
        } else {
          container.insertBefore(_dragSrc, after);
          after.classList.add("drag-over");
        }
      });
    });

    container.addEventListener("dragleave", (e) => {
      if (!container.contains(e.relatedTarget)) {
        container.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      }
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      container.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      const newOrder = [...container.querySelectorAll("[data-domain]")].map((el) => el.dataset.domain);
      onReorder(newOrder);
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll("[data-domain]:not(.drag-active)")];
    let closest = null, closestOffset = Number.NEGATIVE_INFINITY;
    for (const el of els) {
      const { top, height } = el.getBoundingClientRect();
      const offset = y - top - height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = el; }
    }
    return closest;
  }

  // ── Apply persisted order ─────────────────────────────────────────────────
  function applySiteOrder(container) {
    if (!siteOrder.length) return;
    const map = {};
    container.querySelectorAll("[data-domain]").forEach((el) => { map[el.dataset.domain] = el; });
    // Only reorder if there are items to move
    const fragment = document.createDocumentFragment();
    siteOrder.forEach((d) => { if (map[d]) fragment.appendChild(map[d]); });
    Object.entries(map).forEach(([d, el]) => { if (!siteOrder.includes(d)) fragment.appendChild(el); });
    container.appendChild(fragment);
  }

  // ── Mini clock ────────────────────────────────────────────────────────────
  function initMiniClock() {
    if (document.getElementById("mini-clock-widget")) return;
    const el = Object.assign(document.createElement("div"), {
      id: "mini-clock-widget", className: "mini-clock"
    });
    el.style.display = "none";
    el.innerHTML = `<span id="mini-clock-time">--:--:--</span>`;
    document.body.appendChild(el);
    const tick = () => {
      const t = document.getElementById("mini-clock-time");
      if (t) t.textContent = new Date().toLocaleTimeString([], { hour12: false });
    };
    tick(); setInterval(tick, 1000);
  }

  return { loadWidgetConfig, saveWidgetConfig, saveSiteOrder, renderWidgetPanel,
           applyWidgetVisibility, enableDragSort, stampDomains,
           applySiteOrder, initMiniClock };
})();
