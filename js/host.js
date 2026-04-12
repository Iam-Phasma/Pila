import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";
import QRCode from "https://esm.sh/qrcode@1.5.4";

// Prevent back/forward navigation (back button, trackpad swipe, etc.)
history.pushState(null, "", location.href);
window.addEventListener("popstate", () => history.pushState(null, "", location.href));

const DEFAULT_ROOM = "main";
const GENERATED_ROOM_LENGTH = 6;
const MAX_QUEUE_NUMBER = 99999;
const MAX_ROOM_NAME_LENGTH = 30;
const MAX_OWNED_ROOMS = 5;
const HOST_SETTINGS_STORAGE_KEY = "pila-host-settings";
const HOST_OWNED_ROOMS_STORAGE_KEY = "pila-host-owned-rooms";
const ROOM_REGEX = /^[a-z0-9-]{1,32}$/;
const TAB_LOCK_STORAGE_KEY_PREFIX = "pila-host-tab-";
const TAB_LOCK_TTL_MS = 30000;
const WRITE_COOLDOWN_MS = 300;

const elements = {
  statusChip: document.getElementById("statusChip"),
  accountChip: document.getElementById("accountChip"),
  popupAccountChip: document.getElementById("popupAccountChip"),
  signOutHostButton: document.getElementById("signOutHostButton"),
  configNotice: document.getElementById("configNotice"),
  roomChip: document.getElementById("roomChip"),
  queueNumber: document.getElementById("queueNumber"),
  currentNumberStat: document.getElementById("currentNumberStat"),
  watcherCountStat: document.getElementById("watcherCountStat"),
  roomStat: document.getElementById("roomStat"),
  lastUpdateStat: document.getElementById("lastUpdateStat"),
  expiresAtStat: document.getElementById("expiresAtStat"),
  nextButton: document.getElementById("nextButton"),
  backButton: document.getElementById("backButton"),
  speakButton: document.getElementById("speakButton"),
  chimeButton: document.getElementById("chimeButton"),
  alertButton: document.getElementById("alertButton"),
  settingsButton: document.getElementById("settingsButton"),
  settingsPanel: document.getElementById("settingsPanel"),
  autoSpeakToggle: document.getElementById("autoSpeakToggle"),
  autoChimeToggle: document.getElementById("autoChimeToggle"),
  autoRippleToggle: document.getElementById("autoRippleToggle"),
  resetButton: document.getElementById("resetButton"),
  setNumberInput: document.getElementById("setNumberInput"),
  setNumberButton: document.getElementById("setNumberButton"),
  endQueueButton: document.getElementById("endQueueButton"),
  terminateButton: document.getElementById("terminateButton"),
  roomSwitcher: document.getElementById("roomSwitcher"),
  addRoomButton: document.getElementById("addRoomButton"),
  roomNameInput: document.getElementById("roomNameInput"),
  saveRoomNameButton: document.getElementById("saveRoomNameButton"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  copyCodeButton: document.getElementById("copyCodeButton"),
  clientLinkInput: document.getElementById("clientLinkInput"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  openClientLink: document.getElementById("openClientLink"),
  qrCanvas: document.getElementById("qrCanvas"),
  printQrButton: document.getElementById("printQrButton"),
  saveQrButton: document.getElementById("saveQrButton"),
  endQueueModal: document.getElementById("endQueueModal"),
  endQueueModalTitle: document.getElementById("endQueueModalTitle"),
  endQueueModalText: document.getElementById("endQueueModalText"),
  cancelEndQueueButton: document.getElementById("cancelEndQueueButton"),
  confirmEndQueueButton: document.getElementById("confirmEndQueueButton"),
  hostAdminToast: document.getElementById("hostAdminToast"),
  hostAdminToastMsg: document.getElementById("hostAdminToastMsg"),
  adminDashboardLink: document.getElementById("adminDashboardLink"),
};

const state = {
  room: DEFAULT_ROOM,
  roomName: "",
  currentNumber: 0,
  watcherCount: 0,
  currentUserEmail: "",
  updatedAt: null,
  createdAt: null,
  lapseAnchor: null,
  lapseForNumber: null,
  busy: false,
  roomExists: false,
  terminated: false,
  pendingConfirmation: null,
  confirmReturnFocus: null,
  settingsOpen: false,
  autoSpeakOnAdvance: false,
  autoChimeOnAdvance: false,
  autoRippleOnAdvance: false,
  muteHostSpeak: false,
  muteHostChime: false,
  supabase: null,
  queueChannel: null,
  alertChannel: null,
  presenceChannel: null,
  ownershipChannel: null,
  adminNotifyChannel: null,
  terminatedByAdmin: false,
  ownerId: null,
  sessionId: window.crypto.randomUUID(),
  speechVoices: [],
  ownedRooms: [],
  userId: "",
};

function claimTabLock() {
  try {
    window.localStorage.setItem(
      TAB_LOCK_STORAGE_KEY_PREFIX + state.room,
      String(Date.now()),
    );
  } catch (_) {}
}

function releaseTabLock() {
  try {
    window.localStorage.removeItem(TAB_LOCK_STORAGE_KEY_PREFIX + state.room);
  } catch (_) {}
}

function renderAccount() {
  const accountLabel = state.currentUserEmail || "host user";
  elements.accountChip.textContent = accountLabel;
  if (elements.popupAccountChip) {
    elements.popupAccountChip.textContent = accountLabel;
  }
}

function loadHostSettings() {
  try {
    const rawSettings = window.localStorage.getItem(HOST_SETTINGS_STORAGE_KEY);
    if (!rawSettings) {
      return;
    }

    const parsedSettings = JSON.parse(rawSettings);
    state.autoSpeakOnAdvance = Boolean(parsedSettings.autoSpeakOnAdvance);
    state.autoChimeOnAdvance = Boolean(parsedSettings.autoChimeOnAdvance ?? parsedSettings.autoAlertOnAdvance);
    state.autoRippleOnAdvance = Boolean(parsedSettings.autoRippleOnAdvance ?? parsedSettings.autoAlertOnAdvance);
    state.muteHostSpeak = Boolean(parsedSettings.muteHostSpeak);
    state.muteHostChime = Boolean(parsedSettings.muteHostChime);
  } catch (error) {
    console.error(error);
  }
}

function persistHostSettings() {
  try {
    window.localStorage.setItem(
      HOST_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        autoSpeakOnAdvance: state.autoSpeakOnAdvance,
        autoChimeOnAdvance: state.autoChimeOnAdvance,
        autoRippleOnAdvance: state.autoRippleOnAdvance,
        muteHostSpeak: state.muteHostSpeak,
        muteHostChime: state.muteHostChime,
      }),
    );
  } catch (error) {
    console.error(error);
  }
}

