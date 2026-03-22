import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";

const DEFAULT_ROOM = "main";
const DEFAULT_ROOM_NAME = "Queue Room";
const MAX_ROOM_NAME_LENGTH = 30;
const ROOM_REGEX = /^[a-z0-9-]{1,32}$/;

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
  alertRippleTimer: null
};

function playAlertTone() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();

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

    window.setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 900);
  }).catch(() => {});
}

function triggerAlertRipple() {
  if (!alertRippleOverlay || state.disconnected) {
    return;
  }

  playAlertTone();

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
    if (!state.disconnected) {
      statusText.textContent = "Live updates active";
    }
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
  statusText.textContent = state.updatedAt ? "Live updates active" : "Waiting for the host to start this room";
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
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (!state.disconnected) {
          statusText.textContent = "Live updates active";
        }
      }
    });

  state.alertChannel = state.supabase
    .channel("room-effects-" + state.room)
    .on("broadcast", { event: "alert-ripple" }, () => {
      triggerAlertRipple();
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
}

boot();
