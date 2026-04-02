import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";

// Prevent back/forward navigation (back button, trackpad swipe, etc.)
history.pushState(null, "", location.href);
window.addEventListener("popstate", () => history.pushState(null, "", location.href));

const DEFAULT_ROOM = "main";
const GENERATED_ROOM_LENGTH = 6;
const ROOM_REGEX = /^[a-z0-9-]{1,32}$/;
const HOST_ROOM_REGEX = /^[a-z][0-9]{5}$/;

const generatedRoomCode = document.getElementById("generatedRoomCode");
const regenerateCodeButton = document.getElementById("regenerateCodeButton");
const hostStatus = document.getElementById("hostStatus");
const accountToggleButton = document.getElementById("accountToggleButton");
const accountButtonLabel = document.getElementById("accountButtonLabel");
const authDrawer = document.getElementById("authDrawer");
const authSummary = document.getElementById("authSummary");
const hostEmailInput = document.getElementById("hostEmailInput");
const hostPasswordInput = document.getElementById("hostPasswordInput");
const togglePasswordButton = document.getElementById("togglePasswordButton");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");
const joinInput = document.getElementById("joinInput");
const openHostButton = document.getElementById("openHostButton");
const continueHostButton = document.getElementById("continueHostButton");
const customRoomInput = document.getElementById("customRoomInput");
const codeCardLabel = document.getElementById("codeCardLabel");
const joinFromInputButton = document.getElementById("joinFromInputButton");
const joinStatus = document.getElementById("joinStatus");
const configNotice = document.getElementById("configNotice");
const adminPanelLink = document.getElementById("adminPanelLink");
const adminPanelSection = document.getElementById("adminPanelSection");
const authChoiceGroup = document.getElementById("authChoiceGroup");
const accountSignInForm = document.getElementById("accountSignInForm");
const signedInActions = document.getElementById("signedInActions");
const guestSignInButton = document.getElementById("guestSignInButton");
const showAccountFormButton = document.getElementById("showAccountFormButton");
const backToChoiceButton = document.getElementById("backToChoiceButton");
const captchaModal = document.getElementById("captchaModal");
const captchaCloseButton = document.getElementById("captchaCloseButton");
const signOutModal = document.getElementById("signOutModal");
const cancelSignOutButton = document.getElementById("cancelSignOutButton");
const confirmSignOutButton = document.getElementById("confirmSignOutButton");

// hCaptcha — replace with your real site key from hcaptcha.com
const HCAPTCHA_SITE_KEY = "873e8134-a77c-47c8-bba2-960ae5c25cca";

let captchaWidgetId = null;
let pendingHostUrl = null;
let pendingGuestSignIn = false;
let pendingAccountSignIn = null; // { email, password } when awaiting captcha
const CAPTCHA_SESSION_KEY = "pila-captcha-ok";
const CAPTCHA_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function isCaptchaValid() {
  const raw = localStorage.getItem(CAPTCHA_SESSION_KEY);
  if (!raw) return false;
  const expiry = Number(raw);
  return Date.now() < expiry;
}

function setCaptchaValid() {
  localStorage.setItem(
    CAPTCHA_SESSION_KEY,
    String(Date.now() + CAPTCHA_TTL_MS),
  );
}

function clearCaptchaValid() {
  localStorage.removeItem(CAPTCHA_SESSION_KEY);
}

const supabase = createSupabaseBrowserClient();

let currentGeneratedRoom = "";
let customRoomCodeValue = "";
let hostAuthenticated = false;
let currentUserId = "";
let isCurrentSessionAnonymous = false;
let ownershipChannel = null;

const MAX_OWNED_ROOMS = 5;
const HOST_OWNED_ROOMS_STORAGE_KEY = "pila-host-owned-rooms";
const TAB_LOCK_STORAGE_KEY_PREFIX = "pila-host-tab-";
const TAB_LOCK_TTL_MS = 30000;

function isRoomTabOpen(roomCode) {
  try {
    const stored = window.localStorage.getItem(
      TAB_LOCK_STORAGE_KEY_PREFIX + roomCode,
    );
    if (!stored) return false;
    return Date.now() - Number(stored) < TAB_LOCK_TTL_MS;
  } catch (_) {
    return false;
  }
}

