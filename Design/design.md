# SolarCRM — Design System Spec
> AI-ready reference. Use this file to generate consistent SolarCRM interfaces.
> Product: CRM para pequeños negocios en Latinoamérica.
> Personality: Poderoso y profesional · Confiable y sólido.
> References: Linear, Stripe, Attio, Notion.

---

## QUICK REFERENCE

| Property | Value |
|---|---|
| Primary font | IBM Plex Mono (headings, labels, mono data) |
| Body font | IBM Plex Sans (paragraphs, UI text) |
| Primary color | `#C98A0A` / `oklch(0.700 0.166 74)` |
| Background | `#F8F7F4` / `oklch(0.982 0.005 85)` |
| Text | `#11100E` / `oklch(0.112 0.006 60)` |
| Border radius | **0px** (sharp corners — default for everything) |
| Border | `1px solid #E9E6E0` |
| Shadow style | Barely-there, warm-tinted, 2-level max |
| Language | Español (es-419 / Latin America) |
| Platforms | Web desktop + mobile responsive |

---

## COLORS

### Brand — Solar Amber
```
--brand-50:  #FEF8E7   oklch(0.977 0.018 88)   Very light amber bg
--brand-100: #FDF0C4   oklch(0.951 0.038 86)   Light amber bg
--brand-200: #F9DC88   oklch(0.905 0.072 83)   Subtle amber
--brand-300: #F2C347   oklch(0.852 0.110 80)   Muted amber
--brand-400: #E2A318   oklch(0.776 0.148 77)   Medium amber
--brand-500: #C98A0A   oklch(0.700 0.166 74)   ★ PRIMARY ACCENT
--brand-600: #A56E08   oklch(0.620 0.168 70)   Hover / active
--brand-700: #7E5407   oklch(0.520 0.155 67)   Dark amber text
--brand-800: #5A3B05   oklch(0.400 0.125 64)   Very dark
--brand-900: #3B2504   oklch(0.285 0.090 62)   Near black amber
--brand-950: #251703   oklch(0.185 0.060 60)   Darkest amber
```

### Neutral — Warm Gray (slightly amber-tinted, NOT pure gray)
```
--neutral-0:   #FFFFFF   Pure white (surfaces, cards)
--neutral-50:  #F8F7F4   Page background (warm off-white)
--neutral-100: #F3F1EC   Sunken / input background
--neutral-200: #E9E6E0   Default border
--neutral-300: #D6D2CB   Strong border
--neutral-400: #A9A49C   Placeholder / disabled text
--neutral-500: #7B766D   Tertiary text
--neutral-600: #5C574F   Secondary text
--neutral-700: #403C35   Medium dark text
--neutral-800: #2D2924   Dark
--neutral-900: #181512   Very dark
--neutral-950: #11100E   ★ Primary text (near black, warm tint)
```

### Semantic
```
--success-100: #ECFAED   --success-500: #25913A   --success-700: #1A6629
--error-100:   #FDEEED   --error-500:   #D13B1E   --error-700:   #9E2B14
--warning-100: #FEF6E4   --warning-500: #C68A10   --warning-700: #8F6010
--info-100:    #EEF3FD   --info-500:    #3A72CB   --info-700:    #2A53A0
```

### Dark Mode Surfaces
```
bg-base:           #11100E   (warm near-black)
bg-surface:        #181512
bg-surface-raised: #211E1A
bg-sunken:         #0A0908
border-default:    #2D2924
border-strong:     #403C35
text-primary:      #F8F7F4
text-secondary:    #A9A49C
```

---

## TYPOGRAPHY

### Fonts
```
Heading / Display / Labels / Mono data:  IBM Plex Mono
Body text / Paragraphs / Helper text:    IBM Plex Sans

Google Fonts import:
https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap
```

### Type Scale
```
Display:    IBM Plex Mono · 700 · 36px · line-height 1.2  · letter-spacing -0.04em
Heading L:  IBM Plex Mono · 600 · 24px · line-height 1.2  · letter-spacing -0.02em
Heading M:  IBM Plex Mono · 500 · 20px · line-height 1.35 · letter-spacing -0.01em
Heading S:  IBM Plex Mono · 500 · 18px · line-height 1.35 · letter-spacing -0.01em
Body L:     IBM Plex Sans · 400 · 16px · line-height 1.65
Body:       IBM Plex Sans · 400 · 14px · line-height 1.65
Body S:     IBM Plex Sans · 400 · 13px · line-height 1.5
Caption:    IBM Plex Sans · 400 · 12px · line-height 1.5  · color: #5C574F
Label:      IBM Plex Sans · 500 · 11px · line-height 1    · UPPERCASE · letter-spacing 0.08em · color: #5C574F
Code:       IBM Plex Mono · 400 · 13px · line-height 1.5
```

### Usage Rule
- Use **IBM Plex Mono** for: page titles, section headers, data values, CRM IDs, numbers, table headers, button labels, nav items
- Use **IBM Plex Sans** for: body copy, descriptions, form labels, helper text, tooltips, captions

