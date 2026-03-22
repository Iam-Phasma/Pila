import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";

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
const joinFromInputButton = document.getElementById("joinFromInputButton");
const joinStatus = document.getElementById("joinStatus");
const configNotice = document.getElementById("configNotice");

const supabase = createSupabaseBrowserClient();

let currentGeneratedRoom = "";
let hostAuthenticated = false;

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
    continueHostButton.hidden = true;
    return;
  }

  const room = getContinueRoom(userId);

  if (!room) {
    continueHostButton.hidden = true;
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
      continueHostButton.hidden = false;
      continueHostButton.dataset.room = room.code;
      continueHostButton.title =
        "Continue: " + (room.name || room.code.toUpperCase());
    } else {
      continueHostButton.hidden = true;
    }
  } catch (_) {
    continueHostButton.hidden = true;
  }
}

function renderAuthState(session) {
  hostAuthenticated = Boolean(session?.user);
  openHostButton.disabled = !hostAuthenticated;
  regenerateCodeButton.disabled = !hostAuthenticated;
  logoutButton.disabled = !hostAuthenticated;
  loginButton.disabled = hostAuthenticated;
  hostEmailInput.disabled = hostAuthenticated;
  hostPasswordInput.disabled = hostAuthenticated;

  if (hostAuthenticated) {
    const email = session.user.email || "host user";
    const userId = session.user.id || "";
    accountButtonLabel.textContent = email;
    authSummary.textContent = "Signed in as " + email;
    authStatus.textContent = "Signed in as " + email + ".";
    refreshContinueButton(userId);
  } else {
    accountButtonLabel.textContent = "Host Login";
    authSummary.textContent = "Not signed in";
    authStatus.textContent = "Host sign-in required before opening a room.";
    continueHostButton.hidden = true;
  }

  refreshGeneratedRoom();
}

function openHost() {
  if (!hostAuthenticated) {
    hostStatus.textContent = "Sign in with the host account first.";
    return;
  }

  if (!currentGeneratedRoom) {
    refreshGeneratedRoom();
  }

  window.location.href = buildRelativeUrl("host.html", currentGeneratedRoom);
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

  loginButton.disabled = true;
  authStatus.textContent = "Signing in...";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    hostPasswordInput.value = "";
    renderAuthState(data.session);
    setAuthDrawerOpen(false);
  } catch (error) {
    console.error(error);
    authStatus.textContent = "Sign in failed. Check the host credentials.";
    loginButton.disabled = false;
  }
}

async function signOutHost() {
  if (!supabase) {
    return;
  }

  logoutButton.disabled = true;

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    hostEmailInput.disabled = false;
    hostPasswordInput.disabled = false;
    renderAuthState(null);
    setAuthDrawerOpen(false);
  } catch (error) {
    console.error(error);
    authStatus.textContent = "Unable to sign out right now.";
    logoutButton.disabled = false;
  }
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

openHostButton.addEventListener("click", openHost);
continueHostButton.addEventListener("click", () => {
  const room = continueHostButton.dataset.room;
  if (room) {
    window.location.href = buildRelativeUrl("host.html", room);
  }
});
loginButton.addEventListener("click", signInHost);
logoutButton.addEventListener("click", signOutHost);
togglePasswordButton.addEventListener("click", togglePasswordVisibility);
accountToggleButton.addEventListener("click", () => {
  setAuthDrawerOpen(authDrawer.hidden);
});
joinFromInputButton.addEventListener("click", () =>
  openJoinValue(joinInput.value),
);
const cameraInput = document.getElementById("cameraInput");
const scannerStatus = document.getElementById("scannerStatus");

async function scanImageFile(file) {
  try {
    scannerStatus.textContent = "Scanning...";

    // Try native BarcodeDetector first (Android Chrome)
    if (typeof window.BarcodeDetector !== "undefined") {
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await det.detect(bitmap);
      bitmap.close();
      if (codes.length > 0) {
        scannerStatus.textContent = "";
        await openJoinValue(codes[0].rawValue);
        return;
      }
    }

    // Fallback: jsQR via canvas (works on iOS Safari and all browsers)
    if (typeof window.jsQR !== "undefined") {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
      );
      if (code) {
        scannerStatus.textContent = "";
        await openJoinValue(code.data);
        return;
      }
    }

    scannerStatus.textContent = "No QR code found. Try a clearer photo.";
  } catch (error) {
    console.error(error);
    scannerStatus.textContent = "Could not read the image. Try again.";
  } finally {
    cameraInput.value = "";
  }
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
} else {
  const { data } = await supabase.auth.getSession();
  renderAuthState(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    renderAuthState(session);
  });
}
