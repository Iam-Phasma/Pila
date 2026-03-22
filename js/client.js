import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";

const DEFAULT_ROOM = "main";
const DEFAULT_ROOM_NAME = "Queue Room";
const MAX_ROOM_NAME_LENGTH = 30;
const ROOM_REGEX = /^[a-z0-9-]{1,32}$/;
const CLIENT_SETTINGS_KEY = "pila-client-settings";

const roomNameLabel = document.getElementById("roomNameLabel");
const roomLabel = document.getElementById("roomLabel");
const queueNumber = document.getElementById("queueNumber");
const statusText = document.getElementById("statusText");
const backToDashboard = document.getElementById("backToDashboard");
const disconnectScreen = document.getElementById("disconnectScreen");
const disconnectReason = document.getElementById("disconnectReason");
const display = document.querySelector(".display");
const liveScreen = document.getElementById("liveScreen");
const disconnectBackToDashboard = document.getElementById("disconnectBackToDashboard");
const alertRippleOverlay = document.getElementById("alertRippleOverlay");
const audioHint = document.getElementById("audioHint");
const clientSettingsButton = document.getElementById("clientSettingsButton");
const clientSettingsPanel = document.getElementById("clientSettingsPanel");
const clientChimeToggle = document.getElementById("clientChimeToggle");
const clientRippleToggle = document.getElementById("clientRippleToggle");
const clientSpeakToggle = document.getElementById("clientSpeakToggle");

const state = {
  room: DEFAULT_ROOM,
  roomName: "",
  currentNumber: 0,
  updatedAt: null,
  roomExists: false,
  disconnected: false,
  supabase: null,
  queueChannel: null,
  alertChannel: null,
  presenceChannel: null,
  sessionId: window.crypto.randomUUID(),
  alertRippleTimer: null,
  audioContext: null,
  settingsOpen: false,
  speakOnUpdate: false,
  chimeOnAlert: true,
  rippleOnAlert: true,
  speechVoices: []
};

function loadClientSettings() {
  try {
    const raw = window.localStorage.getItem(CLIENT_SETTINGS_KEY);
    if (!raw) { return; }
    const parsed = JSON.parse(raw);
    if (Object.prototype.hasOwnProperty.call(parsed, "speakOnUpdate")) {
      state.speakOnUpdate = Boolean(parsed.speakOnUpdate);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, "chimeOnAlert")) {
      state.chimeOnAlert = Boolean(parsed.chimeOnAlert);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, "rippleOnAlert")) {
      state.rippleOnAlert = Boolean(parsed.rippleOnAlert);
    }
  } catch (_) {}
}

function persistClientSettings() {
  try {
    window.localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify({
      speakOnUpdate: state.speakOnUpdate,
      chimeOnAlert: state.chimeOnAlert,
      rippleOnAlert: state.rippleOnAlert
    }));
  } catch (_) {}
}

function renderClientSettings() {
  clientSettingsPanel.hidden = !state.settingsOpen;
  clientSettingsButton.setAttribute("aria-expanded", String(state.settingsOpen));
  clientSpeakToggle.checked = state.speakOnUpdate;
  clientChimeToggle.checked = state.chimeOnAlert;
  clientRippleToggle.checked = state.rippleOnAlert;
}

function toggleClientSettings() {
  state.settingsOpen = !state.settingsOpen;
  renderClientSettings();
}

function getSpeechVoices() {
  if (!("speechSynthesis" in window)) { return []; }
  const voices = window.speechSynthesis.getVoices().filter(Boolean);
  if (voices.length) { state.speechVoices = voices; }
  return state.speechVoices;
}