function getOwnedRoomCount(userId) {
  try {
    const raw = window.localStorage.getItem(
      HOST_OWNED_ROOMS_STORAGE_KEY + "-" + userId,
    );
    const rooms = JSON.parse(raw);
    return Array.isArray(rooms) ? rooms.length : 0;
  } catch (_) {
    return 0;
  }
}

function setAuthDrawerOpen(flag) {
  authDrawer.hidden = !flag;
  accountToggleButton.setAttribute("aria-expanded", String(flag));
}

function setJoinStatus(message) {
  if (joinStatus) {
    joinStatus.textContent = message;
  }
}

function generateRoomCode(length = GENERATED_ROOM_LENGTH) {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "0123456789";
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  let code = letters[bytes[0] % letters.length];

  for (let index = 1; index < length; index += 1) {
    code += digits[bytes[index] % digits.length];
  }

  return code;
}

async function generateUniqueRoomCode(maxAttempts = 5) {
  if (!supabase || !isSupabaseConfigured()) {
    return generateRoomCode();
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateRoomCode();
    const { data } = await supabase
      .from("queue_rooms")
      .select("room_code")
      .eq("room_code", code)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  // All attempts collided — extremely unlikely, use a longer fallback
  return generateRoomCode(8);
}

function sanitizeRoomCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

  return ROOM_REGEX.test(normalized) ? normalized : DEFAULT_ROOM;
}

function normalizeHostRoomCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, GENERATED_ROOM_LENGTH);

  return HOST_ROOM_REGEX.test(normalized) ? normalized : null;
}

function buildRelativeUrl(page, room) {
  return page + "?room=" + encodeURIComponent(sanitizeRoomCode(room));
}

function refreshGeneratedRoom() {
  currentGeneratedRoom = generateRoomCode();
  customRoomCodeValue = "";
  customRoomInput.value = "";
  customRoomInput.classList.remove("valid", "invalid");
  codeCardLabel.textContent = "Generated room code";
  generatedRoomCode.textContent = currentGeneratedRoom.toUpperCase();
  if (hostAuthenticated) {
    hostStatus.textContent =
      "Opening Host will start room code " +
      currentGeneratedRoom.toUpperCase() +
      ".";
  } else {
    hostStatus.textContent = "Sign in first before opening a host room.";
  }
}

function getContinueRoom(userId) {
  if (!userId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("pila-host-owned-rooms-" + userId);

    if (!raw) {
      return null;
    }

    const rooms = JSON.parse(raw);

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return null;
    }

    return rooms[rooms.length - 1];
  } catch (_) {
    return null;
  }
}

async function refreshContinueButton(userId) {
  if (!userId || !supabase) {
    continueHostButton.disabled = true;
    continueHostButton.title = "Sign in to resume a room";
    delete continueHostButton.dataset.room;
    return;
  }

  const room = getContinueRoom(userId);

  if (!room) {
    // localStorage miss — fall back to querying DB by owner_id
    try {
      const { data: dbRoom } = await supabase
        .from("queue_rooms")
        .select("room_code, room_name")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbRoom) {
        if (isRoomTabOpen(dbRoom.room_code)) {
          continueHostButton.disabled = true;
          continueHostButton.dataset.room = dbRoom.room_code;
          continueHostButton.title = "Already open in another tab";
        } else {
          continueHostButton.disabled = false;
          continueHostButton.dataset.room = dbRoom.room_code;
          continueHostButton.title =
            "Continue: " + (dbRoom.room_name || dbRoom.room_code.toUpperCase());
        }
      } else {
        continueHostButton.disabled = true;
        continueHostButton.title = "No active rooms to resume";
        delete continueHostButton.dataset.room;
      }
    } catch (_) {
      continueHostButton.disabled = true;
      continueHostButton.title = "No active rooms to resume";
      delete continueHostButton.dataset.room;
    }
    return;
  }

  // Verify the room still exists in the DB
  try {
    const { data } = await supabase
      .from("queue_rooms")
      .select("room_code")
      .eq("room_code", room.code)
      .maybeSingle();

    if (data) {
      if (isRoomTabOpen(room.code)) {
        continueHostButton.disabled = true;
        continueHostButton.dataset.room = room.code;
        continueHostButton.title = "Already open in another tab";
      } else {
        continueHostButton.disabled = false;
        continueHostButton.dataset.room = room.code;
        continueHostButton.title =
          "Continue: " + (room.name || room.code.toUpperCase());
      }
    } else {
      continueHostButton.disabled = true;
      continueHostButton.title = "No active rooms to resume";
      delete continueHostButton.dataset.room;
    }
  } catch (_) {
    continueHostButton.disabled = true;
    continueHostButton.title = "No active rooms to resume";
    delete continueHostButton.dataset.room;
  }
}

