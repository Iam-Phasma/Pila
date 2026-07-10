import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config.js";

const BANNER_ID = "pila-server-status-banner";
const CHECK_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 6_000;
const DISMISS_DURATION_MS = 5 * 60_000;
const BANNER_REVEAL_DELAY_MS = 800;

const bannerState = {
  inFlight: false,
  dismissedUntil: 0,
  dismissTimer: null,
  hideTimer: null,
  revealTimer: null,
  intervalTimer: null,
  visibilityListenerAdded: false,
  onlineListenerAdded: false,
  resizeListenerAdded: false,
  currentStatus: "unknown",
};

function ensureBanner() {
  let banner = document.getElementById(BANNER_ID);
  if (banner) {
    return banner;
  }

  banner = document.createElement("section");
  banner.id = BANNER_ID;
  banner.className = "pila-server-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  banner.innerHTML = `
    <div class="pila-server-banner__inner">
      <div class="pila-server-banner__center">
        <div class="pila-server-banner__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
            <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div class="pila-server-banner__copy">
          <p class="pila-server-banner__message" id="pilaServerBannerMessage">The server is temporarily unavailable. Retrying automatically.</p>
        </div>
      </div>
      <button class="pila-server-banner__close" type="button" aria-label="Dismiss status message" id="pilaServerBannerClose">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      </button>
    </div>
  `;

  document.body.prepend(banner);
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.id !== "pilaServerBannerClose") {
      return;
    }

    bannerState.dismissedUntil = Date.now() + DISMISS_DURATION_MS;
    hideBanner();

    if (bannerState.dismissTimer) {
      window.clearTimeout(bannerState.dismissTimer);
    }

    bannerState.dismissTimer = window.setTimeout(() => {
      bannerState.dismissTimer = null;
      if (bannerState.currentStatus !== "healthy") {
        checkServerHealth();
      }
    }, DISMISS_DURATION_MS);
  });

  return banner;
}

function syncBannerLayout() {
  const banner = document.getElementById(BANNER_ID);
  if (!banner || banner.hidden) {
    document.documentElement.style.setProperty("--pila-server-banner-height", "0px");
    return;
  }

  const height = Math.ceil(banner.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--pila-server-banner-height", `${height}px`);
}

function showBanner(title, message) {
  const banner = ensureBanner();
  const messageEl = banner.querySelector("#pilaServerBannerMessage");

  if (bannerState.hideTimer) {
    window.clearTimeout(bannerState.hideTimer);
    bannerState.hideTimer = null;
  }

  if (messageEl) {
    messageEl.textContent = message;
  }

  if (bannerState.revealTimer) {
    window.clearTimeout(bannerState.revealTimer);
  }

  banner.hidden = false;
  document.body.classList.add("server-status-banner-visible");
  bannerState.revealTimer = window.setTimeout(() => {
    banner.classList.add("is-visible");
    syncBannerLayout();
    bannerState.revealTimer = null;
  }, BANNER_REVEAL_DELAY_MS);
}

function hideBanner() {
  const banner = document.getElementById(BANNER_ID);
  if (banner) {
    banner.classList.remove("is-visible");
    if (bannerState.revealTimer) {
      window.clearTimeout(bannerState.revealTimer);
      bannerState.revealTimer = null;
    }
    if (bannerState.hideTimer) {
      window.clearTimeout(bannerState.hideTimer);
    }
    bannerState.hideTimer = window.setTimeout(() => {
      if (banner.hidden) {
        return;
      }

      banner.hidden = true;
      syncBannerLayout();
    }, 250);
  }

  document.documentElement.style.setProperty("--pila-server-banner-height", "0px");
  document.body.classList.remove("server-status-banner-visible");
}

function setHealthyState() {
  bannerState.currentStatus = "healthy";
  bannerState.dismissedUntil = 0;

  if (bannerState.dismissTimer) {
    window.clearTimeout(bannerState.dismissTimer);
    bannerState.dismissTimer = null;
  }

  hideBanner();
}

function setUnhealthyState(message) {
  bannerState.currentStatus = "unhealthy";

  if (Date.now() < bannerState.dismissedUntil) {
    return;
  }

  showBanner("", message);
}

async function checkServerHealth() {
  if (!isSupabaseConfigured() || bannerState.inFlight) {
    return;
  }

  bannerState.inFlight = true;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.ok) {
      setHealthyState();
      return;
    }

    if (navigator.onLine === false) {
      setUnhealthyState(
        "The device is offline, so Pila cannot reach the server yet. Retrying automatically.",
      );
      return;
    }

    setUnhealthyState(
      "The project is paused, and the backend is temporarily unavailable.",
    );
  } catch (error) {
    if (navigator.onLine === false) {
      setUnhealthyState(
        "The device is offline, so Pila cannot reach the server yet. Retrying automatically.",
      );
      return;
    }

    setUnhealthyState(
      "The project is paused, and the backend is temporarily unavailable.",
    );
    console.error(error);
  } finally {
    window.clearTimeout(timeoutId);
    bannerState.inFlight = false;
  }
}

function startHealthChecks() {
  if (!isSupabaseConfigured()) {
    hideBanner();
    return;
  }

  checkServerHealth();

  if (!bannerState.intervalTimer) {
    bannerState.intervalTimer = window.setInterval(
      checkServerHealth,
      CHECK_INTERVAL_MS,
    );
  }

  if (!bannerState.visibilityListenerAdded) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        checkServerHealth();
      }
    });
    bannerState.visibilityListenerAdded = true;
  }

  if (!bannerState.onlineListenerAdded) {
    window.addEventListener("online", checkServerHealth);
    bannerState.onlineListenerAdded = true;
  }

  if (!bannerState.resizeListenerAdded) {
    window.addEventListener("resize", syncBannerLayout);
    bannerState.resizeListenerAdded = true;
  }
}

function boot() {
  ensureBanner();
  startHealthChecks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}