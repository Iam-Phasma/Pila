import { createSupabaseBrowserClient, isSupabaseConfigured } from "./config.js";

const ROOM_TTL_MS = 10 * 60 * 60 * 1000; // 10 hours

const supabase = createSupabaseBrowserClient();

const elements = {
  adminStats: document.getElementById("adminStats"),
  adminContent: document.getElementById("adminContent"),
  adminToast: document.getElementById("adminToast"),
  adminToastMsg: document.getElementById("adminToastMsg"),
  adminToastIcon: document.getElementById("adminToastIcon"),
  confirmModal: document.getElementById("confirmModal"),
  confirmModalTitle: document.getElementById("confirmModalTitle"),
  confirmModalText: document.getElementById("confirmModalText"),
  confirmOkButton: document.getElementById("confirmOkButton"),
  cancelConfirmButton: document.getElementById("cancelConfirmButton"),
  terminateAllButton: document.getElementById("terminateAllButton"),
  refreshButton: document.getElementById("refreshButton"),
  loadingOverlay: document.getElementById("loadingOverlay"),
};

// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------
let rooms = [];
let pendingConfirm = null;
let realtimeChannel = null;
let toastTimer = null;

// -----------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------
function formatTimeAgo(value) {
  if (!value) {
    return "—";
  }
  const diff = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (diff < 5) {
    return "Just now";
  }
  if (diff < 60) {
    return diff + "s ago";
  }
  const m = Math.round(diff / 60);
  if (m < 60) {
    return m + "m ago";
  }
  return Math.round(m / 60) + "h ago";
}

function formatExpiry(createdAt) {
  if (!createdAt) {
    return "—";
  }
  const remaining = ROOM_TTL_MS - (Date.now() - new Date(createdAt).getTime());
  if (remaining <= 0) {
    return "Expired";
  }
  const totalMinutes = Math.ceil(remaining / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? h + "h " + (m > 0 ? m + "m " : "") + "left" : m + "m left";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// -----------------------------------------------------------------------
// Toast
// -----------------------------------------------------------------------
const TOAST_ICONS = {
  success: '<polyline points="20 6 9 17 4 12"/>',
  error:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
};

function showToast(message, type = "info") {
  elements.adminToast.dataset.type = type;
  elements.adminToastMsg.textContent = message;
  elements.adminToastIcon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.info;
  elements.adminToast.classList.remove("toast-hide");
  elements.adminToast.hidden = false;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    elements.adminToast.classList.add("toast-hide");
    setTimeout(() => {
      elements.adminToast.hidden = true;
    }, 300);
  }, 4000);
}

// -----------------------------------------------------------------------
// Loading overlay
// -----------------------------------------------------------------------
function setLoading(flag) {
  elements.loadingOverlay.hidden = !flag;
}

// -----------------------------------------------------------------------
// Confirm modal
// -----------------------------------------------------------------------
function openConfirm(title, text, confirmLabel, action) {
  elements.confirmModalTitle.textContent = title;
  elements.confirmModalText.textContent = text;
  elements.confirmOkButton.textContent = confirmLabel;
  pendingConfirm = action;
  elements.confirmModal.hidden = false;
  elements.confirmOkButton.focus();
}

function closeConfirm() {
  elements.confirmModal.hidden = true;
  pendingConfirm = null;
}

// -----------------------------------------------------------------------
// Data grouping
// -----------------------------------------------------------------------
function groupByOwner(flatRooms) {
  const map = new Map();

  for (const room of flatRooms) {
    const key = room.owner_id || "__unowned__";
    if (!map.has(key)) {
      map.set(key, {
        owner_id: room.owner_id,
        owner_email: room.owner_email,
        is_anonymous: room.owner_is_anonymous,
        rooms: [],
      });
    }
    map.get(key).rooms.push(room);
  }

  // Named accounts first, then anonymous
  return Array.from(map.values()).sort((a, b) => {
    if (!a.is_anonymous && b.is_anonymous) {
      return -1;
    }
    if (a.is_anonymous && !b.is_anonymous) {
      return 1;
    }
    return 0;
  });
}

// -----------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------
function renderStats(flatRooms, groups) {
  const namedUsers = groups.filter((g) => !g.is_anonymous).length;
  const anonUsers = groups.filter((g) => g.is_anonymous).length;

  elements.adminStats.innerHTML = [
    stat(flatRooms.length, "Live Rooms"),
    stat(groups.length, "Active Users"),
    stat(namedUsers, "Named Accounts"),
    stat(anonUsers, "Anonymous"),
  ].join("");
}