function renderSettings() {
  const panel = elements.settingsPanel;
  if (!state.settingsOpen && !panel.hidden) {
    if (!panel.classList.contains("panel-closing")) {
      panel.classList.add("panel-closing");
      setTimeout(() => {
        panel.hidden = true;
        panel.classList.remove("panel-closing");
      }, 160);
    }
  } else {
    panel.classList.remove("panel-closing");
    panel.hidden = !state.settingsOpen;
  }
  elements.settingsButton.setAttribute(
    "aria-expanded",
    String(state.settingsOpen),
  );
  elements.autoSpeakToggle.checked = state.autoSpeakOnAdvance;
  elements.autoChimeToggle.checked = state.autoChimeOnAdvance;
  elements.autoRippleToggle.checked = state.autoRippleOnAdvance;
}

function toggleSettingsPanel() {
  state.settingsOpen = !state.settingsOpen;
  renderSettings();
}

function closeSettingsPanel() {
  if (!state.settingsOpen) {
    return;
  }

  state.settingsOpen = false;
  renderSettings();
}

function updateHostSetting(key, value) {
  state[key] = value;
  persistHostSettings();
  renderSettings();
}

function updateWatcherCount() {
  if (!state.presenceChannel) {
    state.watcherCount = 0;
    elements.watcherCountStat.textContent = "0";
    return;
  }

  const presenceState = state.presenceChannel.presenceState();
  let count = 0;

  Object.values(presenceState).forEach((entries) => {
    entries.forEach((entry) => {
      if (entry.role === "client") {
        count += 1;
      }
    });
  });

  state.watcherCount = count;
  elements.watcherCountStat.textContent = String(count);
}

function openConfirmModal({ title, text, confirmLabel, action, returnFocus }) {
  if (state.busy || !isSupabaseConfigured()) {
    return;
  }

  state.pendingConfirmation = action;
  state.confirmReturnFocus = returnFocus || null;
  elements.endQueueModalTitle.textContent = title;
  elements.endQueueModalText.textContent = text;
  elements.confirmEndQueueButton.textContent = confirmLabel;
  elements.endQueueModal.hidden = false;
  elements.confirmEndQueueButton.focus();
}

function openTerminateModal() {
  openConfirmModal({
    title: "Terminate this queue?",
    text: "This will permanently delete the room and disconnect all client screens watching this queue.",
    confirmLabel: "Terminate",
    action: "end-queue",
    returnFocus: elements.terminateButton,
  });
}

function openResetModal() {
  openConfirmModal({
    title: "Reset this queue?",
    text: "This will set the current queue number back to zero for everyone watching this room.",
    confirmLabel: "Reset",
    action: "reset-queue",
    returnFocus: elements.resetButton,
  });
}

function openSignOutModal() {
  if (!state.supabase) {
    redirectToLogin();
    return;
  }

  // Bypass the busy guard — sign-out should always be reachable
  state.pendingConfirmation = "sign-out";
  state.confirmReturnFocus = elements.signOutHostButton;
  elements.endQueueModalTitle.textContent = "Sign out?";
  elements.endQueueModalText.textContent =
    state.roomExists && !state.terminated
      ? "This will terminate your active queue and sign you out."
      : "Are you sure you want to sign out?";
  elements.confirmEndQueueButton.textContent = "Sign Out";
  elements.endQueueModal.hidden = false;
  elements.confirmEndQueueButton.focus();
}

function closeEndQueueModal() {
  elements.endQueueModal.hidden = true;
  const focusTarget = state.confirmReturnFocus;
  state.pendingConfirmation = null;
  state.confirmReturnFocus = null;

  if (focusTarget) {
    focusTarget.focus();
  }
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

function syncRoomInUrl(room) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  window.history.replaceState({}, "", url);
}

function redirectToLogin() {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("room", state.room);
  window.location.href = url.toString();
}

const ROOM_TTL_MS = 10 * 60 * 60 * 1000; // 10 hours

let _lastQueueWriteAt = 0;
let _lastRoomNameSaveAt = 0;
let _adminToastTimer = null;
let _lapseInterval = null;

// Called only by setQueueNumber after a local write — anchors to right now.
function anchorLapseToNow(number) {
  state.lapseAnchor = Date.now();
  state.lapseForNumber = number;
}

// Called by render() — always derive from DB updatedAt when the number changes.
function syncLapseFromDB() {
  if (state.currentNumber >= 1 && state.currentNumber !== state.lapseForNumber) {
    state.lapseAnchor = state.updatedAt
      ? new Date(state.updatedAt).getTime()
      : Date.now();
    state.lapseForNumber = state.currentNumber;
  }
}

function updateLapseStat() {
  if (!elements.currentNumberStat) return;
  if (state.currentNumber >= 1 && state.lapseAnchor) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - state.lapseAnchor) / 1000),
    );
    if (elapsedSeconds < 60) {
      elements.currentNumberStat.textContent = elapsedSeconds + "s";
    } else {
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      if (minutes < 60) {
        elements.currentNumberStat.textContent = minutes + "m" + (seconds > 0 ? " " + seconds + "s" : "");
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        elements.currentNumberStat.textContent = hours + "h" + (remainingMinutes > 0 ? " " + remainingMinutes + "m" : "");
      }
    }
  } else {
    elements.currentNumberStat.textContent = "--";
  }
}

function startLapseTimer() {
  if (_lapseInterval) clearInterval(_lapseInterval);
  _lapseInterval = setInterval(updateLapseStat, 1000);
}