function renderAuthState(session) {
  hostAuthenticated = Boolean(session?.user);
  const isAnonymous = session?.user?.is_anonymous === true;
  const isNamedAccount = hostAuthenticated && !isAnonymous;

  openHostButton.disabled = !hostAuthenticated;
  regenerateCodeButton.disabled = !hostAuthenticated;
  customRoomInput.disabled = !hostAuthenticated;
  logoutButton.hidden = !hostAuthenticated;
  logoutButton.disabled = !hostAuthenticated;
  showAccountFormButton.hidden = false;
  showAccountFormButton.disabled = hostAuthenticated;
  showAccountFormButton.title = hostAuthenticated
    ? "Sign out first"
    : "";
  loginButton.disabled = hostAuthenticated;
  hostEmailInput.disabled = hostAuthenticated;
  hostPasswordInput.disabled = hostAuthenticated;

  // Show the right panel section
  // Signed in (guest or named): show choices but disable both (must sign out first)
  // Not signed in: show choices, both enabled
  authChoiceGroup.hidden = false;
  guestSignInButton.disabled = hostAuthenticated;
  guestSignInButton.title = hostAuthenticated ? "Sign out first" : "";
  accountSignInForm.hidden = true; // always collapse form on any state change
  signedInActions.hidden = !hostAuthenticated;

  if (hostAuthenticated) {
    const email = isAnonymous ? "Guest" : session.user.email || "host user";
    const userId = session.user.id || "";
    currentUserId = userId;
    isCurrentSessionAnonymous = isAnonymous;
    accountButtonLabel.textContent = isAnonymous ? "Guest Host" : email;
    authSummary.textContent = isAnonymous ? "Signed in as Guest" : email;
    authStatus.hidden = isNamedAccount;
    if (!isNamedAccount && isAnonymous) {
      authStatus.textContent = "Ready. Open Host to start a queue.";
    }
    // Show Admin Panel link only for named (non-anonymous) accounts
    if (adminPanelSection) {
      adminPanelSection.hidden = isAnonymous;
    }
    if (adminPanelLink) {
      adminPanelLink.hidden = isAnonymous;
    }
    refreshContinueButton(userId);
    subscribeOwnershipIndex(userId);
  } else {
    accountButtonLabel.textContent = "Host Setup";
    authSummary.textContent = "Not signed in";
    authStatus.hidden = false;
    authStatus.textContent = "Host sign-in required before opening a room.";
    if (adminPanelSection) {
      adminPanelSection.hidden = true;
    }
    continueHostButton.disabled = true;
    continueHostButton.title = "Sign in to resume a room";
    delete continueHostButton.dataset.room;
    currentUserId = "";
    isCurrentSessionAnonymous = false;
    if (ownershipChannel && supabase) {
      supabase.removeChannel(ownershipChannel);
      ownershipChannel = null;
    }
  }

  refreshGeneratedRoom();
}