function stat(value, label) {
  return `<div class="admin-stat">
    <span class="admin-stat-val">${value}</span>
    <span class="admin-stat-label">${label}</span>
  </div>`;
}

function renderTable(groups) {
  if (groups.length === 0) {
    elements.adminContent.innerHTML = `<div class="admin-empty">No active rooms right now.</div>`;
    return;
  }

  elements.adminContent.innerHTML = groups
    .map((group) => renderUserGroup(group))
    .join("");
  attachTableListeners();
}

function renderUserGroup(group) {
  const roomCount = group.rooms.length;
  const ownerName = group.is_anonymous
    ? "Anonymous Guest"
    : escapeHtml(group.owner_email || "Unknown");
  const badgeHtml = group.is_anonymous
    ? `<span class="badge badge-anon">Guest</span>`
    : `<span class="badge badge-named">Signed In</span>`;
  const ownerId = escapeHtml(group.owner_id || "");

  const rowsHtml = group.rooms
    .map((room) => {
      const isLow =
        room.created_at &&
        ROOM_TTL_MS - (Date.now() - new Date(room.created_at).getTime()) <
          60 * 60 * 1000;
      return `<tr>
      <td><code class="room-code-cell">${escapeHtml(room.room_code.toUpperCase())}</code></td>
      <td>${room.room_name ? escapeHtml(room.room_name) : '<span class="dim">—</span>'}</td>
      <td class="num-cell">${room.current_number ?? 0}</td>
      <td class="time-cell">${formatTimeAgo(room.created_at)}</td>
      <td class="time-cell">${formatTimeAgo(room.updated_at)}</td>
      <td class="time-cell${isLow ? " expiry-low" : ""}">${formatExpiry(room.created_at)}</td>
      <td>
        <button
          class="danger-btn-sm btn-terminate-room"
          data-room="${escapeHtml(room.room_code)}"
          data-owner="${ownerId}"
        >Terminate</button>
      </td>
    </tr>`;
    })
    .join("");

  return `<div class="user-group">
    <div class="user-group-header">
      <div class="user-group-info">
        <svg class="user-group-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0"/>
          <circle cx="12" cy="8" r="4"/>
        </svg>
        <div>
          <span class="user-group-name">${ownerName}</span>
          <div class="user-group-meta">
            ${badgeHtml}
            <span class="user-group-rooms">${roomCount} room${roomCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
      <button
        class="danger-btn-sm btn-terminate-user"
        data-owner="${ownerId}"
        data-name="${ownerName}"
      >Terminate User's Rooms</button>
    </div>
    <div class="user-rooms-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Queue&nbsp;#</th>
            <th>Created</th>
            <th>Last Active</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>`;
}

// -----------------------------------------------------------------------
// Event listeners attached after each render
// -----------------------------------------------------------------------
function attachTableListeners() {
  document.querySelectorAll(".btn-terminate-room").forEach((btn) => {
    btn.addEventListener("click", () => {
      const roomCode = btn.dataset.room;
      const ownerId = btn.dataset.owner;
      openConfirm(
        "Terminate Room " + roomCode.toUpperCase() + "?",
        "This will permanently delete the room and disconnect everyone watching it.",
        "Terminate",
        () => terminateRoom(roomCode, ownerId),
      );
    });
  });

  document.querySelectorAll(".btn-terminate-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ownerId = btn.dataset.owner;
      const name = btn.dataset.name;
      const userRooms = rooms.filter((r) => (r.owner_id || "") === ownerId);
      openConfirm(
        "Terminate all rooms for " + name + "?",
        "This will permanently delete all " +
          userRooms.length +
          " room(s) owned by this user and disconnect everyone watching.",
        "Terminate All",
        () => terminateUserRooms(ownerId, userRooms),
      );
    });
  });
}

// -----------------------------------------------------------------------
// Admin notification broadcast (best-effort)
// -----------------------------------------------------------------------
async function sendAdminNotify(ownerId, roomCode) {
  if (!ownerId || !supabase) {
    return;
  }
  try {
    const ch = supabase.channel("admin-notify-" + ownerId);
    await new Promise((resolve) => {
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
        }
      });
    });
    await ch.send({
      type: "broadcast",
      event: "room-terminated",
      payload: {
        roomCode,
        message: "This queue was terminated by the administrator.",
      },
    });
    // Brief pause to allow delivery before the row is deleted
    await new Promise((r) => setTimeout(r, 220));
    await supabase.removeChannel(ch);
  } catch (_) {
    // best-effort — do not block the deletion
  }
}

