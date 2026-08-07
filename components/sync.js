// ═══════════════════════════════════════════════════════════════════════════
// SYNC — Cloud Sync (Chrome Identity) + Import/Export Presets
// ═══════════════════════════════════════════════════════════════════════════

export const Sync = (() => {
  const SYNC_KEYS = [
    "dailyLimitHours", "blockSites", "siteLimits",
    "scheduleRule", "ignoreList", "siteLabels",
  ];

  // ── Cloud Sync via chrome.storage.sync ──────────────────────────────────
  function syncToCloud() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(SYNC_KEYS, (localData) => {
        chrome.storage.sync.set(localData, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    });
  }

  function syncFromCloud() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(SYNC_KEYS, (syncData) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        const toWrite = Object.fromEntries(
          Object.entries(syncData).filter(([, v]) => v !== undefined)
        );
        if (Object.keys(toWrite).length === 0) return resolve(false);
        chrome.storage.local.set(toWrite, () => resolve(true));
      });
    });
  }

  // ── Preset Export ────────────────────────────────────────────────────────
  async function exportPreset() {
    return new Promise((resolve) => {
      chrome.storage.local.get(SYNC_KEYS, (data) => {
        const preset = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          settings: {
            widgetConfig: data.widgetConfig,
            theme: data.theme,
            accentColor: data.accentColor,
            dailyLimitHours: data.dailyLimitHours,
            blockSites: data.blockSites,
            siteLimits: data.siteLimits,
            scheduleRule: data.scheduleRule,
            ignoreList: data.ignoreList,
            siteLabels: data.siteLabels,
          },
        };
        const blob = new Blob([JSON.stringify(preset, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ttt-preset-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  }

  // ── Preset Import ────────────────────────────────────────────────────────
  function importPreset(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const preset = JSON.parse(e.target.result);
          if (!preset.settings) throw new Error("Invalid preset format");
          const toWrite = Object.fromEntries(
            Object.entries(preset.settings).filter(([, v]) => v !== undefined)
          );
          chrome.storage.local.set(toWrite, () => resolve(preset));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ── UI Panel ─────────────────────────────────────────────────────────────
  function renderSyncPanel(container) {
    container.innerHTML = `
      <div class="sync-panel">
        <div class="card-label" style="margin-bottom:10px">
          <i class="fa-solid fa-cloud"></i> Sync & Data
        </div>
        <div class="sync-row">
          <div class="sync-info">
            <span class="sync-title">Cloud Sync</span>
            <span class="sync-sub">Save settings across Chrome on all devices</span>
          </div>
          <div class="sync-btn-group">
            <button class="btn-primary sync-up-btn" id="syncUpBtn">
              <i class="fa-solid fa-cloud-arrow-up"></i> Push
            </button>
            <button class="btn-secondary sync-down-btn" id="syncDownBtn">
              <i class="fa-solid fa-cloud-arrow-down"></i> Pull
            </button>
          </div>
        </div>
        <div id="syncStatus" class="sync-status hidden"></div>

        <div class="divider"></div>

        <div class="card-label" style="margin: 14px 0 8px">
          <i class="fa-solid fa-file-export"></i> Share Presets
        </div>
        <p class="card-hint">Export your block lists and settings to share with others</p>
        <div class="preset-btn-row">
          <button class="btn-primary" id="exportPresetBtn">
            <i class="fa-solid fa-file-arrow-down"></i> Export Preset
          </button>
          <button class="btn-secondary" id="importPresetBtn">
            <i class="fa-solid fa-file-arrow-up"></i> Import Preset
          </button>
          <input type="file" id="presetFileInput" accept=".json" style="display:none" />
        </div>
        <div id="presetStatus" class="sync-status hidden"></div>
      </div>`;

    function showStatus(el, msg, type = "success") {
      el.textContent = msg;
      el.className = `sync-status ${type}`;
      el.classList.remove("hidden");
      setTimeout(() => el.classList.add("hidden"), 3000);
    }

    const syncStatus = container.querySelector("#syncStatus");
    const presetStatus = container.querySelector("#presetStatus");

    container.querySelector("#syncUpBtn")?.addEventListener("click", async () => {
      try {
        await syncToCloud();
        showStatus(syncStatus, "✓ Settings pushed to cloud!", "success");
      } catch (e) {
        showStatus(syncStatus, `✗ Sync failed: ${e.message}`, "error");
      }
    });

    container.querySelector("#syncDownBtn")?.addEventListener("click", async () => {
      try {
        const had = await syncFromCloud();
        showStatus(
          syncStatus,
          had ? "✓ Settings pulled from cloud!" : "No cloud data found.",
          had ? "success" : "warning"
        );
        if (had) setTimeout(() => location.reload(), 1500);
      } catch (e) {
        showStatus(syncStatus, `✗ Pull failed: ${e.message}`, "error");
      }
    });

    container.querySelector("#exportPresetBtn")?.addEventListener("click", async () => {
      await exportPreset();
      showStatus(presetStatus, "✓ Preset exported!", "success");
    });

    container.querySelector("#importPresetBtn")?.addEventListener("click", () => {
      container.querySelector("#presetFileInput").click();
    });

    container.querySelector("#presetFileInput")?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const preset = await importPreset(file);
        const count = Object.keys(preset.settings).filter(
          (k) => preset.settings[k] !== undefined
        ).length;
        showStatus(presetStatus, `✓ Imported ${count} settings!`, "success");
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showStatus(presetStatus, `✗ Import failed: ${err.message}`, "error");
      }
    });
  }

  return { syncToCloud, syncFromCloud, exportPreset, importPreset, renderSyncPanel };
})();