async function openHost() {
  if (!hostAuthenticated) {
    hostStatus.textContent =
      "Choose how to continue from the account panel first.";
    return;
  }

  // Always validate against DB — localStorage may be empty or stale (e.g. cleared after remote sign-out)
  if (currentUserId && supabase) {
    try {
      const { count } = await supabase
        .from("queue_rooms")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", currentUserId);
      if ((count ?? 0) >= MAX_OWNED_ROOMS) {
        hostStatus.textContent =
          "Room limit reached (" +
          MAX_OWNED_ROOMS +
          "/" +
          MAX_OWNED_ROOMS +
          "). Terminate an existing room before opening a new one.";
        return;
      }
    } catch (_) {
      // DB check failed — fall back to localStorage
      if (getOwnedRoomCount(currentUserId) >= MAX_OWNED_ROOMS) {
        hostStatus.textContent =
          "Room limit reached (" +
          MAX_OWNED_ROOMS +
          "/" +
          MAX_OWNED_ROOMS +
          "). Terminate an existing room before opening a new one.";
        return;
      }
    }
  } else if (getOwnedRoomCount(currentUserId) >= MAX_OWNED_ROOMS) {
    hostStatus.textContent =
      "Room limit reached (" +
      MAX_OWNED_ROOMS +
      "/" +
      MAX_OWNED_ROOMS +
      "). Terminate an existing room before opening a new one.";
    return;
  }

  if (!customRoomCodeValue && !currentGeneratedRoom) {
    refreshGeneratedRoom();
  }

  // Verify room availability and ownership before navigating to host.html
  openHostButton.disabled = true;
  hostStatus.textContent = "Checking room availability\u2026";
  try {
    if (customRoomCodeValue) {
      // Custom codes: reject if the room is already owned by a different user
      if (supabase && isSupabaseConfigured()) {
        const { data: existingRoom } = await supabase
          .from("queue_rooms")
          .select("owner_id")
          .eq("room_code", customRoomCodeValue)
          .maybeSingle();
        if (existingRoom?.owner_id && existingRoom.owner_id !== currentUserId) {
          hostStatus.textContent =
            "This room code is already in use by another host. Choose a different code.";
          openHostButton.disabled = false;
          return;
        }
      }
    } else {
      // Auto-generated codes: pick one that isn't taken at all
      const uniqueCode = await generateUniqueRoomCode();
      if (uniqueCode !== currentGeneratedRoom) {
        currentGeneratedRoom = uniqueCode;
        generatedRoomCode.textContent = uniqueCode.toUpperCase();
      }
    }
  } catch (_) {
    // DB check failed — proceed with the current code
  } finally {
    openHostButton.disabled = false;
  }

  const targetUrl = buildRelativeUrl("host.html", customRoomCodeValue || currentGeneratedRoom);

  if (isCaptchaValid()) {
    window.location.href = targetUrl;
    return;
  }

  openCaptchaModal(targetUrl);
}

function openCaptchaModal(url) {
  pendingHostUrl = url;
  pendingGuestSignIn = false;
  pendingAccountSignIn = null;
  captchaModal.hidden = false;
  document.body.style.overflow = "hidden";

  if (typeof hcaptcha !== "undefined") {
    if (captchaWidgetId !== null) {
      hcaptcha.reset(captchaWidgetId);
    } else {
      captchaWidgetId = hcaptcha.render("hcaptchaWidget", {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: "_pilaOnCaptcha",
        "error-callback": "_pilaOnCaptchaError",
      });
    }
  }
}

function closeCaptchaModal() {
  captchaModal.hidden = true;
  document.body.style.overflow = "";
  pendingHostUrl = null;
  pendingGuestSignIn = false;
  pendingAccountSignIn = null;
  if (typeof hcaptcha !== "undefined" && captchaWidgetId !== null) {
    hcaptcha.reset(captchaWidgetId);
  }
}

window._pilaOnCaptcha = async function (token) {
  if (pendingAccountSignIn) {
    const { email, password } = pendingAccountSignIn;
    closeCaptchaModal();
    loginButton.disabled = true;
    authStatus.textContent = "Signing in...";
    try {
      await supabase.auth.signOut({ scope: "local" });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: token },
      });
      if (error) throw error;
      hostPasswordInput.value = "";
      setCaptchaValid();
      renderAuthState(data.session);
      setAuthDrawerOpen(false);
    } catch (err) {
      console.error(err);
      authStatus.textContent = "Sign in failed. Check the host credentials.";
      loginButton.disabled = false;
    }
    return;
  }

  if (pendingGuestSignIn) {
    closeCaptchaModal();
    guestSignInButton.disabled = true;
    authStatus.textContent = "Signing in as guest...";
    try {
      await supabase.auth.signOut({ scope: "local" });
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { captchaToken: token },
      });
      if (error) throw error;
      setCaptchaValid();
      renderAuthState(data.session);
      setAuthDrawerOpen(false);
    } catch (err) {
      console.error(err);
      authStatus.textContent = "Guest sign-in failed. Please try again.";
      guestSignInButton.disabled = false;
    }
    return;
  }

  setCaptchaValid();
  const url = pendingHostUrl;
  closeCaptchaModal();
  if (url) {
    window.location.href = url;
  }
};

window._pilaOnCaptchaError = function () {
  const wasSignIn = pendingGuestSignIn || pendingAccountSignIn;
  closeCaptchaModal();
  if (wasSignIn) {
    authStatus.textContent = "Verification failed. Please try again.";
  } else {
    hostStatus.textContent = "Verification failed. Please try again.";
  }
};