function waitForSpeechVoices(timeout = 1200) {
  const voices = getSpeechVoices();
  if (voices.length || !("speechSynthesis" in window)) { return Promise.resolve(voices); }
  return new Promise((resolve) => {
    let settled = false;
    let timerId = 0;
    const finalize = () => {
      if (settled) { return; }
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

  if (voiceLang.startsWith("en-us")) { score += 30; }
  else if (voiceLang.startsWith("en")) { score += 20; }

  if (voice.localService) { score += 6; }
  if (voice.default) { score += 2; }

  const preferredNames = [
    "samantha", "ava", "allison", "serena", "karen",
    "moira", "susan", "victoria", "zira", "aria", "jenny"
  ];
  preferredNames.forEach((name, i) => {
    if (voiceName.includes(name)) { score += 100 - i * 4; }
  });

  if (/(female|woman|girl)/.test(voiceName)) { score += 18; }
  if (/(male|man|boy)/.test(voiceName)) { score -= 12; }
  if (/(enhanced|premium|natural|neural)/.test(voiceName)) { score += 4; }

  return score;
}

function chooseAnnouncementVoice() {
  const voices = getSpeechVoices();
  if (!voices.length) { return null; }
  const englishVoices = voices.filter(v => /^en(-|_)?/i.test(v.lang || ""));
  const pool = englishVoices.length ? englishVoices : voices;
  return pool.slice().sort((a, b) => scoreAnnouncementVoice(b) - scoreAnnouncementVoice(a))[0] || null;
}

async function speakQueueNumber() {
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") { return; }
  const synth = window.speechSynthesis;
  await waitForSpeechVoices();
  const text = "Now serving, number " + state.currentNumber + ". Now serving, number " + state.currentNumber + ".";
  const utterance = new window.SpeechSynthesisUtterance(text);
  const voice = chooseAnnouncementVoice();
  if (voice) { utterance.voice = voice; utterance.lang = voice.lang || "en-US"; }
  else { utterance.lang = "en-US"; }
  utterance.rate = 0.84;
  utterance.pitch = 1.08;
  state.currentUtterance = utterance;
  // resume() first — Chrome silently gets stuck in "paused" state on repeated calls
  try { synth.resume(); } catch (_) {}
  synth.cancel();
  synth.speak(utterance);
}

// Create (and resume) a shared AudioContext on the first user gesture so
// mobile browsers (iOS Safari) allow audio to play when an alert arrives later.
// Also primes speechSynthesis with a silent utterance so iOS unlocks it for
// subsequent programmatic calls from async callbacks.
function unlockAudio() {
  if (audioHint) {
    audioHint.hidden = true;
  }

  // Unlock Web Audio
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    if (!state.audioContext) {
      state.audioContext = new AudioContextClass();
    }
    if (state.audioContext.state === "suspended") {
      state.audioContext.resume().catch(() => {});
    }
  }

  // Unlock Speech Synthesis — iOS requires a speak() call inside a user gesture
  // before it will honour programmatic calls from async callbacks.
  if ("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function") {
    const primer = new window.SpeechSynthesisUtterance("");
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
  }
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  return state.audioContext;
}

function playAlertTone() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  const resume = audioContext.state === "suspended"
    ? audioContext.resume()
    : Promise.resolve();

  resume.then(() => {
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
  }).catch(() => {});
}

function triggerAlertRipple() {
  if (state.disconnected) { return; }

  if (state.chimeOnAlert) {
    playAlertTone();
  }

  if (!state.rippleOnAlert || !alertRippleOverlay) { return; }

  if (state.alertRippleTimer) {
    window.clearTimeout(state.alertRippleTimer);
    state.alertRippleTimer = null;
  }

  alertRippleOverlay.classList.remove("active");
  void alertRippleOverlay.offsetWidth;
  alertRippleOverlay.classList.add("active");
  statusText.textContent = "Host alert triggered";

  state.alertRippleTimer = window.setTimeout(() => {
    alertRippleOverlay.classList.remove("active");
    state.alertRippleTimer = null;
  }, 2100);
}

function setDisconnected(flag, message = "") {
  state.disconnected = flag;
  disconnectScreen.hidden = !flag;
  liveScreen.hidden = flag;
  display.classList.toggle("disconnected", flag);

  if (flag) {
    disconnectReason.textContent = message || "This queue is no longer connected.";
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

function sanitizeRoomName(value) {
  return String(value ?? "").slice(0, MAX_ROOM_NAME_LENGTH);
}

function render() {
  roomNameLabel.textContent = state.roomName || DEFAULT_ROOM_NAME;
  roomLabel.textContent = "Room: " + state.room.toUpperCase();
  backToDashboard.href = "index.html?room=" + encodeURIComponent(state.room);
  disconnectBackToDashboard.href = backToDashboard.href;

  if (!state.disconnected) {
    queueNumber.textContent = "#" + state.currentNumber;
  }
}

function handleRoomDeleted() {
  state.roomExists = false;
  state.currentNumber = 0;
  state.updatedAt = null;
  setDisconnected(true, "The host ended this queue. Return to the dashboard to join another room.");
  render();
  statusText.textContent = "Queue ended by host";
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
  state.currentNumber = data?.current_number ?? 0;
  state.updatedAt = data?.updated_at ?? null;
  if (data && Object.prototype.hasOwnProperty.call(data, "room_name")) {
    state.roomName = sanitizeRoomName(data.room_name);
  }
  setDisconnected(!data, "The room code is not active right now. Ask the host to restart the queue or share a new code.");
  render();
  statusText.textContent = state.updatedAt ? "" : "Waiting for the host to start this room";
}

async function subscribe() {
  await fetchRoom();

  state.queueChannel = state.supabase
    .channel("client-room-" + state.room)
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
          handleRoomDeleted();
          return;
        }

        const row = payload.new || payload.old;
        state.roomExists = true;
        state.currentNumber = row?.current_number ?? 0;
        state.updatedAt = row?.updated_at ?? new Date().toISOString();
        if (row && Object.prototype.hasOwnProperty.call(row, "room_name")) {
          state.roomName = sanitizeRoomName(row.room_name);
        }
        setDisconnected(false);
        render();
        statusText.textContent = "Updated just now";
        if (state.speakOnUpdate) {
          speakQueueNumber();
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (!state.disconnected) {
          statusText.textContent = "";
        }
      }
    });

  state.alertChannel = state.supabase
    .channel("room-effects-" + state.room)
    .on("broadcast", { event: "alert-ripple" }, () => {
      triggerAlertRipple();
    })
    .on("broadcast", { event: "speak-number" }, () => {
      if (state.speakOnUpdate) {
        speakQueueNumber();
      }
    })
    .subscribe();

  state.presenceChannel = state.supabase.channel("room-watchers-" + state.room, {
    config: {
      presence: {
        key: "client-" + state.sessionId
      }
    }
  });

  await new Promise((resolve, reject) => {
    let settled = false;

    state.presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await state.presenceChannel.track({
            role: "client",
            room: state.room,
            online_at: new Date().toISOString()
          });
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
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  state.room = sanitizeRoomCode(params.get("room") || DEFAULT_ROOM);
  state.roomName = sanitizeRoomName(params.get("name"));
  render();

  if (!isSupabaseConfigured()) {
    setDisconnected(true, "Realtime is unavailable because Supabase is not configured yet.");
    statusText.textContent = "Supabase is not configured in js/config.js yet";
    return;
  }

  state.supabase = createSupabaseBrowserClient();

  try {
    await subscribe();
  } catch (error) {
    console.error(error);
    setDisconnected(true, "The client could not connect to realtime updates for this room.");
    render();
    statusText.textContent = "Connection failed";
  }

  loadClientSettings();
  renderClientSettings();

  // Unlock audio on the first tap so mobile browsers allow the chime to play.
  document.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
  document.addEventListener("click", unlockAudio, { once: true });

  clientSettingsButton.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleClientSettings();
  });

  document.addEventListener("click", (e) => {
    if (state.settingsOpen && !clientSettingsPanel.contains(e.target) && e.target !== clientSettingsButton) {
      state.settingsOpen = false;
      renderClientSettings();
    }
  });

  clientChimeToggle.addEventListener("change", () => {
    state.chimeOnAlert = clientChimeToggle.checked;
    persistClientSettings();
  });

  clientRippleToggle.addEventListener("change", () => {
    state.rippleOnAlert = clientRippleToggle.checked;
    persistClientSettings();
  });

  clientSpeakToggle.addEventListener("change", () => {
    state.speakOnUpdate = clientSpeakToggle.checked;
    persistClientSettings();
  });
}

boot();