function showHostToast(message) {
  if (!elements.hostAdminToast || !elements.hostAdminToastMsg) {
    return;
  }
  elements.hostAdminToastMsg.textContent = message;
  elements.hostAdminToast.classList.remove("toast-hide");
  elements.hostAdminToast.hidden = false;
  if (_adminToastTimer) {
    clearTimeout(_adminToastTimer);
  }
  _adminToastTimer = setTimeout(() => {
    elements.hostAdminToast.classList.add("toast-hide");
    _adminToastTimer = setTimeout(() => {
      elements.hostAdminToast.hidden = true;
    }, 300);
  }, 6000);
}

function formatExpiry(createdAt) {
  if (!createdAt) {
    return "--";
  }
  const remainingMs =
    ROOM_TTL_MS - (Date.now() - new Date(createdAt).getTime());
  if (remainingMs <= 0) {
    return "Expired";
  }
  if (remainingMs < 60000) {
    return Math.ceil(remainingMs / 1000) + "s left";
  }
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return minutes + "m left";
  }
  return hours + "h " + (minutes > 0 ? minutes + "m" : "") + " left";
}

function formatTime(value) {
  if (!value) {
    return "Waiting";
  }

  const diffSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (diffSeconds < 5) {
    return "Just now";
  }
  if (diffSeconds < 60) {
    return diffSeconds + "s ago";
  }
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) {
    return minutes + "m ago";
  }
  return Math.round(minutes / 60) + "h ago";
}

function buildClientUrl(room, roomName = "") {
  const url = new URL("client.html", window.location.href);
  url.searchParams.set("room", room);

  const sanitizedRoomName = sanitizeRoomName(roomName);
  if (sanitizedRoomName) {
    url.searchParams.set("name", sanitizedRoomName);
  } else {
    url.searchParams.delete("name");
  }

  return url.toString();
}

function setStatus(message) {
  elements.statusChip.textContent = message;
}

function clampQueueNumber(value) {
  return Math.min(MAX_QUEUE_NUMBER, Math.max(0, value));
}

function sanitizeQueueInputValue(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 5);
}

function sanitizeRoomName(value) {
  return String(value ?? "")
    .slice(0, MAX_ROOM_NAME_LENGTH)
    .toUpperCase();
}

function getSpeechVoices() {
  if (!("speechSynthesis" in window)) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices().filter(Boolean);

  if (voices.length) {
    state.speechVoices = voices;
  }

  return state.speechVoices;
}

function waitForSpeechVoices(timeout = 1200) {
  const voices = getSpeechVoices();

  if (voices.length || !("speechSynthesis" in window)) {
    return Promise.resolve(voices);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timerId = 0;

    const finalize = () => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timerId);
      window.speechSynthesis.removeEventListener("voiceschanged", finalize);
      resolve(getSpeechVoices());
    };

    timerId = window.setTimeout(finalize, timeout);
    window.speechSynthesis.addEventListener("voiceschanged", finalize);
    window.speechSynthesis.getVoices();
  });
}

function scoreAnnouncementVoice(voice) {
  const voiceName = String(voice.name || "").toLowerCase();
  const voiceLang = String(voice.lang || "").toLowerCase();
  let score = 0;

  if (voiceLang.startsWith("en-us")) {
    score += 30;
  } else if (voiceLang.startsWith("en")) {
    score += 20;
  }

  if (voice.localService) {
    score += 6;
  }

  if (voice.default) {
    score += 2;
  }

  const rankedVoiceNames = [
    "samantha",
    "ava",
    "allison",
    "serena",
    "karen",
    "moira",
    "susan",
    "victoria",
    "zira",
    "aria",
    "jenny",
  ];

  rankedVoiceNames.forEach((preferredName, index) => {
    if (voiceName.includes(preferredName)) {
      score += 100 - index * 4;
    }
  });

  if (/(female|woman|girl)/.test(voiceName)) {
    score += 18;
  }

  if (/(male|man|boy)/.test(voiceName)) {
    score -= 12;
  }

  if (/(enhanced|premium|natural|neural)/.test(voiceName)) {
    score += 4;
  }

  return score;
}

function chooseAnnouncementVoice() {
  const voices = getSpeechVoices();

  if (!voices.length) {
    return null;
  }

  const englishVoices = voices.filter((voice) =>
    /^en(-|_)?/i.test(voice.lang || ""),
  );
  const rankedVoices = englishVoices.length ? englishVoices : voices;

  return (
    rankedVoices
      .slice()
      .sort(
        (leftVoice, rightVoice) =>
          scoreAnnouncementVoice(rightVoice) -
          scoreAnnouncementVoice(leftVoice),
      )[0] || null
  );
}

async function speakQueueNumber() {
  if (state.muteHostSpeak) {
    return;
  }

  if (
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    setStatus("Speech not supported");
    return;
  }

  await waitForSpeechVoices();

  const announcementText =
    "Now serving, number " +
    state.currentNumber +
    ". Now serving, number " +
    state.currentNumber +
    ".";
  const utterance = new window.SpeechSynthesisUtterance(announcementText);
  const selectedVoice = chooseAnnouncementVoice();

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "en-US";
  } else {
    utterance.lang = "en-US";
  }

  utterance.rate = 0.84;
  utterance.pitch = 1.08;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setStatus("Speaking current queue");
}

async function playAlertTone() {
  if (state.muteHostChime) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    setStatus("Audio alert not supported");
    return;
  }

  const audioContext = new AudioContextClass();
  const startAt = audioContext.currentTime + 0.02;
  const pattern = [880, 1174, 880];

  pattern.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const toneStart = startAt + index * 0.18;
    const toneEnd = toneStart + 0.12;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gainNode.gain.setValueAtTime(0.0001, toneStart);
    gainNode.gain.linearRampToValueAtTime(0.16, toneStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 900);

  setStatus("Alert played");
}

async function sendClientChime() {
  if (!state.alertChannel) {
    setStatus("Client chime unavailable");
    return;
  }

  try {
    const channelStatus = await state.alertChannel.send({
      type: "broadcast",
      event: "alert-chime",
      payload: {
        room: state.room,
        triggeredAt: new Date().toISOString(),
      },
    });

    if (channelStatus !== "ok") {
      throw new Error("Broadcast failed");
    }

    setStatus("Client chime triggered");
  } catch (error) {
    console.error(error);
    setStatus("Client chime failed");
  }
}