---

## SPACING

Base-4 scale. Always use these values — no arbitrary spacing.

```
4px   (space-1)  — icon gap, tight chip padding
8px   (space-2)  — badge padding, dense gap
12px  (space-3)  — button/input internal padding
16px  (space-4)  — compact card padding, form gap
20px  (space-5)  — medium gap
24px  (space-6)  — ★ standard card padding
32px  (space-8)  — section gap, sidebar padding
40px  (space-10) — large section gap
48px  (space-12) — page section spacing
64px  (space-16) — major layout gap
```

---

## BORDERS & RADIUS

```
Default border-radius: 0px  ← THIS IS THE RULE. Sharp corners everywhere.

Exceptions (minimal rounding to avoid visual artifacts):
  Badges, chips, avatars: border-radius: 2px
  Inputs, small cards:    border-radius: 3px
  Modals, drawers:        border-radius: 3px
  Progress bars, dots:    border-radius: 9999px

NEVER use: border-radius > 6px, pill buttons, capsule inputs.

Standard borders:
  Default: 1px solid #E9E6E0
  Strong:  1px solid #D6D2CB
  Focus:   2px solid #C98A0A  + box-shadow: 0 0 0 2px #F8F7F4, 0 0 0 4px #C98A0A
```

---

## SHADOWS

Minimal. Use borders first, shadows second for elevation.

```
xs  (flat card):     box-shadow: 0 1px 2px rgba(30,20,5,0.04)
sm  (panel):         box-shadow: 0 1px 3px rgba(30,20,5,0.05), 0 1px 2px rgba(30,20,5,0.03)
md  (dropdown):      box-shadow: 0 4px 8px rgba(30,20,5,0.05), 0 2px 4px rgba(30,20,5,0.03)
lg  (modal):         box-shadow: 0 8px 24px rgba(30,20,5,0.07), 0 4px 8px rgba(30,20,5,0.04)
```

NO colored shadows. NO dramatic shadows. NO shadow-only separation (always pair with borders).

---

## COMPONENTS — READY TO USE CSS

### Button
```css
/* Base */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; border: 1px solid transparent; border-radius: 0;
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  letter-spacing: -0.01em; cursor: pointer; white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease;
  text-decoration: none; user-select: none;
}
/* Sizes */
.btn-sm { font-size: 11px; padding: 0 10px; height: 28px; }
.btn-md { font-size: 13px; padding: 0 14px; height: 32px; }  /* ← DEFAULT */
.btn-lg { font-size: 14px; padding: 0 18px; height: 38px; }

/* Variants */
.btn-primary     { background: #C98A0A; border-color: #C98A0A; color: #fff; }
.btn-primary:hover { background: #A56E08; border-color: #A56E08; }
.btn-secondary   { background: transparent; border-color: #D6D2CB; color: #11100E; }
.btn-secondary:hover { background: rgba(0,0,0,0.04); }
.btn-ghost       { background: transparent; border-color: transparent; color: #11100E; }
.btn-ghost:hover { background: rgba(0,0,0,0.04); }
.btn-destructive { background: #D13B1E; border-color: #D13B1E; color: #fff; }
.btn-destructive:hover { background: #9E2B14; border-color: #9E2B14; }

/* States */
.btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
```

### Input
```css
.input-wrap { display: flex; flex-direction: column; gap: 6px; }
.input-label {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 11px;
  font-weight: 500; color: #5C574F; letter-spacing: 0.06em;
  text-transform: uppercase;
}
.input-field {
  width: 100%; height: 34px; padding: 0 12px;
  font-family: 'IBM Plex Sans', sans-serif; font-size: 14px;
  color: #11100E; background: #FFFFFF;
  border: 1px solid #E9E6E0; border-radius: 0; outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.input-field:focus {
  border-color: #C98A0A;
  box-shadow: 0 0 0 2px #F8F7F4, 0 0 0 4px #C98A0A;
}
.input-field.error { border-color: #D13B1E; }
.input-field:disabled { background: #F3F1EC; opacity: 0.6; cursor: not-allowed; }
.input-helper { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #A9A49C; }
.input-error-msg { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #D13B1E; }
```

### Badge
```css
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 7px; border-radius: 2px;
  font-family: 'IBM Plex Sans', sans-serif; font-size: 12px;
  font-weight: 500; white-space: nowrap; line-height: 1;
}
.badge-sm { font-size: 11px; padding: 2px 5px; }
.badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

/* Variants */
.badge-default { background: #F3F1EC; color: #5C574F; }
.badge-brand   { background: #FEF8E7; color: #7E5407; }
.badge-success { background: #ECFAED; color: #1A6629; }
.badge-error   { background: #FDEEED; color: #9E2B14; }
.badge-warning { background: #FEF6E4; color: #8F6010; }
.badge-info    { background: #EEF3FD; color: #2A53A0; }
```