async function signInAsGuest() {
  if (!supabase) return;

  // Reuse any live session first (e.g. returning from host.html)
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session) {
    renderAuthState(existing.session);
    setAuthDrawerOpen(false);
    return;
  }

  // Show captcha — on success _pilaOnCaptcha will call signInAnonymously with the token
  pendingGuestSignIn = true;
  pendingHostUrl = null;
  captchaModal.hidden = false;
  document.body.style.overflow = "hidden";

  if (typeof hcaptcha !== "undefined") {
    if (captchaWidgetId !== null) {
      hcaptcha.reset(captchaWidgetId);
    } else {
      captchaWidgetId = hcaptcha.render("hcaptchaWidget", {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: "_pilaOnCaptcha",
        "error-callback": "_pilaOnCaptchaError",
      });
    }
  }
}

function togglePasswordVisibility() {
  const showingPassword = hostPasswordInput.type === "password";

  hostPasswordInput.type = showingPassword ? "text" : "password";
  togglePasswordButton.setAttribute(
    "aria-label",
    showingPassword ? "Hide password" : "Show password",
  );
  togglePasswordButton.setAttribute("aria-pressed", String(showingPassword));
}

async function signInHost() {
  if (!supabase) {
    authStatus.textContent = "Supabase is not configured yet.";
    return;
  }

  const email = hostEmailInput.value.trim();
  const password = hostPasswordInput.value;

  if (!email || !password) {
    authStatus.textContent = "Enter the host email and password.";
    return;
  }

  // Store credentials and let captcha modal deliver the token
  pendingAccountSignIn = { email, password };
  pendingGuestSignIn = false;
  pendingHostUrl = null;
  captchaModal.hidden = false;
  document.body.style.overflow = "hidden";

  if (typeof hcaptcha !== "undefined") {
    if (captchaWidgetId !== null) {
      hcaptcha.reset(captchaWidgetId);
    } else {
      captchaWidgetId = hcaptcha.render("hcaptchaWidget", {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: "_pilaOnCaptcha",
        "error-callback": "_pilaOnCaptchaError",
      });
    }
  }
}

function openSignOutModal() {
  signOutModal.hidden = false;
  confirmSignOutButton.focus();
}

function closeSignOutModal() {
  signOutModal.hidden = true;
  logoutButton.focus();
}

async function signOutHost() {
  if (!supabase) {
    return;
  }

  closeSignOutModal();
  logoutButton.disabled = true;

  // Delete all owned rooms before signing out, for both guest and named accounts.
  // Guests lose their account permanently; named accounts should still clean up
  // so clients aren't left watching orphaned queues.
  if (currentUserId) {
    try {
      await supabase
        .from("queue_rooms")
        .delete()
        .eq("owner_id", currentUserId);
    } catch (_) {
      // best-effort — rooms will expire via the TTL job
    }
    try {
      window.localStorage.removeItem(
        HOST_OWNED_ROOMS_STORAGE_KEY + "-" + currentUserId,
      );
    } catch (_) {}
  }

  try {
    await supabase.auth.signOut();
  } catch (_) {
    // Token may already be revoked (e.g. signed out globally from another device).
    // Swallow the error and clear local state regardless.
  }

  clearCaptchaValid();
  renderAuthState(null);
  setAuthDrawerOpen(false);
}

function parseJoinValue(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("client.html?") ||
    trimmed.startsWith("/")
  ) {
    const url = new URL(trimmed, window.location.href);
    const roomFromUrl = url.searchParams.get("room");

    if (!roomFromUrl) {
      return null;
    }

    const room = normalizeHostRoomCode(roomFromUrl);
    if (!room) {
      return null;
    }

    return {
      room,
      target: buildRelativeUrl("client.html", room),
    };
  }

  const room = normalizeHostRoomCode(trimmed);
  if (!room) {
    return null;
  }

  return {
    room,
    target: buildRelativeUrl("client.html", room),
  };
}