async function sendClientAlertRipple() {
  if (!state.alertChannel) {
    setStatus("Client alert unavailable");
    return;
  }

  try {
    const channelStatus = await state.alertChannel.send({
      type: "broadcast",
      event: "alert-ripple",
      payload: {
        room: state.room,
        currentNumber: state.currentNumber,
        triggeredAt: new Date().toISOString(),
      },
    });

    if (channelStatus !== "ok") {
      throw new Error("Broadcast failed");
    }

    setStatus("Client alert triggered");
  } catch (error) {
    console.error(error);
    setStatus("Client alert failed");
  }
}

async function sendClientSpeakNumber() {
  if (!state.alertChannel) {
    setStatus("Client speak unavailable");
    return;
  }

  try {
    const channelStatus = await state.alertChannel.send({
      type: "broadcast",
      event: "speak-number",
      payload: {
        room: state.room,
        currentNumber: state.currentNumber,
        triggeredAt: new Date().toISOString(),
      },
    });

    if (channelStatus !== "ok") {
      throw new Error("Broadcast failed");
    }
  } catch (error) {
    console.error(error);
  }
}

async function triggerSpeak() {
  await Promise.allSettled([speakQueueNumber(), sendClientSpeakNumber()]);
}

async function triggerChime() {
  await Promise.allSettled([playAlertTone(), sendClientChime()]);
}

async function triggerAlert() {
  await Promise.allSettled([triggerChime(), sendClientAlertRipple()]);
}

async function runAdvanceActions(source) {
  if (source !== "next" && source !== "jump") {
    return;
  }

  if (state.autoSpeakOnAdvance) {
    await triggerSpeak();
  }

  if (state.autoChimeOnAdvance) {
    await triggerChime();
  }

  if (state.autoRippleOnAdvance) {
    await sendClientAlertRipple();
  }
}

async function saveRoomName() {
  const saveTs = Date.now();
  if (saveTs - _lastRoomNameSaveAt < 1000) {
    setStatus("Too fast — please wait a moment");
    return;
  }
  _lastRoomNameSaveAt = saveTs;
  const sanitizedRoomName = sanitizeRoomName(elements.roomNameInput.value);
  state.roomName = sanitizedRoomName;
  registerOwnedRoom(state.room, sanitizedRoomName);
  render();

  if (!state.supabase || !isSupabaseConfigured()) {
    setStatus("Room name updated in the client link");
    return;
  }

  try {
    await ensureRoomExists();
    const { error } = await state.supabase
      .from("queue_rooms")
      .update({ room_name: sanitizedRoomName || null })
      .eq("room_code", state.room);

    if (error) {
      throw error;
    }

    setStatus("Room name saved");
  } catch (error) {
    console.error(error);
    setStatus("Room name kept in the client link only");
  }
}

function render() {
  const safeCurrentNumber = clampQueueNumber(state.currentNumber);
  const numberText = "#" + safeCurrentNumber;
  const clientUrl = buildClientUrl(state.room, state.roomName);
  const roomCode = state.room.toUpperCase();

  state.currentNumber = safeCurrentNumber;
  renderAccount();
  elements.queueNumber.textContent = numberText;
  syncLapseFromDB();
  updateLapseStat();
  elements.watcherCountStat.textContent = String(state.watcherCount);
  if (elements.roomStat) elements.roomStat.textContent = roomCode;
  if (elements.lastUpdateStat)
    elements.lastUpdateStat.textContent = formatTime(state.updatedAt);
  if (elements.expiresAtStat) {
    const remaining = formatExpiry(state.createdAt);
    elements.expiresAtStat.textContent = remaining;
    const isLow =
      state.createdAt &&
      ROOM_TTL_MS - (Date.now() - new Date(state.createdAt).getTime()) <
        60 * 60 * 1000;
    elements.expiresAtStat
      .closest(".stat")
      ?.classList.toggle("stat-expiry-low", isLow);
  }
  elements.setNumberInput.value = String(state.currentNumber);
  elements.roomNameInput.value = state.roomName;
  elements.roomCodeInput.value = roomCode;
  elements.clientLinkInput.value = clientUrl;
  elements.openClientLink.href = clientUrl;

  const qrUrl = buildClientUrl(state.room);
  QRCode.toCanvas(elements.qrCanvas, qrUrl, {
    width: 220,
    margin: 1,
  }).catch((error) => {
    console.error(error);
  });
}

async function saveQrCode() {
  const qrUrl = buildClientUrl(state.room);
  const roomCode = state.room.toUpperCase();

  let dataUrl;
  try {
    dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 800,
      margin: 2,
      color: { dark: "#0b1c3b", light: "#ffffff" },
    });
  } catch (error) {
    console.error(error);
    return;
  }

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "pila-qr-" + roomCode + ".png";
  a.click();
}