### Card
```css
.card {
  background: #FFFFFF;
  border: 1px solid #E9E6E0;
  border-radius: 0;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(30,20,5,0.04);
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; padding-bottom: 16px;
  border-bottom: 1px solid #E9E6E0;
}
.card-title {
  font-family: 'IBM Plex Mono', monospace; font-size: 16px;
  font-weight: 600; letter-spacing: -0.02em; color: #11100E;
}
```

### Table
```css
.table { width: 100%; border-collapse: collapse; }
.table th {
  font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 500;
  letter-spacing: 0.06em; text-transform: uppercase; color: #5C574F;
  padding: 10px 12px; border-bottom: 1px solid #E9E6E0;
  text-align: left; white-space: nowrap;
}
.table td {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 14px;
  color: #11100E; padding: 12px;
  border-bottom: 1px solid #F3F1EC; vertical-align: middle;
}
.table tr:hover td { background: #F8F7F4; }
.table tr:last-child td { border-bottom: none; }
```

---

## ICONS

Library: **Lucide Icons** (outline, stroke-width 1.5)
```html
<script src="https://unpkg.com/lucide@latest"></script>
<!-- Usage: -->
<i data-lucide="building-2" style="width:16px;height:16px"></i>
<script>lucide.createIcons();</script>
```
- 16px → inline in text, badges, table cells
- 20px → action buttons, navigation items
- 24px → section icons, empty states
- Color: always `currentColor` (inherits from parent text)
- Style: ONLY outline/stroke. Never filled. Never multicolor.

---

## LAYOUT PATTERNS

### Page layout
```
Sidebar: 240px fixed · background #181512 · border-right: none
Content: flex:1 · background #F8F7F4 · padding: 32px 40px
Header: 56px · background #FFFFFF · border-bottom: 1px solid #E9E6E0
```

### Sidebar nav item
```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; height: 36px;
  font-family: 'IBM Plex Mono', monospace; font-size: 13px;
  font-weight: 500; color: #A9A49C; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.nav-item:hover { background: rgba(255,255,255,0.06); color: #F8F7F4; }
.nav-item.active { background: rgba(201,138,10,0.15); color: #C98A0A; }
```

### Data number / KPI
```css
.kpi-value {
  font-family: 'IBM Plex Mono', monospace; font-size: 32px;
  font-weight: 700; letter-spacing: -0.04em; color: #11100E;
}
.kpi-label {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 12px;
  color: #5C574F; text-transform: uppercase; letter-spacing: 0.06em;
}
```

---

## CONTENT RULES

- Language: **Spanish (es-419)** — Latin American Spanish
- Capitalización: Sentence case. Never Title Case en botones o labels.
- Números: `1.234,56 MXN` (punto miles, coma decimal)
- Fechas en UI reciente: "Hoy", "Ayer", "Hace 2 días" — no timestamps crudos
- Microcopy de errores: explican QUÉ pasó + CÓMO resolverlo. Sin culpar al usuario.
- Emojis: NUNCA en la UI del producto.

---

## DO's AND DON'Ts

### ✅ DO
- Sharp/square corners on all interactive elements
- Monospace font for headings, data, labels, buttons
- Single amber accent — never add a second brand color
- Generous spacing — minimum 24px card padding
- Subtle borders to separate surfaces (not shadows alone)
- Lucide outline icons at 1.5 stroke
- Warm off-white (#F8F7F4) as page background — not pure white
- IBM Plex Mono tight tracking (−0.02 to −0.04em) on headings

### ❌ DON'T
- Rounded corners on buttons, inputs, or cards
- Gradient backgrounds (no gradients anywhere)
- More than 1 accent color in the UI
- Dense, cramped layouts — always breathe
- Strong or colored shadows
- Filled icons or multicolor icons
- Decorative fonts (no script, display, or fancy typefaces)
- Pure black (#000) backgrounds — always use warm dark neutrals
- ALL CAPS sections without letter-spacing: 0.06em+
- Pill/capsule shapes on interactive elements

---

## DARK MODE RULES

Switch by adding `data-theme="dark"` to `<html>` or `<body>`.

```css
/* Surfaces */
body[data-theme="dark"], [data-theme="dark"] body {
  background: #11100E;
  color: #F8F7F4;
}
/* Cards in dark */
[data-theme="dark"] .card {
  background: #181512;
  border-color: #2D2924;
}
```

---

## ANIMATION TOKENS

```
Micro (hover, toggle):     120ms ease
State (collapse, expand):  200ms cubic-bezier(0.16, 1, 0.3, 1)
Modal / panel entry:       250ms cubic-bezier(0.16, 1, 0.3, 1)
Exit / close:              150ms ease-in
```
No decorative animations. Only functional feedback.

---

## HTML BOILERPLATE

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 14px; line-height: 1.65;
      color: #11100E; background: #F8F7F4;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  <!-- UI here -->
  <script>lucide.createIcons();</script>
</body>
</html>
```

---

*SolarCRM Design System v1.0 · Generated June 2026*
