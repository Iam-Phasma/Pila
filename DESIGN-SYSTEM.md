# Design System — Pila

A complete reference for all visual and UI conventions used in this project. Copy tokens, classes, and patterns into new projects.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Tokens](#color-tokens)
3. [Typography](#typography)
4. [Spacing & Border Radius](#spacing--border-radius)
5. [Shadows](#shadows)
6. [Layout & Shell](#layout--shell)
7. [Header](#header)
8. [Footer](#footer)
9. [Panels & Cards](#panels--cards)
10. [Buttons](#buttons)
11. [Form Inputs](#form-inputs)
12. [Modals & Popups](#modals--popups)
13. [Filter & Sort Panels](#filter--sort-panels)
14. [Tables](#tables)
15. [Multiselect Component](#multiselect-component)
16. [Autocomplete Dropdown](#autocomplete-dropdown)
17. [Status & Feedback](#status--feedback)
18. [Toasts](#toasts)
19. [Animations & Transitions](#animations--transitions)
20. [Scrollbars](#scrollbars)
21. [Pills & Badges](#pills--badges)
22. [Background Treatment](#background-treatment)
23. [Responsive Breakpoints](#responsive-breakpoints)

---

## Design Philosophy

- **Clean government aesthetic** — light backgrounds, navy ink, calm blue accents.
- **No dark mode** — pure white panels, mist-gray page body.
- **Soft elevation** — cards lift via box-shadow, never solid drop shadows.
- **Consistent radius** — rounded corners everywhere, never sharp rectangles.
- **Micro-animations** — subtle `fadeUp` on panel entry, dropdown slide-in, toast pop-in.
- **Static-hostable** — no server-side rendering; works as a GitHub Pages / Supabase static app.

---

## Color Tokens

Defined on `:root` in `styles.css`. Reference with `var(--token)`.

### Base Palette

| Token            | Value                    | Role                                         |
| ---------------- | ------------------------ | -------------------------------------------- |
| `--ink`          | `#0b1c3b`                | Primary text, headings, dark buttons         |
| `--mist`         | `#f4f6fa`                | Page background                              |
| `--sun`          | `#e6ecf5`                | Subtle highlight / surface accent            |
| `--sea`          | `#2f6fe4`                | Primary accent (buttons, links, focus rings) |
| `--clay`         | `#7ea2e8`                | Lighter accent, date-picker highlights       |
| `--glass`        | `#ffffff`                | Card / panel background                      |
| `--surface`      | `#ffffff`                | General surface                              |
| `--surface-soft` | `#f8fafd`                | Form-card / secondary surface                |
| `--line`         | `rgba(11, 28, 59, 0.11)` | Dividers, borders                            |
| `--red`          | `rgb(161, 37, 27)`       | Destructive / danger                         |

### Hover States

| Token                        | Value                      | Use                            |
| ---------------------------- | -------------------------- | ------------------------------ |
| `--hover-ink`                | `#164ab3`                  | Dark button hover              |
| `--hover-sea`                | `#285fca`                  | Primary button hover           |
| `--hover-neutral-soft`       | `rgba(15, 26, 31, 0.18)`   | Ghost / secondary button hover |
| `--hover-sea-subtle`         | `rgba(47, 111, 228, 0.10)` | Row hover, subtle hover areas  |
| `--hover-sea-soft`           | `rgba(47, 111, 228, 0.18)` | Secondary button hover         |
| `--hover-accent-soft`        | `rgba(47, 111, 228, 0.12)` | Accent hover tint              |
| `--hover-danger-soft`        | `rgba(161, 37, 27, 0.24)`  | Danger ghost hover             |
| `--hover-danger-solid`       | `#8a1f17`                  | Danger button active/hover     |
| `--hover-success-solid`      | `#3d7a3d`                  | Success button hover           |
| `--hover-warning-soft`       | `rgba(216, 180, 0, 0.38)`  | Warning ghost hover            |
| `--hover-success-soft`       | `rgba(76, 153, 76, 0.24)`  | Success ghost hover            |
| `--hover-warning-muted-soft` | `rgba(153, 102, 51, 0.24)` | Warning muted ghost hover      |

### Semantic Status Colors (non-token, direct hex)

| Role                 | Color                    |
| -------------------- | ------------------------ |
| Success text         | `#12734a`                |
| Error text           | `#a1251b`                |
| Warning text         | `#92620a`                |
| Muted / neutral text | `rgba(15, 26, 31, 0.75)` |

### Toast Backgrounds

| Variant | Color                     |
| ------- | ------------------------- |
| Success | `rgba(18, 115, 74, 0.95)` |
| Info    | `rgba(37, 99, 235, 0.95)` |
| Warning | `rgba(234, 88, 12, 0.95)` |
| Error   | `rgba(220, 38, 38, 0.95)` |

---

## Typography

### Font

```css
@import url("https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap");

font-family:
  "Inter",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

> **Privacy note:** `fonts.bunny.net` is a GDPR-friendly/privacy-respecting alternative to Google Fonts.

### Scale

| Element / Class         | Size                            | Weight   | Notes                                                     |
| ----------------------- | ------------------------------- | -------- | --------------------------------------------------------- |
| `h1` / `.page-title`    | `2rem`                          | `700`    | Page title                                                |
| Login hero `h1`         | `clamp(2.1rem, 1.8vw, 1.35rem)` | `700`    | Responsive login heading                                  |
| `.sticky-header-title`  | `1rem`                          | `700`    | Top bar app name                                          |
| `.panel h2`             | `1.2rem`                        | inherits | Panel section heading                                     |
| `.modal-content h3`     | `1.4rem`                        | —        | Modal heading                                             |
| `.filter-content h3`    | `1.1rem`                        | —        | Filter panel heading                                      |
| `label`                 | `0.95rem`                       | `600`    | Form labels                                               |
| `input` / body text     | `1rem`                          | `400`    | Default inputs and body                                   |
| `.page-description`     | `1rem`                          | `400`    | Subtitle below page title, `line-height: 1.6`             |
| `.welcome-message`      | `0.95rem`                       | `400`    | Banner notice                                             |
| `.status`               | `0.92rem`                       | —        | Inline feedback text                                      |
| `.disclaimer`           | `0.82rem`                       | —        | Helper text below inputs                                  |
| `.detail-label`         | `0.95rem`                       | `700`    | Label in detail view, uppercase, `letter-spacing: 0.02em` |
| `.detail-value`         | `1rem`                          | —        | Value in detail view                                      |
| `.data-table th`        | `0.8rem`                        | —        | Table column headers, uppercase, `letter-spacing: 0.02em` |
| `.data-table td`        | `0.9rem`                        | —        | Table cell text                                           |
| `.sticky-header-kicker` | `0.66rem`                       | `700`    | Sub-kicker above header title, all-caps                   |
| `.footer-eyebrow`       | `0.72rem`                       | `700`    | Footer brand kicker, all-caps                             |
| `.footer-brand-copy h3` | `0.92rem`                       | `600`    | Footer org name                                           |
| `.footer-brand-copy p`  | `0.82rem`                       | —        | Footer description                                        |
| `.footer-links a`       | `0.78rem`                       | `500`    | Footer nav links                                          |
| `.multiselect-tag`      | `0.88rem`                       | `500`    | Multiselect selected tag                                  |
| `.login-utility-note`   | `0.82rem`                       | —        | Small login page note                                     |
| `.forgot-password-link` | `0.94rem`                       | `600`    | Forgot password link                                      |

---

## Spacing & Border Radius

### Border Radius Tokens

| Token         | Value  | Used on                         |
| ------------- | ------ | ------------------------------- |
| `--radius-sm` | `8px`  | Small buttons, tags             |
| `--radius-md` | `10px` | Standard buttons, inputs        |
| `--radius-lg` | `12px` | Dropdown panels, cards          |
| `--radius-xl` | `14px` | Main panels, modals, login card |

> Special cases: inputs use `14px` directly; table wraps use `16px`; modals on mobile use `16px`.

### Common Padding Patterns

| Component                         | Padding                                     |
| --------------------------------- | ------------------------------------------- |
| `.panel`                          | `28px 28px 18px 28px`                       |
| `#login-panel`                    | `26px 38px 18px` (mobile: `34px 22px 26px`) |
| `.modal-content`                  | `32px` (mobile: `24px`)                     |
| `.modal-header`                   | `20px 24px 8px 24px`                        |
| `.modal-body`                     | `0 24px 24px 24px`                          |
| `.modal-footer`                   | `16px 24px`                                 |
| `.filter-panel`                   | `20px`                                      |
| `.settings-section`               | `14px`                                      |
| `button` (default)                | `12px 18px`                                 |
| `.modal-btn`                      | `10px 20px` (mobile: `16px 20px`)           |
| `.btn-primary` / `.btn-secondary` | `10px 20px`                                 |
| `.pagination-btn`                 | `8px 16px`                                  |
| `.header-doc-btn`                 | `0 12px` (min-height: `40px`)               |
| `.header-user-btn`                | `0 14px` (min-height: `40px`)               |

---

## Shadows

| Token / Direct  | Value                                | Used on                      |
| --------------- | ------------------------------------ | ---------------------------- |
| `--shadow`      | `0 8px 20px rgba(11, 28, 59, 0.08)`  | Main panels, login panel     |
| `--shadow-soft` | `0 4px 12px rgba(11, 28, 59, 0.06)`  | Minor cards, welcome banner  |
| Header          | `0 2px 8px rgba(11, 28, 59, 0.04)`   | Sticky header bottom shadow  |
| Header popup    | `0 10px 24px rgba(11, 28, 59, 0.12)` | User dropdown popup          |
| Filter panel    | `0 10px 40px rgba(15, 26, 31, 0.25)` | Filter / sort floating panel |
| Modal           | `0 20px 60px rgba(12, 21, 24, 0.30)` | Modal dialog content box     |
| Admin switcher  | `0 4px 12px rgba(11, 28, 59, 0.05)`  | Tab switcher pill bar        |

---

## Layout & Shell

### Max-widths

| Context               | Max-width                         |
| --------------------- | --------------------------------- |
| Default content       | `min(1100px, calc(100vw - 36px))` |
| Wide admin panel      | `min(1550px, calc(100vw - 36px))` |
| Header / Footer inner | `min(1120px, calc(100vw - 32px))` |
| Standard panel        | `min(640px, 100%)`                |
| Login panel           | `min(580px, calc(100vw - 36px))`  |
| Upload panel          | `min(650px, calc(100vw - 36px))`  |

### Page Skeleton

```html
<body>
  <div id="header-container"></div>
  <!-- sticky header injected here -->
  <main class="page-content">
    <div class="shell">/* Lines 213-214 omitted */</div>
  </main>
  <div id="footer-container"></div>
</body>
```

- `.page-content` has `margin-top: 72px` to clear the sticky header, `padding: 32px 18px 0`.
- `.shell` uses `display: grid; gap: 28px; justify-items: center; margin-bottom: 50px`.
- Login page uses `body.login-page` which centers the shell vertically: `min-height: calc(100vh - 170px); align-content: center`.

---

## Header

**File:** `header/header.css`

### Structure

```
.sticky-header
  └─ .sticky-header-content
       ├─ .sticky-header-left
```

### Key Sizes

| Element                                | Size                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| `.sticky-header`                       | `min-height: 64px`, `position: fixed`, `z-index: 999` |
| `.sticky-header-logo`                  | `height: 36px`                                        |
| `.header-doc-btn` / `.header-user-btn` | `min-height: 40px`, `border-radius: 10px`             |
| `.header-icon-btn`                     | `38×38px`, `border-radius: 999px` (circle)            |

### Header Doc Button

```css
/* default */
background: rgba(47, 111, 228, 0.06);
border: 1px solid rgba(47, 111, 228, 0.2);
color: rgba(11, 28, 59, 0.76);
font-size: 0.8rem;
font-weight: 600;
transition:
  background 180ms ease,
  border-color 180ms ease,
  color 180ms ease;

/* hover */
background: rgba(47, 111, 228, 0.12);
border-color: rgba(47, 111, 228, 0.3);
```

### Header User Button

```css
/* default */
background: #ffffff;
border: 1px solid rgba(11, 28, 59, 0.12);
box-shadow: 0 2px 8px rgba(11, 28, 59, 0.04);
transition:
  background 180ms ease,
  border-color 180ms ease,
  box-shadow 180ms ease;

/* hover */
background: rgba(47, 111, 228, 0.08);
border-color: rgba(47, 111, 228, 0.22);
box-shadow: 0 4px 10px rgba(47, 111, 228, 0.08);
```

### Header Popup / User Dropdown

```css
position: absolute;
top: 50px;
right: 0;
background: #ffffff;
border-radius: 12px;
padding: 8px;
box-shadow: 0 10px 24px rgba(11, 28, 59, 0.12);
border: 1px solid rgba(11, 28, 59, 0.08);
min-width: 220px;

/* hidden */
opacity: 0;
visibility: hidden;
transform: translateY(-10px);
transition:
  opacity 180ms ease,
  transform 180ms ease,
  visibility 180ms ease;

/* .show */
opacity: 1;
visibility: visible;
transform: translateY(0);
```

Menu option (`.header-popup-option`):

```css
padding: 12px 14px;
border-radius: 12px;
font-size: 0.92rem;
font-weight: 600;
transition: background 180ms ease;

/* hover */
background: rgba(47, 111, 179, 0.08);
```

---

## Footer

**File:** `footer/footer.css`

```
.gov-footer
  └─ .footer-content  (grid: 1.6fr auto auto, gap: 16px)
       ├─ .footer-brand
```

- White background, `border-top: 1px solid rgba(11, 28, 59, 0.08)`, `padding: 18px 0`.
- Footer links: `color: var(--sea)`, hover `color: var(--hover-sea)` + underline.
- Collapses to single-column at `980px`, stacks brand at `640px`.

---

## Panels & Cards

### Base Panel

```css
.panel {
  background: var(--glass); /* #ffffff */
  border-radius: var(--radius-xl); /* 14px */
  padding: 28px 28px 18px 28px;
  box-shadow: var(--shadow);
  border: 1px solid var(--line);
  display: grid;
  gap: 14px;
  animation: fadeUp 500ms ease-out both;
}
```

### Variants

| Class           | Width / Notes                               |
| --------------- | ------------------------------------------- |
| `.panel`        | `min(640px, 100%)` — default narrow         |
| `.wide-panel`   | `min(1550px, calc(100vw - 36px))`           |
| `#login-panel`  | `min(580px, ...)`, padding `26px 38px 18px` |
| `#upload-panel` | `min(650px, ...)`                           |

### Form Sub-Cards (inside panels)

```css
.employee-form-card,
.employee-directory-card {
  background: var(--surface-soft); /* #f8fafd */
  border: 1px solid var(--line);
  border-radius: var(--radius-lg); /* 12px */
  padding: 22px;
}
```

### Settings Section

```css
.settings-section {
  background: rgba(248, 250, 252, 0.96);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 14px;
}
```

### Welcome Banner / Message

```css
.welcome-message {
  background: rgba(255, 255, 255, 0.94);
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  font-size: 0.95rem;
  line-height: 1.6;
  box-shadow: var(--shadow-soft);
}
```

### Admin Panel Switcher (Tab Bar)

```css
.admin-panel-switcher {
  display: flex;
  gap: 8px;
  position: sticky;
  top: 64px;
  z-index: 30;
  padding: 8px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(11, 28, 59, 0.1);
  box-shadow: 0 4px 12px rgba(11, 28, 59, 0.05);
  transition:
    box-shadow 220ms ease,
    background-color 220ms ease;
}

/* Tab button */
.switch-btn {
  width: 160px;
  height: 44px;
  border: 1px solid rgba(47, 111, 228, 0.2);
  border-radius: 10px;
  background: transparent;
  color: rgba(11, 28, 59, 0.72);
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
}

/* hover */
.switch-btn:hover {
  background: var(--hover-sea-subtle);
  color: var(--sea);
  border-color: rgba(47, 111, 228, 0.28);
}

/* active/selected */
.switch-btn.active {
  background: var(--sea);
  color: #ffffff;
  border-color: var(--sea);
  font-weight: 600;
}
```

---

## Buttons

### Base Button

```css
button {
  cursor: pointer;
  border: none;
  padding: 12px 18px;
  border-radius: var(--radius-md); /* 10px */
  font-weight: 700;
  background: var(--ink);
  color: var(--mist);
  font-family: inherit;
  transition:
    background 150ms ease,
    color 150ms ease;
}
button:hover {
  background: var(--hover-ink);
}
```

### Button Variants

| Class                      | Background               | Text                  | Hover BG                               |
| -------------------------- | ------------------------ | --------------------- | -------------------------------------- |
| `button` (base)            | `var(--ink)` `#0b1c3b`   | `var(--mist)`         | `var(--hover-ink)` `#164ab3`           |
| `.btn-primary`             | `var(--sea)` `#2f6fe4`   | `white`               | `var(--hover-ink)`                     |
| `.btn-primary:disabled`    | `rgba(47,111,228,0.45)`  | white                 | — cursor: not-allowed                  |
| `.btn-secondary`           | `rgba(47,111,179,0.10)`  | `var(--ink)`          | `var(--hover-sea-soft)`                |
| `.secondary-btn`           | `rgba(11,28,59,0.08)`    | `var(--ink)`          | `var(--hover-neutral-soft)`            |
| `.logout-btn`              | `var(--sea)`             | —                     | `var(--hover-sea)`                     |
| `.modal-btn`               | —                        | —                     | — (see below)                          |
| `.modal-btn.cancel`        | `rgba(11,28,59,0.08)`    | `var(--ink)`          | `rgba(11,28,59,0.12)`                  |
| `.modal-btn.confirm`       | `var(--sea)`             | white                 | `var(--hover-ink)`                     |
| `#confirm-delete`          | `var(--red)`             | white                 | `var(--hover-danger-solid)`            |
| `.pagination-btn`          | `var(--sea)`             | `var(--mist)`         | `var(--hover-sea)`                     |
| `.pagination-btn:disabled` | —                        | —                     | opacity `0.55`                         |
| `.filter-icon-btn`         | `rgba(255,255,255,0.94)` | `rgba(11,28,59,0.76)` | `var(--hover-sea-subtle)` + sea border |
| `.filter-icon-btn.active`  | `var(--sea)`             | white                 | `var(--hover-ink)`                     |
| `.filter-btn.apply-btn`    | `var(--sea)`             | white                 | `var(--hover-ink)`                     |
| `.filter-btn.clear-btn`    | `rgba(11,28,59,0.08)`    | `var(--ink)`          | lighter neutral                        |

### Icon Buttons

```css
/* Filter / panel action icon button */
.filter-icon-btn {
  min-height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(47, 111, 228, 0.2);
  gap: 6px; /* icon + label */
}
.filter-icon-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
.filter-icon-btn .btn-label {
  font-size: 0.85rem;
  font-weight: 600;
}

/* Round icon button (header) */
.header-icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(15, 26, 31, 0.25);
  background: white;
  transition: all 250ms ease;
}
.header-icon-btn:hover {
  background: var(--hover-sea-subtle);
  border-color: var(--sea);
}
```

### New-Data Pulse (Refresh Button)

```css
@keyframes new-data-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}
.filter-icon-btn.has-new-data {
  animation: new-data-pulse 1.4s ease-out infinite;
  color: var(--sea);
  background: rgba(0, 52, 113, 0.12);
}
```

### Login Submit Button

```css
#login-btn {
  width: 100%;
  min-height: 44px;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  background: var(--sea);
}
```

---

## Form Inputs

### Text / Email / Password

```css
input[type="text"],
input[type="email"],
input[type="password"],
input[type="file"] {
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #ffffff;
  font-size: 1rem;
  line-height: 1.5;
  outline: none;
}

/* Focus */
input:focus {
  border-color: rgba(59, 130, 246, 0.7);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
}

/* Placeholder */
input::placeholder {
  color: rgba(15, 26, 31, 0.45);
  opacity: 1;
}
```

### Input With Icon Wrapper

```html
<div class="input-wrap">
  <span class="icon" aria-hidden="true">
    <!-- SVG icon -->
  </span>
  <input type="text" ... />
</div>
```

```css
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-wrap .icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
}
.input-wrap input {
  padding-left: 40px;
} /* make room for icon */
```

### Password Toggle Button

```css
.password-visibility-btn {
  position: absolute;
  top: 1px;
  right: 1px;
  bottom: 1px;
  width: 46px;
  border-radius: 0 calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px) 0;
  border-left: 1px solid rgba(17, 24, 39, 0.08);
  background: transparent;
}
.password-visibility-btn:hover {
  background: rgba(17, 24, 39, 0.04);
}
```

### Label

```css
label {
  font-size: 0.95rem;
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
  color: #111827;
}
.required {
  color: #a1251b;
  margin-left: 4px;
}
.disclaimer {
  margin-top: 6px;
  font-size: 0.82rem;
  color: rgba(15, 26, 31, 0.6);
}
```

### Checkbox

```css
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  user-select: none;
}
.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--sea);
}
```

### Field Layout

```css
.fields {
  display: grid;
  gap: 10px;
}
.field-row {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
```

### Filter Panel Inputs / Selects

```css
.filter-field input[type="text"] {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 26, 31, 0.15);
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
}

.filter-field select.filter-select {
  width: 100%;
  /* same style as filter input */
}
```

---

## Modals & Popups

### Overlay / Backdrop

```css
.modal {
  position: fixed;
  inset: 0;
  background: rgba(11, 28, 59, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal.hidden {
  display: none;
}
```

### Modal Content Box

```css
/* Standard small modal */
.modal-content {
  background: white;
  border-radius: var(--radius-xl); /* 14px */
  padding: 32px;
  max-width: 440px;
  width: 90%;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(12, 21, 24, 0.3);
  animation: fadeUp 300ms ease-out both;
}

/* Form modal (wider) */
.modal-content.modal-form {
  max-width: 560px;
}

/* Larger form-style modal (admin) */
/* header-draft-ta-modal-content: max-width: 780px */
```

### Modal Structure

```
.modal-content
  ├─ .modal-header     (padding: 20px 24px 8px 24px)
  │    ├─ h3           (1.2rem)
  │    └─ .close-modal (28px ×, 32×32px button)
  ├─ .modal-body       (padding: 0 24px 24px 24px)
  └─ .modal-footer     (padding: 16px 24px, flex, justify: flex-end)
```

### Detail View Layout (inside modal)

```css
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 18px 0 24px;
}
.detail-row-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.detail-divider {
  border-top: 1px solid #e3e8f0;
  opacity: 0.7;
}
.detail-row {
  display: grid;
  gap: 6px;
}
.detail-row-dual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.detail-label {
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgba(15, 26, 31, 0.7);
}
.detail-value {
  font-size: 1rem;
  color: var(--ink);
}
```

### File Link

```css
.file-link {
  display: inline-block;
  padding: 8px 15px;
  border-radius: var(--radius-sm);
  background: var(--hover-sea-subtle);
  color: var(--sea);
  font-weight: 600;
  text-decoration: none;
  transition: background 200ms ease;
}
.file-link:hover {
  background: rgba(47, 111, 179, 0.25);
}
```

### Close Button (X)

```css
.close-modal {
  background: none;
  border: none;
  font-size: 28px;
  color: rgba(15, 26, 31, 0.5);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition:
    background 150ms ease,
    color 150ms ease;
}
.close-modal:hover {
  background: var(--hover-sea-subtle);
  color: var(--ink);
}
```

### Z-Index Stack

| Layer               | z-index |
| ------------------- | ------- |
| Sticky header       | `999`   |
| Standard modal      | `1000`  |
| Toast notifications | `1100`  |
| Settings modal      | `1200`  |
| Confirm modal       | `1300`  |

---

## Filter & Sort Panels

Floating panels anchored to the top-right of a `.panel`:

```css
.filter-panel {
  position: absolute;
  top: 70px;
  right: 28px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 40px rgba(15, 26, 31, 0.25);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(15, 26, 31, 0.12);
  z-index: 100;
  min-width: 320px;
  max-width: 400px;

  /* hidden state */
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 250ms ease;
}
.filter-panel.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
```

Filter action buttons:

```css
.filter-btn {
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
.filter-btn.apply-btn {
  background: var(--sea);
  color: white;
}
.filter-btn.apply-btn:hover {
  background: var(--hover-ink);
}
.filter-btn.clear-btn {
  background: rgba(11, 28, 59, 0.08);
  color: var(--ink);
}
```

---

## Tables

### Wrapper

```css
.table-wrap {
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  border-radius: 16px;
  border: 1px solid rgba(15, 26, 31, 0.12);
  background: rgba(255, 255, 255, 0.75);
}

.table-wrap.max-rows-10 {
  max-height: 500px;
  scroll-behavior: smooth;
}
```

### Table

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

/* Cells */
.data-table th,
.data-table td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(15, 26, 31, 0.1);
  vertical-align: middle;
}

/* Sticky header row */
.data-table thead th {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.95);
  z-index: 2;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgba(15, 26, 31, 0.7);
  white-space: nowrap;
}

/* Sticky first column */
.data-table th:first-child,
.data-table td:first-child {
  position: sticky;
  left: 0;
  background: rgba(255, 255, 255, 0.95);
  z-index: 1;
}

/* Row hover */
.data-table tbody tr:hover {
  background: rgba(207, 228, 255, 0.35);
}

/* Demo/test rows */
.data-table tbody tr.is-demo {
  background: rgba(255, 172, 172, 0.2);
}
.data-table tbody tr.is-demo:hover {
  background: rgba(255, 132, 132, 0.243);
}
```

### Pagination

```css
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.pagination-btn {
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  background: var(--sea);
  color: var(--mist);
}
.pagination-btn:hover:not(:disabled) {
  background: var(--hover-sea);
}
.pagination-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
```

---

## Multiselect Component

A custom multi-select for selecting multiple options (e.g., officials/employees).

```
.multiselect-wrapper (position: relative)
  ├─ .multiselect-display     (trigger, shows selected tags)
  │    ├─ .multiselect-placeholder  (empty state text)
  │    └─ .multiselect-tag × N     (selected items)
  │         └─ .multiselect-remove  (× button per tag)
  └─ .multiselect-dropdown    (absolute positioned, animated)
       ├─ .multiselect-search-wrapper
```

```css
/* Display box */
.multiselect-display {
  min-height: 44px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 26, 31, 0.12);
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  transition: all 200ms ease;
}
.multiselect-display:hover {
  border-color: rgba(15, 26, 31, 0.2);
  background: rgba(255, 255, 255, 0.95);
}

/* Tag */
.multiselect-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--sea);
  color: white;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
}

/* Dropdown */
.multiselect-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border-radius: 12px;
  border: 1px solid rgba(15, 26, 31, 0.12);
  box-shadow: 0 8px 24px rgba(15, 26, 31, 0.15);
  max-height: 280px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 200ms ease;
}
.multiselect-dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

/* Option hover */
.multiselect-option:hover {
  background: rgba(47, 111, 179, 0.1);
}
```

---

## Autocomplete Dropdown

```css
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 10px;
}

.autocomplete-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 200ms ease;
  color: var(--ink);
  border-bottom: 1px solid rgba(15, 26, 31, 0.08);
}
.autocomplete-item:hover,
.autocomplete-item.highlighted {
  background-color: var(--hover-sea-subtle);
  color: var(--sea);
  font-weight: 500;
}
```

---

## Status & Feedback

### Status Text

```css
.status {
  display: block;
  font-size: 0.92rem;
  color: rgba(15, 26, 31, 0.75);
  line-height: 1.5;
  word-wrap: break-word;
}
.status--neutral {
  color: rgba(15, 26, 31, 0.75);
}
.status--success {
  color: #12734a;
}
.status--error {
  color: #a1251b !important;
}
.status--warning {
  color: #92620a;
}
```

### Shake Animation (error feedback)

```css
.status--shake {
  animation: statusShake 300ms ease-in-out;
}

@keyframes statusShake {
  0% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
  100% {
    transform: translateX(0);
  }
}
```

---

## Toasts

```css
/* Base toast (position fixed, bottom-right typical) */
.toast {
  background: rgba(18, 115, 74, 0.95);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 12px 30px rgba(12, 21, 24, 0.2);
  border-radius: /* project-specific */;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition:
    opacity 200ms ease,
    transform 200ms ease;
  z-index: 1100;
}
.toast.show {
  opacity: 1;
  transform: translateY(0);
}

/* Variants */
.toast.toast--success {
  background: rgba(18, 115, 74, 0.95);
}
.toast.toast--info {
  background: rgba(37, 99, 235, 0.95);
}
.toast.toast--warning {
  background: rgba(234, 88, 12, 0.95);
}
.toast.toast--error {
  background: rgba(220, 38, 38, 0.95);
}
```

---

## Animations & Transitions

### `fadeUp` — Panel / Modal Entry

Used on `.panel` (500ms) and `.modal-content` (300ms) on mount.

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Panel */
animation: fadeUp 500ms ease-out both;

/* Modal content */
animation: fadeUp 300ms ease-out both;
```

### Dropdown / Popup Slide-In

Used on filter panels, multiselect dropdown, header popup.

```css
/* Hidden */
opacity: 0;
visibility: hidden;
transform: translateY(-10px);
transition:
  opacity 180–250ms ease,
  transform 180–250ms ease,
  visibility 180–250ms ease;

/* Visible (.show) */
opacity: 1;
visibility: visible;
transform: translateY(0);
```

### Toast Pop-In

```css
opacity: 0;
transform: translateY(8px);
transition:
  opacity 200ms ease,
  transform 200ms ease;
/* shown: */
opacity: 1;
transform: translateY(0);
```

### Standard Hover Transition

```css
/* Buttons & interactive elements */
transition:
  background 150ms ease,
  color 150ms ease;
/* or */
transition:
  background 180ms ease,
  border-color 180ms ease;
/* or */
transition: all 200–250ms ease;
```

### Admin Panel Tab Switch

```css
.admin-panels .panel.admin-panel-enter {
  animation: fadeUp 280ms ease-out both;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .admin-panels .panel.admin-panel-enter {
    animation: none;
  }
  .admin-panel-switcher {
    transition: none;
  }
}
```

---

## Scrollbars

Applied to `.table-wrap` and `.employee-list`:

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: rgba(15, 26, 31, 0.05);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb {
  background: rgba(47, 111, 179, 0.3);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(47, 111, 179, 0.5);
}
```

---

## Pills & Badges

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 26, 31, 0.08);
  font-size: 0.85rem;
}

/* Login page kicker badge */
.login-header-kicker {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(47, 111, 179, 0.08);
  color: var(--sea);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

---

## Background Treatment

### Page Background

```css
body {
  background: var(--mist); /* #f4f6fa */
}
```

### Watermark / Decorative Background Image

```css
/* Login page — more visible */
body.login-page::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("assets/Facade.webp");
  background-size: cover;
  background-position: center;
  opacity: 0.2;
  z-index: -1;
  pointer-events: none;
}

/* All other pages — very subtle */
body:not(.login-page)::before {
  /* same, but opacity: 0.07 */
}
```

---

## Responsive Breakpoints

| Breakpoint | Behavior                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `≤ 1024px` | Tablet — larger touch targets for datepicker                                                                                 |
| `≤ 980px`  | Footer collapses to single column                                                                                            |
| `≤ 768px`  | Header adapts, field-rows stack, modals widen, filter labels hidden                                                          |
| `≤ 720px`  | Panel padding reduces to `22px`, modal `95%` width                                                                           |
| `≤ 640px`  | Footer brand stacks vertically                                                                                               |
| `≤ 480px`  | Inputs forced `font-size: 16px` (prevents iOS zoom), panels full-width, modal actions stack vertically, panel padding `18px` |
| `≤ 280px`  | Logo height fallbacks                                                                                                        |

### Key Mobile Overrides

```css
@media (max-width: 480px) {
  /* Prevent iOS zoom on focus */
  input[type="text"],
  input[type="email"],
  input[type="password"] {
    font-size: 16px !important;
  }

  .panel {
    padding: 18px;
    width: 100%;
  }
  .field-row {
    grid-template-columns: 1fr;
  }
  .modal-actions {
    flex-direction: column;
    gap: 8px;
  }
  .modal-btn {
    width: 100%;
    padding: 16px 20px;
    min-height: 52px;
  }
}
```

---

## Quick Token Reference (Copy-Paste)

```css
:root {
  --ink: #0b1c3b;
  --mist: #f4f6fa;
  --sun: #e6ecf5;
  --sea: #2f6fe4;
  --clay: #7ea2e8;
  --glass: #ffffff;
  --surface: #ffffff;
  --surface-soft: #f8fafd;
  --line: rgba(11, 28, 59, 0.11);
  --shadow: 0 8px 20px rgba(11, 28, 59, 0.08);
  --shadow-soft: 0 4px 12px rgba(11, 28, 59, 0.06);
  --hover-ink: #164ab3;
  --hover-sea: #285fca;
  --hover-sea-soft: rgba(47, 111, 228, 0.18);
  --hover-neutral-soft: rgba(15, 26, 31, 0.18);
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;
}
```