async function printQrCode() {
  const qrUrl = buildClientUrl(state.room);
  const roomCode = state.room.toUpperCase();
  const roomLabel = state.roomName
    ? state.roomName.toUpperCase()
    : "Room " + roomCode;

  let dataUrl;
  try {
    dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 800,
      margin: 2,
      color: { dark: "#0b1c3b", light: "#ffffff" },
    });
  } catch (error) {
    console.error(error);
    return;
  }

  const win = window.open("", "_blank", "width=794,height=1123");
  if (!win) return;

  win.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QR Code – ${roomLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 210mm;
      min-height: 297mm;
      font-family: Inter, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      background: #ffffff;
      color: #0b1c3b;
      padding: 18mm 18mm 14mm;
    }
    .kicker {
      font-size: 18pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #2f6fe4;
      margin-bottom: 10mm;
      text-align: center;
    }
    .qr-img {
      width: 148mm;
      height: 148mm;
      display: block;
    }
    .room-label {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-top: 10mm;
      text-align: center;
      color: #2f6fe4;
    }
    .divider {
      width: 32mm;
      height: 1.5px;
      background: #e4eaf4;
      margin: 7mm 0;
    }
    .instruction {
      font-size: 11pt;
      font-weight: 500;
      color: #5a7499;
      text-align: center;
      line-height: 1.6;
    }
    .footer {
      margin-top: auto;
      padding-top: 12mm;
      font-size: 8pt;
      color: #aab8cc;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <p class="kicker">Scan to join the queue</p>
  <img class="qr-img" src="${dataUrl}" alt="QR code for ${roomLabel}" />
  <p class="room-label">${roomLabel}</p>
  <div class="divider"></div>
  <p class="instruction">Point your phone camera at the QR code above.<br>No app required &mdash; opens instantly in your browser.</p>
  <p class="footer">Powered by Pila &nbsp;&middot;&nbsp; ${qrUrl}</p>
</body>
</html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

async function signOutHost() {
  if (!state.supabase) {
    redirectToLogin();
    return;
  }

  elements.signOutHostButton.disabled = true;

  try {
    // Step 1: Broadcast sign-out and tear down ownershipChannel FIRST.
    // This must happen before any room deletions — otherwise the DELETE events
    // from our own deletions fire the ownershipChannel listener on this device,
    // which calls window.location.href = "index.html" and interrupts this flow
    // before auth.signOut() is ever reached.
    if (state.ownershipChannel) {
      try {
        await state.ownershipChannel.send({
          type: "broadcast",
          event: "sign-out",
          payload: {},
        });
      } catch (_) {
        // best-effort
      }
      await state.supabase.removeChannel(state.ownershipChannel);
      state.ownershipChannel = null;
    }

    // Step 2: Delete all owned rooms now that ownershipChannel is gone
    const otherRooms = state.ownedRooms.filter((r) => r.code !== state.room);
    await Promise.allSettled(
      otherRooms.map((r) =>
        state.supabase.from("queue_rooms").delete().eq("room_code", r.code),
      ),
    );

    if (state.roomExists && !state.terminated) {
      await deleteRoom();
    } else {
      unregisterOwnedRoom(state.room);
    }

    state.ownedRooms = [];
    saveOwnedRooms();
    renderRoomSwitcher();

    const { error } = await state.supabase.auth.signOut({ scope: "global" });

    if (error) {
      throw error;
    }

    redirectToLogin();
  } catch (error) {
    console.error(error);
    setStatus("Unable to sign out");
    elements.signOutHostButton.disabled = false;
  }
}

function setBusy(flag) {
  state.busy = flag;
  elements.nextButton.disabled = flag || !isSupabaseConfigured();
  elements.backButton.disabled = flag || !isSupabaseConfigured();
  elements.resetButton.disabled = flag || !isSupabaseConfigured();
  elements.setNumberInput.disabled = flag || !isSupabaseConfigured();
  elements.setNumberButton.disabled = flag || !isSupabaseConfigured();
  elements.terminateButton.disabled = flag || !isSupabaseConfigured();
}

function handleRoomDeleted(message) {
  releaseTabLock();
  const displayMessage = state.terminatedByAdmin
    ? "Queue terminated by administrator"
    : message || "Queue ended";
  state.roomExists = false;
  state.terminated = true;
  state.currentNumber = 0;
  state.watcherCount = 0;
  state.updatedAt = null;
  state.lapseAnchor = null;
  state.lapseForNumber = null;
  render();
  setBusy(false);
  setStatus(displayMessage);
}

async function ensureRoomExists() {
  // Try to upsert with owner_id so the INSERT event carries it (enables cross-device sync).
  // Fall back to room_code-only if the column doesn't exist yet.
  const payload = state.userId
    ? { room_code: state.room, owner_id: state.userId }
    : { room_code: state.room };

  let { error } = await state.supabase
    .from("queue_rooms")
    .upsert(payload, { onConflict: "room_code", ignoreDuplicates: true });

  if (error) {
    if (error.code === "42703") {
      // owner_id column doesn't exist yet — retry without it
      ({ error } = await state.supabase
        .from("queue_rooms")
        .upsert(
          { room_code: state.room },
          { onConflict: "room_code", ignoreDuplicates: true },
        ));
    }
    if (error) throw error;
  }

  state.roomExists = true;
  state.terminated = false;
}

async function fetchRoom() {
  const { data, error } = await state.supabase
    .from("queue_rooms")
    .select("*")
    .eq("room_code", state.room)
    .maybeSingle();

  if (error) {
    throw error;
  }

  state.roomExists = Boolean(data);
  state.currentNumber = clampQueueNumber(data?.current_number ?? 0);
  state.updatedAt = data?.updated_at ?? null;
  state.createdAt = data?.created_at ?? state.createdAt;
  state.ownerId = data?.owner_id ?? null;
  if (data && Object.prototype.hasOwnProperty.call(data, "room_name")) {
    state.roomName = sanitizeRoomName(data.room_name);
  }
  render();
}

async function deleteRoom() {
  if (!state.roomExists) {
    handleRoomDeleted("Queue already ended");
    return;
  }

  setBusy(true);

  try {
    const { error } = await state.supabase
      .from("queue_rooms")
      .delete()
      .eq("room_code", state.room);

    if (error) {
      throw error;
    }

    if (state.queueChannel) {
      await state.supabase.removeChannel(state.queueChannel);
      state.queueChannel = null;
    }

    if (state.presenceChannel) {
      await state.supabase.removeChannel(state.presenceChannel);
      state.presenceChannel = null;
    }

    if (state.alertChannel) {
      await state.supabase.removeChannel(state.alertChannel);
      state.alertChannel = null;
    }

    if (state.adminNotifyChannel) {
      await state.supabase.removeChannel(state.adminNotifyChannel);
      state.adminNotifyChannel = null;
    }

    unregisterOwnedRoom(state.room);
    handleRoomDeleted("Queue ended");
  } catch (error) {
    console.error(error);
    setBusy(false);
    setStatus("Unable to end queue");
    throw error;
  }
}

async function setQueueNumber(nextNumber, options = {}) {
  const writeTs = Date.now();
  if (writeTs - _lastQueueWriteAt < WRITE_COOLDOWN_MS) {
    setStatus("Too fast — please wait a moment");
    return;
  }
  _lastQueueWriteAt = writeTs;
  setBusy(true);
  try {
    const clampedNumber = clampQueueNumber(nextNumber);
    await ensureRoomExists();
    const now = new Date().toISOString();
    const { error } = await state.supabase
      .from("queue_rooms")
      .update({
        current_number: clampedNumber,
        updated_at: now,
      })
      .eq("room_code", state.room);

    // Anchor lapse to right now for instant local feedback
    state.currentNumber = clampedNumber;
    state.updatedAt = now;
    anchorLapseToNow(clampedNumber);

    if (error) {
      throw error;
    }

    await fetchRoom();
    await runAdvanceActions(options.source);
  } catch (error) {
    console.error(error);
    setStatus("Sync failed");
  } finally {
    setBusy(false);
  }
}

async function changeQueue(delta) {
  await fetchRoom();
  await setQueueNumber((state.currentNumber || 0) + delta, {
    source: delta > 0 ? "next" : "back",
  });
}

async function submitQueueNumber() {
  const parsedValue = Number.parseInt(elements.setNumberInput.value, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > MAX_QUEUE_NUMBER
  ) {
    setStatus("Enter a queue number from 0 to 99999");
    elements.setNumberInput.focus();
    return;
  }

  await setQueueNumber(parsedValue, { source: "jump" });
}

async function subscribe() {
  await ensureRoomExists();
  await fetchRoom();
  claimTabLock();

  state.queueChannel = state.supabase
    .channel("host-room-" + state.room)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "queue_rooms",
        filter: "room_code=eq." + state.room,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          handleRoomDeleted("Queue ended");
          return;
        }

        const row = payload.new || payload.old;
        state.currentNumber = row?.current_number ?? 0;
        state.updatedAt = row?.updated_at ?? new Date().toISOString();
        if (row && Object.prototype.hasOwnProperty.call(row, "room_name")) {
          state.roomName = sanitizeRoomName(row.room_name);
        }
        state.roomExists = true;
        render();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStatus("Realtime connected");
      }
    });

  state.presenceChannel = state.supabase.channel(
    "room-watchers-" + state.room,
    {
      config: {
        presence: {
          key: "host-" + state.sessionId,
        },
      },
    },
  );

  state.presenceChannel
    .on("presence", { event: "sync" }, () => {
      updateWatcherCount();
    })
    .on("presence", { event: "join" }, () => {
      updateWatcherCount();
    })
    .on("presence", { event: "leave" }, () => {
      updateWatcherCount();
    });

  await new Promise((resolve, reject) => {
    let settled = false;

    state.presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await state.presenceChannel.track({
            role: "host",
            room: state.room,
            online_at: new Date().toISOString(),
          });
          updateWatcherCount();
          if (!settled) {
            settled = true;
            resolve();
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      }

      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !settled) {
        settled = true;
        reject(new Error("Presence channel failed"));
      }
    });
  });

  state.alertChannel = state.supabase.channel("room-effects-" + state.room);

  await new Promise((resolve, reject) => {
    let settled = false;

    state.alertChannel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !settled) {
        settled = true;
        resolve();
      }

      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !settled) {
        settled = true;
        reject(new Error("Alert channel failed"));
      }
    });
  });

  // Subscribe to admin termination notifications
  if (state.userId) {
    state.adminNotifyChannel = state.supabase
      .channel("admin-notify-" + state.userId)
      .on("broadcast", { event: "room-terminated" }, (payload) => {
        if (payload.payload?.roomCode === state.room) {
          state.terminatedByAdmin = true;
          showHostToast("This queue was terminated by the administrator.");
        }
      })
      .subscribe();
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(elements.clientLinkInput.value);
    setStatus("Client link copied");
  } catch (error) {
    console.error(error);
    setStatus("Copy failed");
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(state.room.toUpperCase());
    setStatus("Room code copied");
  } catch (error) {
    console.error(error);
    setStatus("Copy failed");
  }
}

