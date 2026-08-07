// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR — Works on both Chrome AND Edge
// Uses launchWebAuthFlow (PKCE) instead of getAuthToken (Chrome-only)
// ═══════════════════════════════════════════════════════════════════════════

export const GoogleCalendar = (() => {
  const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
  const SCOPE        = "https://www.googleapis.com/auth/calendar.readonly";
  // ── Replace with your actual Google Cloud OAuth2 Web client_id ──────────
  // In manifest.json set the same client_id under "oauth2"
  // Create credentials at https://console.cloud.google.com →
  //   APIs & Services → Credentials → OAuth 2.0 Client IDs → Chrome App
  const CLIENT_ID    = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

  // ── PKCE helpers ─────────────────────────────────────────────────────────
  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  async function generateVerifier() {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    return b64url(arr);
  }
  async function generateChallenge(verifier) {
    const enc  = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", enc);
    return b64url(hash);
  }

  // ── Token storage ─────────────────────────────────────────────────────────
  function saveTokens(tokens) {
    const expiry = Date.now() + (tokens.expires_in - 60) * 1000;
    chrome.storage.local.set({ calTokens: { ...tokens, expiry } });
  }
  function loadTokens() {
    return new Promise((resolve) =>
      chrome.storage.local.get("calTokens", ({ calTokens }) => resolve(calTokens || null))
    );
  }
  function clearTokens() {
    chrome.storage.local.remove("calTokens");
  }

  // ── Refresh access token via refresh_token ───────────────────────────────
  async function refreshAccessToken(refreshToken) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method : "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body   : new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error("Token refresh failed");
    const data = await res.json();
    return data.access_token;
  }

  // ── Get a valid access token (refresh if expired) ─────────────────────────
  async function getValidToken() {
    const tokens = await loadTokens();
    if (!tokens) return null;
    if (Date.now() < tokens.expiry) return tokens.access_token;
    if (tokens.refresh_token) {
      try {
        const newToken = await refreshAccessToken(tokens.refresh_token);
        tokens.access_token = newToken;
        tokens.expiry = Date.now() + 3500 * 1000;
        saveTokens(tokens);
        return newToken;
      } catch (_) { clearTokens(); return null; }
    }
    return null;
  }

  // ── Interactive OAuth2 via launchWebAuthFlow (Chrome + Edge) ─────────────
  async function signIn() {
    const verifier   = await generateVerifier();
    const challenge  = await generateChallenge(verifier);
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id",             CLIENT_ID);
    authUrl.searchParams.set("redirect_uri",          redirectUri);
    authUrl.searchParams.set("response_type",         "code");
    authUrl.searchParams.set("scope",                 SCOPE + " https://www.googleapis.com/auth/userinfo.email");
    authUrl.searchParams.set("code_challenge",        challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("access_type",           "offline");
    authUrl.searchParams.set("prompt",                "consent");

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "Auth cancelled"));
          }
          try {
            const url    = new URL(responseUrl);
            const code   = url.searchParams.get("code");
            if (!code) throw new Error("No auth code in response");

            // Exchange code → tokens
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method : "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body   : new URLSearchParams({
                client_id:     CLIENT_ID,
                redirect_uri:  redirectUri,
                grant_type:    "authorization_code",
                code,
                code_verifier: verifier,
              }),
            });
            if (!tokenRes.ok) throw new Error("Token exchange failed: " + tokenRes.status);
            const tokens = await tokenRes.json();
            saveTokens(tokens);

            // Fetch user email to display
            const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const me = meRes.ok ? await meRes.json() : {};
            chrome.storage.local.set({ calendarConnected: true, calUserEmail: me.email || "" });
            resolve(tokens.access_token);
          } catch (e) { reject(e); }
        }
      );
    });
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    const tokens = await loadTokens();
    if (tokens?.access_token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, { method: "POST" })
        .catch(() => {});
    }
    clearTokens();
    chrome.storage.local.remove(["calendarConnected", "calUserEmail", "calendarBlockEnabled"]);
  }

  // ── Fetch today's events ───────────────────────────────────────────────────
  async function fetchTodayEvents(token) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);

    const url = `${CALENDAR_API}/calendars/primary/events`
      + `?timeMin=${start.toISOString()}`
      + `&timeMax=${end.toISOString()}`
      + `&singleEvents=true&orderBy=startTime&maxResults=20`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { clearTokens(); throw new Error("Token expired"); }
    if (!res.ok) throw new Error(`Calendar API ${res.status}`);
    return (await res.json()).items || [];
  }

  function isInEvent(ev) {
    const now   = Date.now();
    const start = new Date(ev.start?.dateTime || ev.start?.date).getTime();
    const end   = new Date(ev.end?.dateTime   || ev.end?.date).getTime();
    return now >= start && now <= end;
  }

  // ── Auto-block during active events ───────────────────────────────────────
  async function checkAndBlock() {
    const { calendarBlockEnabled } = await new Promise(r =>
      chrome.storage.local.get("calendarBlockEnabled", r)
    );
    if (!calendarBlockEnabled) return;

    try {
      const token = await getValidToken();
      if (!token) return;
      const events = await fetchTodayEvents(token);
      const active = events.find(isInEvent);

      if (active) {
        const { blockSites } = await new Promise(r => chrome.storage.local.get("blockSites", r));
        const endTime = new Date(active.end?.dateTime || active.end?.date).getTime();
        chrome.storage.local.set({
          focusMode: { active: true, endTime, blocked: blockSites || [],
                       calendarTriggered: true, eventTitle: active.summary || "Meeting" }
        });
        chrome.notifications?.create("cal_block_" + Date.now(), {
          type: "basic", iconUrl: "images/image.png",
          title: `🗓️ Auto-focus: ${active.summary || "Meeting"}`,
          message: "Distracting sites blocked for this event.", priority: 1,
        });
      } else {
        const { focusMode } = await new Promise(r => chrome.storage.local.get("focusMode", r));
        if (focusMode?.calendarTriggered) {
          chrome.storage.local.set({ focusMode: { active: false } });
        }
      }
    } catch (_) {}
  }

  // ── UI Panel ───────────────────────────────────────────────────────────────
  function renderCalendarPanel(container) {
    chrome.storage.local.get(
      ["calendarBlockEnabled", "calendarConnected", "calUserEmail"],
      ({ calendarBlockEnabled, calendarConnected, calUserEmail }) => {

        container.innerHTML = `
          <div class="cal-panel">
            <div class="cal-header">
              <div class="cal-info">
                <div class="cal-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google Calendar
                </div>
                <div class="cal-sub">Auto-block sites during meetings • Works on Chrome &amp; Edge</div>
              </div>
              <label class="switch">
                <input type="checkbox" id="calAutoBlockToggle" ${calendarBlockEnabled ? "checked" : ""} />
                <span class="slider round"></span>
              </label>
            </div>

            <div id="calAuthSection">
              ${calendarConnected
                ? `<div class="cal-connected">
                    <span style="color:var(--success)">✓</span>
                    Connected${calUserEmail ? ` as <b>${calUserEmail}</b>` : ""}
                    <button class="btn-danger btn-sm" id="calDisconnectBtn">Disconnect</button>
                   </div>`
                : `<button class="btn-primary" id="calConnectBtn" style="width:100%">
                    Sign in with Google
                   </button>
                   <p class="card-hint" style="margin-top:6px">
                     Opens a Google sign-in window. Works on Chrome and Edge.
                   </p>`}
            </div>

            <div id="calStatusMsg"></div>
            <div id="calEventsList" style="margin-top:10px"></div>
          </div>`;

        // Helpers
        const showMsg = (msg, type = "success") => {
          const el = container.querySelector("#calStatusMsg");
          el.className = `sync-status ${type}`;
          el.textContent = msg;
          setTimeout(() => { el.textContent = ""; el.className = ""; }, 4000);
        };

        // Toggle
        container.querySelector("#calAutoBlockToggle")?.addEventListener("change", (e) => {
          chrome.storage.local.set({ calendarBlockEnabled: e.target.checked });
          if (e.target.checked) checkAndBlock();
        });

        // Connect
        container.querySelector("#calConnectBtn")?.addEventListener("click", async () => {
          const btn = container.querySelector("#calConnectBtn");
          const orig = btn.innerHTML;
          btn.innerHTML = "Connecting…"; btn.disabled = true;
          try {
            if (CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
              throw new Error("Set your Google CLIENT_ID in google-calendar.js first");
            }
            const token = await signIn();
            renderCalendarPanel(container);
            await loadTodayEvents(container, token);
          } catch (e) {
            btn.innerHTML = orig; btn.disabled = false;
            showMsg(`✗ ${e.message}`, "error");
          }
        });

        // Disconnect
        container.querySelector("#calDisconnectBtn")?.addEventListener("click", async () => {
          await signOut();
          renderCalendarPanel(container);
        });

        // Load events if already connected
        if (calendarConnected) {
          getValidToken().then((token) => {
            if (token) loadTodayEvents(container, token);
            else { clearTokens(); chrome.storage.local.set({ calendarConnected: false }); renderCalendarPanel(container); }
          }).catch(() => {});
        }
      }
    );
  }

  async function loadTodayEvents(container, token) {
    const listEl = container.querySelector("#calEventsList");
    if (!listEl) return;
    listEl.innerHTML = `<p class="card-hint">Loading events…</p>`;
    try {
      const events = await fetchTodayEvents(token);
      if (!events.length) { listEl.innerHTML = `<p class="card-hint">No events today.</p>`; return; }
      listEl.innerHTML = `
        <div class="card-label" style="margin-bottom:6px">Today's Events</div>
        ${events.map((ev) => {
          const s = new Date(ev.start?.dateTime || ev.start?.date);
          const e = new Date(ev.end?.dateTime   || ev.end?.date);
          const active  = isInEvent(ev);
          const timeStr = ev.start?.dateTime
            ? `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "All day";
          return `
            <div class="cal-event ${active ? "active" : ""}">
              <span class="cal-event-dot ${active ? "active" : ""}"></span>
              <div class="cal-event-body">
                <div class="cal-event-title">${ev.summary || "Untitled"}</div>
                <div class="cal-event-time">${timeStr}${active ? " · <b>Now</b>" : ""}</div>
              </div>
              ${active ? '<span class="cal-blocking-badge">🔒 Blocking</span>' : ""}
            </div>`;
        }).join("")}`;
    } catch (e) {
      listEl.innerHTML = `<p class="card-hint" style="color:var(--danger)">Failed: ${e.message}</p>`;
    }
  }

  return { checkAndBlock, renderCalendarPanel };
})();
