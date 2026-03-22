import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const DEFAULT_ROOM = "main";
const GENERATED_ROOM_LENGTH = 6;
const MAX_QUEUE_NUMBER = 99999;
const MAX_ROOM_NAME_LENGTH = 20;
const HOST_SETTINGS_STORAGE_KEY = "pila-host-settings";
const ROOM_REGEX = /^[a-z0-9-]{1,32}$/;

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
  nextButton: document.getElementById("nextButton"),
  backButton: document.getElementById("backButton"),
  speakButton: document.getElementById("speakButton"),
  alertButton: document.getElementById("alertButton"),
  settingsButton: document.getElementById("settingsButton"),
  settingsPanel: document.getElementById("settingsPanel"),
  autoSpeakToggle: document.getElementById("autoSpeakToggle"),
  autoAlertToggle: document.getElementById("autoAlertToggle"),
  resetButton: document.getElementById("resetButton"),
  setNumberInput: document.getElementById("setNumberInput"),
  setNumberButton: document.getElementById("setNumberButton"),
  endQueueButton: document.getElementById("endQueueButton"),
  roomNameInput: document.getElementById("roomNameInput"),
  saveRoomNameButton: document.getElementById("saveRoomNameButton"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  copyCodeButton: document.getElementById("copyCodeButton"),
  clientLinkInput: document.getElementById("clientLinkInput"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  openClientLink: document.getElementById("openClientLink"),
  qrCanvas: document.getElementById("qrCanvas"),
  endQueueModal: document.getElementById("endQueueModal"),
  endQueueModalTitle: document.getElementById("endQueueModalTitle"),
  endQueueModalText: document.getElementById("endQueueModalText"),
  cancelEndQueueButton: document.getElementById("cancelEndQueueButton"),
  confirmEndQueueButton: document.getElementById("confirmEndQueueButton")
};

const state = {
  room: DEFAULT_ROOM,
  roomName: "",
  currentNumber: 0,
  watcherCount: 0,
  currentUserEmail: "",
  updatedAt: null,
  busy: false,
  roomExists: false,
  terminated: false,
  pendingConfirmation: null,
  confirmReturnFocus: null,
  settingsOpen: false,
  autoSpeakOnAdvance: false,
  autoAlertOnAdvance: false,
  supabase: null,
  queueChannel: null,
  alertChannel: null,
  presenceChannel: null,
  sessionId: window.crypto.randomUUID()
};

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
    state.autoAlertOnAdvance = Boolean(parsedSettings.autoAlertOnAdvance);
  } catch (error) {
    console.error(error);
  }
}

function persistHostSettings() {
  try {
    window.localStorage.setItem(HOST_SETTINGS_STORAGE_KEY, JSON.stringify({
      autoSpeakOnAdvance: state.autoSpeakOnAdvance,
      autoAlertOnAdvance: state.autoAlertOnAdvance
    }));
  } catch (error) {
    console.error(error);
  }
}