async function endQueueAndReturn() {
  if (!isSupabaseConfigured() || state.busy) {
    return;
  }

  try {
    elements.confirmEndQueueButton.disabled = true;
    await deleteRoom();

    // Navigate to another open room if available, otherwise fall back to dashboard
    const nextRoom = state.ownedRooms[state.ownedRooms.length - 1];
    if (nextRoom) {
      const url = new URL("host.html", window.location.href);
      url.searchParams.set("room", nextRoom.code);
      window.location.href = url.toString();
    } else {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error(error);
  } finally {
    elements.confirmEndQueueButton.disabled = false;
  }
}

async function confirmPendingAction() {
  const pendingAction = state.pendingConfirmation;

  if (!pendingAction) {
    return;
  }

  elements.endQueueModal.hidden = true;

  try {
    elements.confirmEndQueueButton.disabled = true;

    if (pendingAction === "reset-queue") {
      state.pendingConfirmation = null;
      state.confirmReturnFocus = null;
      await setQueueNumber(0);
      return;
    }

    if (pendingAction === "end-queue") {
      state.pendingConfirmation = null;
      state.confirmReturnFocus = null;
      await endQueueAndReturn();
    }

    if (pendingAction === "sign-out") {
      state.pendingConfirmation = null;
      state.confirmReturnFocus = null;
      await signOutHost();
    }
  } finally {
    elements.confirmEndQueueButton.disabled = false;
  }
}

function loadOwnedRooms() {
  if (!state.userId) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(
      HOST_OWNED_ROOMS_STORAGE_KEY + "-" + state.userId,
    );

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      state.ownedRooms = parsed.filter((r) => r && typeof r.code === "string");
    }
  } catch (error) {
    console.error(error);
  }
}

function saveOwnedRooms() {
  if (!state.userId) {
    return;
  }

  try {
    window.localStorage.setItem(
      HOST_OWNED_ROOMS_STORAGE_KEY + "-" + state.userId,
      JSON.stringify(state.ownedRooms),
    );
  } catch (error) {
    console.error(error);
  }
}

function registerOwnedRoom(code, name) {
  const existing = state.ownedRooms.find((r) => r.code === code);

  if (existing) {
    if (name) {
      existing.name = name;
    }
  } else {
    state.ownedRooms.push({ code, name: name || "" });
  }

  saveOwnedRooms();
  renderRoomSwitcher();
}

function unregisterOwnedRoom(code) {
  state.ownedRooms = state.ownedRooms.filter((r) => r.code !== code);
  saveOwnedRooms();
  renderRoomSwitcher();
}

