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

1. **Sign in** on the Dashboard — as a named account or as a Guest.
2. **Create a room** — a unique 6-character code is auto-generated, or type a custom code (e.g. `A12345`) to reuse a printed QR poster every day (subject to room availability).
3. **Open Host** — launches `host.html` bound to that room code.
4. **Share access** — the host panel exposes the room code, a direct client link, a QR canvas, and a **Print QR** button that generates a ready-to-print A4 poster.
5. **Join display** — clients open `client.html` via the link, by scanning the QR code with any phone camera, or by entering the code on the dashboard. The display updates in real time whenever the host advances the queue.

---

## Features

### Queue Operations
- **Real-time sync** via Supabase Realtime — no polling, no page refreshes.
- **Queue controls** — Next, Back, Jump to number, Reset, and End Queue.
- **Watcher count** — live count of connected client displays.
- **Room expiry** — rooms have a configurable TTL shown in the host stats bar.

### Announcements
- **Speak** — announces the current number on the host device via the Web Speech API.
- **Chime** — plays an audio tone on the host device and all connected client displays simultaneously.
- **Tint** — flashes the client display background with a rapid color sequence (red → yellow → green) as a TV-friendly visual alert.
- **Auto-announce** — each of the three announcement types can be triggered automatically on every queue advance.

### Access & Sharing
- **Room naming** — customize the display name shown on the client screen.
- **QR code** — generated automatically for each session.
- **Print QR** — opens a print-ready A4 page with a large QR code, room name, and scan instructions. No external service required.
- **QR scanner** — on the dashboard, scan a printed QR code to open the client display. Uses the native `BarcodeDetector` API where available, with a [goqr.me](https://goqr.me/api/) API fallback for full browser compatibility.
- **Custom room codes** — type a fixed code (format: 1 letter + 5 digits) to reuse a printed QR poster across multiple sessions.

### Auth & Security
- **Guest sign-in** — instant anonymous access via Supabase anonymous auth; no email required.
- **Named accounts** — email + password sign-in with hCaptcha verification.
- **Room limit** — maximum 5 concurrent rooms per host account.
- **Collision-safe room codes** — new codes are checked against the database before use; retries up to 5 times with an 8-character fallback.
- **Settings persistence** — all auto-announce preferences are saved to `localStorage`.

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
  host.js           # Host logic (queue ops, realtime, announcements, print QR)
  client.js         # Client logic (realtime, chime, tint flash)
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
| `qrcode` | 1.5.4 | QR code generation and print poster |
| `hcaptcha` | — | Bot protection for named account sign-in |
