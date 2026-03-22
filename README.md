# Pila

A lightweight, real-time queue management system built with vanilla HTML/CSS/JS and powered by [Supabase](https://supabase.com) for live sync.

---

## Pages

| Page | File | Purpose |
|---|---|---|
| Dashboard | `index.html` | Launch a host session or join a client display |
| Host Control Center | `host.html` | Manage the live queue |
| Client Display | `client.html` | Public-facing screen showing the current number |

---

## How It Works

1. **Sign in** on the Dashboard with your host account.
2. **Create a room** — a unique 6-character room code is generated.
3. **Open Host** — launches `host.html` bound to that room code.
4. **Share access** — the host panel exposes the room code, a direct client link, and a QR code.
5. **Join display** — clients open `client.html` via the link, QR scan, or by entering the code on the dashboard. The display updates in real time whenever the host advances the queue.

---

## Features

- **Real-time sync** via Supabase Realtime — no polling, no page refreshes.
- **Queue controls** — Next, Back, Jump to number, Reset, and End Queue.
- **Auto-speak** — announces the current number via the Web Speech API.
- **Alert ripple** — triggers a full-screen ripple animation on the client display.
- **QR code** — generated automatically for each session so clients can scan and join.
- **Watcher count** — live count of connected client displays.
- **Room naming** — customize the display name shown on the client screen.
- **Settings persistence** — auto-speak and auto-alert preferences are saved to `localStorage`.

---

## Project Structure

```
index.html          # Dashboard
host.html           # Host Control Center
client.html         # Client Display
css/
  index.css
  host.css
  client.css
js/
  config.js         # Supabase credentials and client factory
  index.js          # Dashboard logic (auth, room generation, QR scanner)
  host.js           # Host logic (queue ops, realtime, settings)
  client.js         # Client logic (realtime subscription, alert ripple)
```

---

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Open `js/config.js` and replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project credentials.
3. Serve the files from any static host or open `index.html` directly in a browser.

> The app will display a configuration notice at the top of each page if Supabase is not yet configured.

---

## Dependencies

All dependencies are loaded via CDN — no build step or `npm install` required.

| Package | Version | Used for |
|---|---|---|
| `@supabase/supabase-js` | 2 | Realtime database sync and auth |
| `qrcode` | 1.5.4 | QR code generation on the host panel |
| `jsQR` | (via CDN) | QR code scanning on the dashboard |