function subscribeOwnership() {
  if (!state.supabase || !state.userId) {
    return;
  }

  state.ownershipChannel = state.supabase
    .channel("host-ownership-" + state.userId)
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "queue_rooms",
        // No owner_id filter here: Supabase DELETE events only carry the PK in
        // payload.old by default (REPLICA IDENTITY), so owner_id is not available
        // for server-side filtering. We filter client-side instead.
      },
      (payload) => {
        const code = payload.old?.room_code;
        if (!code) return;
        // Only act on rooms that belong to this user
        if (!state.ownedRooms.find((r) => r.code === code)) return;
        // Remove from tab switcher for all owned rooms, including the active one.
        // deleteRoom() already calls unregisterOwnedRoom when this device is the
        // one doing the deletion, so calling it again is harmless (idempotent).
        unregisterOwnedRoom(code);
        // If the deleted room is the one currently open on this device, navigate away.
        // Always go to index.html (not switchToRoom) to avoid landing on another room
        // that may also be in the process of being deleted (e.g. during remote sign-out),
        // which would cause ensureRoomExists() to re-create the deleted room.
        if (code === state.room) {
          window.location.href = "index.html";
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "queue_rooms",
        // No server-side filter: owner_id may not be set on all environments.
        // We filter client-side by checking payload.new.owner_id.
      },
      (payload) => {
        const code = payload.new?.room_code;
        if (!code) return;
        // Only handle rooms that belong to this user
        if (payload.new?.owner_id !== state.userId) return;
        if (!state.ownedRooms.find((r) => r.code === code)) {
          state.ownedRooms.push({ code, name: payload.new?.room_name || "" });
          saveOwnedRooms();
          renderRoomSwitcher();
        }
      },
    )
    .on("broadcast", { event: "sign-out" }, async () => {
      // Another device signed out this account.
      // Clear owned rooms from localStorage so the room count is not stale after re-login.
      try {
        window.localStorage.removeItem(
          HOST_OWNED_ROOMS_STORAGE_KEY + "-" + state.userId,
        );
      } catch (_) {
        // best-effort
      }
      // Clear the local session so index.html shows as signed out.
      try {
        await state.supabase.auth.signOut({ scope: "local" });
      } catch (_) {
        // best-effort
      }
      redirectToLogin();
    })
    .subscribe();
}

async function syncOwnedRoomsFromDB() {
  if (!state.supabase || !state.userId) {
    return;
  }

  try {
    const { data, error } = await state.supabase
      .from("queue_rooms")
      .select("room_code, room_name")
      .eq("owner_id", state.userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_OWNED_ROOMS);

    if (error || !Array.isArray(data)) {
      return;
    }

    const dbCodes = new Set(data.map((r) => r.room_code));
    let changed = false;

    // Add rooms that exist in DB but not locally
    for (const row of data) {
      const existing = state.ownedRooms.find((r) => r.code === row.room_code);
      if (!existing) {
        state.ownedRooms.push({
          code: row.room_code,
          name: row.room_name || "",
        });
        changed = true;
      } else if (row.room_name && !existing.name) {
        existing.name = row.room_name;
        changed = true;
      }
    }

    // Remove rooms that exist locally but were deleted from DB.
    // Always keep state.room — it may not be in the DB yet (ensureRoomExists
    // runs after this sync completes, so the current room hasn't been written yet).
    const before = state.ownedRooms.length;
    state.ownedRooms = state.ownedRooms.filter(
      (r) => r.code === state.room || dbCodes.has(r.code),
    );
    if (state.ownedRooms.length !== before) {
      changed = true;
    }

    if (changed) {
      saveOwnedRooms();
      renderRoomSwitcher();
    }
  } catch (_) {
    // silent — DB may not have owner_id column yet
  }
}

function renderRoomSwitcher() {
  if (!elements.roomSwitcher) {
    return;
  }

  const rooms = state.ownedRooms;
  elements.roomSwitcher.hidden = false;

  const inner = elements.roomSwitcher.querySelector(".room-switcher-inner");
  inner.querySelectorAll(".room-tab").forEach((el) => el.remove());

  rooms.forEach((room) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "room-tab" + (room.code === state.room ? " room-tab-active" : "");
    btn.dataset.room = room.code;
    const labelSpan = document.createElement("span");
    labelSpan.className = "room-tab-label";
    labelSpan.textContent = room.code.toUpperCase();
    btn.appendChild(labelSpan);
    btn.addEventListener("click", () => switchToRoom(room.code));
    inner.insertBefore(btn, elements.addRoomButton);
  });

  const atLimit = rooms.length >= MAX_OWNED_ROOMS;
  elements.addRoomButton.disabled = atLimit;
  elements.addRoomButton.title = atLimit
    ? "Room limit reached (" + MAX_OWNED_ROOMS + "/" + MAX_OWNED_ROOMS + ")"
    : "Open a new room";
}

function switchToRoom(code) {
  if (code === state.room) {
    return;
  }

  const url = new URL("host.html", window.location.href);
  url.searchParams.set("room", code);
  window.location.href = url.toString();
}

function openNewRoom() {
  if (state.ownedRooms.length >= MAX_OWNED_ROOMS) {
    setStatus(
      "Room limit reached. Terminate an existing room before opening a new one.",
    );
    return;
  }

  const newCode = generateRoomCode();
  registerOwnedRoom(newCode, "");
  const url = new URL("host.html", window.location.href);
  url.searchParams.set("room", newCode);
  window.location.href = url.toString();
}

function closeTab() {
  releaseTabLock();
  window.location.href = "index.html";
}