async function roomExists(room) {
  if (!supabase) {
    return true;
  }

  const { data, error } = await supabase
    .from("queue_rooms")
    .select("room_code")
    .eq("room_code", room)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function openJoinValue(value) {
  const target = parseJoinValue(value);

  if (!target) {
    setJoinStatus(
      "Enter a valid room code in the format A12345, or paste a matching client link.",
    );
    return;
  }

  setJoinStatus("Checking room...");

  try {
    const exists = await roomExists(target.room);

    if (!exists) {
      setJoinStatus(
        "Room not found. Check the code or ask the host for a new link.",
      );
      return;
    }

    setJoinStatus("Opening client view...");
    window.location.href = target.target;
  } catch (error) {
    console.error(error);
    setJoinStatus(
      "Unable to validate the room right now. Try again in a moment.",
    );
  }
}

captchaCloseButton.addEventListener("click", closeCaptchaModal);
captchaModal.addEventListener("click", (event) => {
  if (event.target === captchaModal) closeCaptchaModal();
});

openHostButton.addEventListener("click", openHost);
regenerateCodeButton.addEventListener("click", refreshGeneratedRoom);

customRoomInput.addEventListener("input", () => {
  const raw = customRoomInput.value;
  if (!raw.trim()) {
    customRoomCodeValue = "";
    customRoomInput.classList.remove("valid", "invalid");
    codeCardLabel.textContent = "Generated room code";
    generatedRoomCode.textContent =
      currentGeneratedRoom.toUpperCase() || "------";
    if (hostAuthenticated && currentGeneratedRoom) {
      hostStatus.textContent =
        "Opening Host will start room code " +
        currentGeneratedRoom.toUpperCase() +
        ".";
    }
    return;
  }
  const normalized = normalizeHostRoomCode(raw);
  if (normalized) {
    customRoomCodeValue = normalized;
    customRoomInput.classList.remove("invalid");
    customRoomInput.classList.add("valid");
    codeCardLabel.textContent = "Custom room code";
    generatedRoomCode.textContent = normalized.toUpperCase();
    if (hostAuthenticated) {
      hostStatus.textContent =
        "Opening Host will use custom code " + normalized.toUpperCase() + ".";
    }
  } else {
    customRoomCodeValue = "";
    customRoomInput.classList.remove("valid");
    customRoomInput.classList.add("invalid");
  }
});
function subscribeOwnershipIndex(userId) {
  if (!supabase || !userId) return;
  // Tear down any previous subscription (e.g. on re-login)
  if (ownershipChannel) {
    supabase.removeChannel(ownershipChannel);
    ownershipChannel = null;
  }

  ownershipChannel = supabase
    .channel("host-ownership-" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "queue_rooms" },
      (payload) => {
        if (payload.new?.owner_id !== userId) return;
        // A new room was created for this account (e.g. on another device)
        refreshContinueButton(userId);
      },
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "queue_rooms" },
      () => {
        // A room was deleted — re-check whether any rooms remain
        refreshContinueButton(userId);
      },
    )
    .on("broadcast", { event: "sign-out" }, async () => {
      // Another device signed out this account — clear local state and update UI.
      try {
        window.localStorage.removeItem(
          HOST_OWNED_ROOMS_STORAGE_KEY + "-" + userId,
        );
      } catch (_) {
        // best-effort
      }
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (_) {
        // best-effort — token may already be revoked
      }
      renderAuthState(null);
      setAuthDrawerOpen(false);
    })
    .subscribe();
}
continueHostButton.addEventListener("click", () => {
  const room = continueHostButton.dataset.room;
  if (room) {
    window.location.href = buildRelativeUrl("host.html", room);
  }
});
loginButton.addEventListener("click", signInHost);
logoutButton.addEventListener("click", openSignOutModal);
cancelSignOutButton.addEventListener("click", closeSignOutModal);
confirmSignOutButton.addEventListener("click", signOutHost);
signOutModal.addEventListener("click", (e) => {
  if (e.target === signOutModal) closeSignOutModal();
});
guestSignInButton.addEventListener("click", signInAsGuest);
showAccountFormButton.addEventListener("click", () => {
  accountSignInForm.hidden = false;
  authChoiceGroup.hidden = true;
  hostEmailInput.focus();
});
backToChoiceButton.addEventListener("click", () => {
  accountSignInForm.hidden = true;
  authChoiceGroup.hidden = false;
});
togglePasswordButton.addEventListener("click", togglePasswordVisibility);
accountToggleButton.addEventListener("click", () => {
  setAuthDrawerOpen(authDrawer.hidden);
});
joinFromInputButton.addEventListener("click", () =>
  openJoinValue(joinInput.value),
);
const cameraInput = document.getElementById("cameraInput");
const scannerStatus = document.getElementById("scannerStatus");