// -----------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------
async function terminateRoom(roomCode, ownerId) {
  setLoading(true);
  try {
    await sendAdminNotify(ownerId, roomCode);
    const { error } = await supabase
      .from("queue_rooms")
      .delete()
      .eq("room_code", roomCode);
    if (error) {
      throw error;
    }
    showToast("Room " + roomCode.toUpperCase() + " terminated.", "success");
    await loadRooms();
  } catch (err) {
    console.error(err);
    showToast("Failed to terminate room.", "error");
  } finally {
    setLoading(false);
  }
}

async function terminateUserRooms(ownerId, userRooms) {
  setLoading(true);
  let anyError = false;
  try {
    for (const room of userRooms) {
      try {
        await sendAdminNotify(ownerId, room.room_code);
        const { error } = await supabase
          .from("queue_rooms")
          .delete()
          .eq("room_code", room.room_code);
        if (error) {
          throw error;
        }
      } catch (err) {
        console.error(err);
        anyError = true;
      }
    }
    showToast(
      anyError
        ? "Some rooms could not be terminated."
        : "All user rooms terminated.",
      anyError ? "error" : "success",
    );
    await loadRooms();
  } finally {
    setLoading(false);
  }
}

async function terminateAllRooms() {
  setLoading(true);
  let anyError = false;
  try {
    for (const room of [...rooms]) {
      try {
        await sendAdminNotify(room.owner_id, room.room_code);
        const { error } = await supabase
          .from("queue_rooms")
          .delete()
          .eq("room_code", room.room_code);
        if (error) {
          throw error;
        }
      } catch (err) {
        console.error(err);
        anyError = true;
      }
    }
    showToast(
      anyError
        ? "Some rooms could not be terminated."
        : "All rooms terminated.",
      anyError ? "error" : "success",
    );
    await loadRooms();
  } finally {
    setLoading(false);
  }
}

// -----------------------------------------------------------------------
// Data loading
// -----------------------------------------------------------------------
async function loadRooms() {
  try {
    const { data, error } = await supabase.rpc("admin_get_all_rooms");
    if (error) {
      throw error;
    }
    rooms = Array.isArray(data) ? data : [];
    const groups = groupByOwner(rooms);
    renderStats(rooms, groups);
    renderTable(groups);
  } catch (err) {
    console.error(err);
    elements.adminContent.innerHTML = `<div class="admin-empty admin-error">
      Failed to load rooms. Make sure you ran Section 4 of supabase-rls.sql.
    </div>`;
  }
}

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel("admin-live-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "queue_rooms" },
      () => {
        loadRooms();
      },
    )
    .subscribe();
}

// -----------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------
async function boot() {
  if (!isSupabaseConfigured()) {
    elements.adminContent.innerHTML = `<div class="admin-empty">Supabase is not configured in js/config.js.</div>`;
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  const user = data?.session?.user;

  // Guard: must be a named (non-anonymous) authenticated user
  if (error || !user || user.is_anonymous === true) {
    window.location.href = "index.html";
    return;
  }

  await loadRooms();
  subscribeRealtime();

  // Auto-refresh time columns every 30s without a DB round-trip
  setInterval(() => {
    const groups = groupByOwner(rooms);
    renderStats(rooms, groups);
    renderTable(groups);
  }, 30000);

  // ---- Event listeners ----

  elements.terminateAllButton.addEventListener("click", () => {
    if (rooms.length === 0) {
      showToast("No active rooms to terminate.", "info");
      return;
    }
    openConfirm(
      "Terminate ALL " + rooms.length + " room(s)?",
      "This will permanently delete every active room and disconnect all users. This cannot be undone.",
      "Terminate All",
      terminateAllRooms,
    );
  });

  elements.refreshButton.addEventListener("click", async () => {
    elements.refreshButton.disabled = true;
    await loadRooms();
    elements.refreshButton.disabled = false;
    showToast("Refreshed.", "info");
  });

  elements.confirmOkButton.addEventListener("click", async () => {
    if (!pendingConfirm) {
      return;
    }
    const action = pendingConfirm;
    closeConfirm();
    await action();
  });

  elements.cancelConfirmButton.addEventListener("click", closeConfirm);

  elements.confirmModal.addEventListener("click", (e) => {
    if (e.target === elements.confirmModal) {
      closeConfirm();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elements.confirmModal.hidden) {
      closeConfirm();
    }
  });
}

boot();