async function boot() {
  loadHostSettings();
  void waitForSpeechVoices();
  const params = new URLSearchParams(window.location.search);
  const requestedRoom = params.get("room");
  const requestedRoomName = params.get("name");
  state.room = requestedRoom
    ? sanitizeRoomCode(requestedRoom)
    : generateRoomCode();
  state.roomName = sanitizeRoomName(requestedRoomName);
  syncRoomInUrl(state.room);
  render();
  renderSettings();
  setBusy(false);

  if (!isSupabaseConfigured()) {
    elements.configNotice.classList.add("show");
    setStatus("Supabase not configured");
    return;
  }

  state.supabase = createSupabaseBrowserClient();

  let { data, error } = await state.supabase.auth.getSession();
  if (!error && !data.session) {
    const { data: anonData, error: anonError } =
      await state.supabase.auth.signInAnonymously();
    if (anonError || !anonData?.session) {
      redirectToLogin();
      return;
    }
    data = anonData;
  } else if (error) {
    redirectToLogin();
    return;
  }

  const isAnonymous =
    data.session.user.is_anonymous === true || !data.session.user.email;
  state.userId = data.session.user.id || "";
  state.currentUserEmail = isAnonymous
    ? "Guest"
    : data.session.user.email || "host user";
  if (elements.adminDashboardLink) {
    elements.adminDashboardLink.hidden = isAnonymous;
  }
  loadOwnedRooms();
  registerOwnedRoom(state.room, state.roomName);
  render();

  // Populate tabs with all DB-owned rooms (important on new/other devices)
  void syncOwnedRoomsFromDB();

  // Watch for room changes across devices in real time
  subscribeOwnership();

  state.supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      redirectToLogin();
      return;
    }

    const isAnon = session.user.is_anonymous === true || !session.user.email;
    state.currentUserEmail = isAnon
      ? "Guest"
      : session.user.email || "host user";
    if (elements.adminDashboardLink) {
      elements.adminDashboardLink.hidden = isAnon;
    }
    render();
  });

  try {
    await subscribe();

    // Ownership guard: if the room already exists in the DB and belongs to
    // a different user, this device has no right to act as the host.
    // Deregister the room locally and redirect to the client view.
    if (state.roomExists && state.ownerId && state.ownerId !== state.userId) {
      unregisterOwnedRoom(state.room);
      setStatus("This room belongs to another host");
      window.location.href = buildClientUrl(state.room, state.roomName);
      return;
    }
  } catch (error) {
    console.error(error);
    setStatus("Connection failed");
  }
}

elements.nextButton.addEventListener("click", () => changeQueue(1));
elements.backButton.addEventListener("click", () => changeQueue(-1));
elements.speakButton.addEventListener("click", triggerSpeak);
elements.chimeButton.addEventListener("click", triggerChime);
elements.alertButton.addEventListener("click", sendClientAlertRipple);
elements.settingsButton.addEventListener("click", toggleSettingsPanel);
elements.resetButton.addEventListener("click", openResetModal);
elements.autoSpeakToggle.addEventListener("change", (event) => {
  updateHostSetting("autoSpeakOnAdvance", event.target.checked);
});
elements.autoChimeToggle.addEventListener("change", (event) => {
  updateHostSetting("autoChimeOnAdvance", event.target.checked);
});
elements.autoRippleToggle.addEventListener("change", (event) => {
  updateHostSetting("autoRippleOnAdvance", event.target.checked);
});
elements.saveRoomNameButton.addEventListener("click", saveRoomName);
elements.setNumberButton.addEventListener("click", submitQueueNumber);
elements.roomNameInput.addEventListener("input", () => {
  const sanitizedValue = sanitizeRoomName(elements.roomNameInput.value);

  if (elements.roomNameInput.value !== sanitizedValue) {
    elements.roomNameInput.value = sanitizedValue;
  }
});
elements.roomNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveRoomName();
  }
});
elements.setNumberInput.addEventListener("input", () => {
  const sanitizedValue = sanitizeQueueInputValue(elements.setNumberInput.value);

  if (elements.setNumberInput.value !== sanitizedValue) {
    elements.setNumberInput.value = sanitizedValue;
  }
});
elements.setNumberInput.addEventListener("keydown", (event) => {
  if (["e", "E", "+", "-", "."].includes(event.key)) {
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    submitQueueNumber();
  }
});
elements.endQueueButton.addEventListener("click", closeTab);
elements.terminateButton.addEventListener("click", openTerminateModal);
elements.addRoomButton.addEventListener("click", openNewRoom);
elements.copyCodeButton.addEventListener("click", copyCode);
elements.copyLinkButton.addEventListener("click", copyLink);
elements.printQrButton.addEventListener("click", printQrCode);
elements.saveQrButton.addEventListener("click", saveQrCode);
elements.signOutHostButton.addEventListener("click", openSignOutModal);
elements.cancelEndQueueButton.addEventListener("click", closeEndQueueModal);
elements.confirmEndQueueButton.addEventListener("click", confirmPendingAction);
elements.endQueueModal.addEventListener("click", (event) => {
  if (event.target === elements.endQueueModal) {
    closeEndQueueModal();
  }
});

document.addEventListener("click", (event) => {
  if (
    state.settingsOpen &&
    event.target !== elements.settingsButton &&
    !elements.settingsButton.contains(event.target) &&
    !elements.settingsPanel.contains(event.target)
  ) {
    closeSettingsPanel();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.endQueueModal.hidden) {
    closeEndQueueModal();
    return;
  }

  if (event.key === "Escape" && state.settingsOpen) {
    closeSettingsPanel();
  }
});

window.addEventListener("beforeunload", releaseTabLock);

function tickExpiry() {
  if (elements.lastUpdateStat)
    elements.lastUpdateStat.textContent = formatTime(state.updatedAt);

  if (state.roomExists && !state.terminated && state.createdAt) {
    const remainingMs = ROOM_TTL_MS - (Date.now() - new Date(state.createdAt).getTime());
    if (remainingMs <= 0) {
      deleteRoom();
      return;
    }

    if (elements.expiresAtStat) {
      elements.expiresAtStat.textContent = formatExpiry(state.createdAt);
      const isLow = remainingMs < 60 * 60 * 1000;
      elements.expiresAtStat
        .closest(".stat")
        ?.classList.toggle("stat-expiry-low", isLow);
    }

    // Use 1s interval in last minute so seconds tick, else 10s is fine
    const nextTick = remainingMs < 60000 ? 1000 : 10000;
    clearTimeout(_expiryTickTimer);
    _expiryTickTimer = setTimeout(tickExpiry, nextTick);
    return;
  }

  if (elements.expiresAtStat) {
    elements.expiresAtStat.textContent = formatExpiry(state.createdAt);
  }

  // Room not active — poll slowly
  clearTimeout(_expiryTickTimer);
  _expiryTickTimer = setTimeout(tickExpiry, 10000);
}

let _expiryTickTimer = setTimeout(tickExpiry, 1000);

window.setInterval(() => {
  if (state.roomExists) claimTabLock();
}, 10000);

startLapseTimer();
boot();