// Decode a file into a canvas, resizing to maxDim on the longest side.
// Using an <img> element works universally including iOS HEIC captures.
function resizeForScan(file, maxDim = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(
        1,
        maxDim / Math.max(img.naturalWidth || maxDim, img.naturalHeight || maxDim),
      );
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

async function scanImageFile(file) {
  scannerStatus.textContent = "Scanning...";

  // Step 1: BarcodeDetector on the raw file.
  // Best on Android Chrome — it handles large camera JPEGs natively without
  // needing any preprocessing, so we try this before resizing.
  if (typeof window.BarcodeDetector !== "undefined") {
    try {
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await det.detect(bitmap);
      bitmap.close();
      if (codes.length > 0) {
        scannerStatus.textContent = "";
        await openJoinValue(codes[0].rawValue);
        cameraInput.value = "";
        return;
      }
    } catch (_) {
      // Not available or file format unsupported (e.g. HEIC on iOS) — continue
    }
  }

  // Step 2: Resize via <img> element (universally decodes HEIC / large files)
  // then retry BarcodeDetector on the normalised canvas.
  let canvas;
  try {
    canvas = await resizeForScan(file, 1400);
  } catch (_) {
    scannerStatus.textContent = "Could not read the image. Try again.";
    cameraInput.value = "";
    return;
  }

  if (typeof window.BarcodeDetector !== "undefined") {
    try {
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(canvas);
      const codes = await det.detect(bitmap);
      bitmap.close();
      if (codes.length > 0) {
        scannerStatus.textContent = "";
        await openJoinValue(codes[0].rawValue);
        cameraInput.value = "";
        return;
      }
    } catch (_) {
      // continue to API
    }
  }

  // Step 3: External API fallback (goqr.me).
  // Wrapped in its own try/catch so a network error never shows the generic
  // "Could not read" message — mobile networks can block third-party fetches.
  try {
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (blob) {
      const formData = new FormData();
      formData.append("file", blob, "qr.jpg");
      const response = await fetch(
        "https://api.qrserver.com/v1/read-qr-code/",
        { method: "POST", body: formData },
      );
      if (response.ok) {
        const result = await response.json();
        const decoded = result?.[0]?.symbol?.[0]?.data;
        if (decoded) {
          scannerStatus.textContent = "";
          await openJoinValue(decoded);
          cameraInput.value = "";
          return;
        }
      }
    }
  } catch (_) {
    // API unreachable — fall through to "not found" message
  }

  scannerStatus.textContent = "No QR code found. Try a clearer photo.";
  cameraInput.value = "";
}

cameraInput.addEventListener("change", () => {
  if (cameraInput.files[0]) {
    scanImageFile(cameraInput.files[0]);
  }
});
hostPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    signInHost();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !authDrawer.hidden) {
    setAuthDrawerOpen(false);
  }
});

document.addEventListener("click", (event) => {
  if (
    !authDrawer.hidden &&
    !authDrawer.contains(event.target) &&
    !accountToggleButton.contains(event.target)
  ) {
    setAuthDrawerOpen(false);
  }
});

window.addEventListener("storage", (event) => {
  if (
    event.key &&
    event.key.startsWith(TAB_LOCK_STORAGE_KEY_PREFIX) &&
    currentUserId
  ) {
    void refreshContinueButton(currentUserId);
  }
});

const requestedRoom = new URLSearchParams(window.location.search).get("room");

if (requestedRoom) {
  joinInput.value = sanitizeRoomCode(requestedRoom);
}

if (!isSupabaseConfigured()) {
  configNotice.classList.add("show");
  authStatus.textContent = "Supabase is not configured yet.";
  authSummary.textContent = "Realtime unavailable";
  openHostButton.disabled = true;
  regenerateCodeButton.disabled = true;
  customRoomInput.disabled = true;
} else {
  let { data } = await supabase.auth.getSession();
  // Do NOT auto sign-in — user now chooses Guest or Account explicitly
  renderAuthState(data.session);

  supabase.auth.onAuthStateChange((event, session) => {
    // Ignore the transient SIGNED_OUT that Supabase fires when evicting a
    // stale local token right before completing a new anonymous sign-in.
    // We only act on it if there is genuinely no session at all.
    if (event === "SIGNED_OUT" && session === null && hostAuthenticated) {
      return;
    }
    renderAuthState(session);
  });
}