function renderSettings() {
  elements.settingsPanel.hidden = !state.settingsOpen;
  elements.settingsButton.setAttribute("aria-expanded", String(state.settingsOpen));
  elements.autoSpeakToggle.checked = state.autoSpeakOnAdvance;
  elements.autoAlertToggle.checked = state.autoAlertOnAdvance;
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

function openEndQueueModal() {
  openConfirmModal({
    title: "End this queue?",
    text: "This will delete the room and disconnect all client screens currently watching this queue.",
    confirmLabel: "End Queue",
    action: "end-queue",
    returnFocus: elements.endQueueButton
  });
}

function openResetModal() {
  openConfirmModal({
    title: "Reset this queue?",
    text: "This will set the current queue number back to zero for everyone watching this room.",
    confirmLabel: "Reset Queue",
    action: "reset-queue",
    returnFocus: elements.resetButton
  });
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

function formatTime(value) {
  if (!value) {
    return "Waiting";
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ROOM_NAME_LENGTH);
}

function chooseAnnouncementVoice() {
  const voices = window.speechSynthesis.getVoices();

  if (!voices.length) {
    return null;
  }

  const preferredVoiceNames = [
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
    "female"
  ];

  const englishVoices = voices.filter((voice) => /^en(-|_)?/i.test(voice.lang || ""));
  const rankedVoices = englishVoices.length ? englishVoices : voices;

  for (const preferredName of preferredVoiceNames) {
    const matchingVoice = rankedVoices.find((voice) =>
      voice.name.toLowerCase().includes(preferredName)
    );

    if (matchingVoice) {
      return matchingVoice;
    }
  }

  return rankedVoices.find((voice) => voice.default) || rankedVoices[0] || null;
}

function speakQueueNumber() {
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    setStatus("Speech not supported");
    return;
  }

  const announcementText = "Now <break time='0.04s'/> serving, number " + state.currentNumber + ". <break time='0.5s'/> Now <break time='0.04s'/> serving, number " + state.currentNumber + ".";
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
        triggeredAt: new Date().toISOString()
      }
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

async function triggerAlert() {
  await Promise.allSettled([playAlertTone(), sendClientAlertRipple()]);
}

async function runAdvanceActions(source) {
  if (source !== "next" && source !== "jump") {
    return;
  }

  if (state.autoSpeakOnAdvance) {
    speakQueueNumber();
  }

  if (state.autoAlertOnAdvance) {
    await triggerAlert();
  }
}

async function saveRoomName() {
  const sanitizedRoomName = sanitizeRoomName(elements.roomNameInput.value);
  state.roomName = sanitizedRoomName;
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
  elements.currentNumberStat.textContent = roomCode;
  elements.watcherCountStat.textContent = String(state.watcherCount);
  elements.roomStat.textContent = roomCode;
  elements.lastUpdateStat.textContent = formatTime(state.updatedAt);
  elements.setNumberInput.value = String(state.currentNumber);
  elements.roomNameInput.value = state.roomName;
  elements.roomCodeInput.value = roomCode;
  elements.clientLinkInput.value = clientUrl;
  elements.openClientLink.href = clientUrl;

  QRCode.toCanvas(elements.qrCanvas, clientUrl, {
    width: 220,
    margin: 1
  }).catch((error) => {
    console.error(error);
  });
}

async function signOutHost() {
  if (!state.supabase) {
    redirectToLogin();
    return;
  }

  elements.signOutHostButton.disabled = true;

  try {
    if (state.roomExists && !state.terminated) {
      await deleteRoom();
    }

    const { error } = await state.supabase.auth.signOut();

    if (error) {
      throw error;
    }

    redirectToLogin();
  } catch (error) {
    console.error(error);
    setStatus("Unable to delete room and sign out");
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
  elements.endQueueButton.disabled = flag || !isSupabaseConfigured();
}

function handleRoomDeleted(message) {
  state.roomExists = false;
  state.terminated = true;
  state.currentNumber = 0;
  state.watcherCount = 0;
  state.updatedAt = null;
  render();
  setBusy(false);
  setStatus(message || "Queue ended");
}

async function ensureRoomExists() {
  const { error } = await state.supabase
    .from("queue_rooms")
    .upsert({ room_code: state.room }, { onConflict: "room_code", ignoreDuplicates: true });

  if (error) {
    throw error;
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

    handleRoomDeleted("Queue ended");
  } catch (error) {
    console.error(error);
    setBusy(false);
    setStatus("Unable to end queue");
    throw error;
  }
}

async function setQueueNumber(nextNumber, options = {}) {
  setBusy(true);
  try {
    const clampedNumber = clampQueueNumber(nextNumber);
    await ensureRoomExists();
    const { error } = await state.supabase
      .from("queue_rooms")
      .update({ current_number: clampedNumber, updated_at: new Date().toISOString() })
      .eq("room_code", state.room);

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
    source: delta > 0 ? "next" : "back"
  });
}

async function submitQueueNumber() {
  const parsedValue = Number.parseInt(elements.setNumberInput.value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > MAX_QUEUE_NUMBER) {
    setStatus("Enter a queue number from 0 to 99999");
    elements.setNumberInput.focus();
    return;
  }

  await setQueueNumber(parsedValue, { source: "jump" });
}

async function subscribe() {
  await ensureRoomExists();
  await fetchRoom();

  state.queueChannel = state.supabase
    .channel("host-room-" + state.room)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "queue_rooms",
        filter: "room_code=eq." + state.room
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
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStatus("Realtime connected");
      }
    });

  state.presenceChannel = state.supabase.channel("room-watchers-" + state.room, {
    config: {
      presence: {
        key: "host-" + state.sessionId
      }
    }
  });

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
            online_at: new Date().toISOString()
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
    window.location.href = "index.html?room=" + encodeURIComponent(state.room);
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
  } finally {
    elements.confirmEndQueueButton.disabled = false;
  }
}

async function boot() {
  loadHostSettings();
  const params = new URLSearchParams(window.location.search);
  const requestedRoom = params.get("room");
  const requestedRoomName = params.get("name");
  state.room = requestedRoom ? sanitizeRoomCode(requestedRoom) : generateRoomCode();
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

  const { data, error } = await state.supabase.auth.getSession();
  if (error || !data.session) {
    redirectToLogin();
    return;
  }

  state.currentUserEmail = data.session.user.email || "host user";
  render();

  state.supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      redirectToLogin();
      return;
    }

    state.currentUserEmail = session.user.email || "host user";
    render();
  });

  try {
    await subscribe();
  } catch (error) {
    console.error(error);
    setStatus("Connection failed");
  }
}

elements.nextButton.addEventListener("click", () => changeQueue(1));
elements.backButton.addEventListener("click", () => changeQueue(-1));
elements.speakButton.addEventListener("click", speakQueueNumber);
elements.alertButton.addEventListener("click", triggerAlert);
elements.settingsButton.addEventListener("click", toggleSettingsPanel);
elements.resetButton.addEventListener("click", openResetModal);
elements.autoSpeakToggle.addEventListener("change", (event) => {
  updateHostSetting("autoSpeakOnAdvance", event.target.checked);
});
elements.autoAlertToggle.addEventListener("change", (event) => {
  updateHostSetting("autoAlertOnAdvance", event.target.checked);
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
elements.endQueueButton.addEventListener("click", openEndQueueModal);
elements.copyCodeButton.addEventListener("click", copyCode);
elements.copyLinkButton.addEventListener("click", copyLink);
elements.signOutHostButton.addEventListener("click", signOutHost);
elements.cancelEndQueueButton.addEventListener("click", closeEndQueueModal);
elements.confirmEndQueueButton.addEventListener("click", confirmPendingAction);
elements.endQueueModal.addEventListener("click", (event) => {
  if (event.target === elements.endQueueModal) {
    closeEndQueueModal();
  }
});

document.addEventListener("click", (event) => {
  if (
    state.settingsOpen
    && event.target !== elements.settingsButton
    && !elements.settingsButton.contains(event.target)
    && !elements.settingsPanel.contains(event.target)
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

window.setInterval(() => {
  elements.lastUpdateStat.textContent = formatTime(state.updatedAt);
}, 10000);

boot();
