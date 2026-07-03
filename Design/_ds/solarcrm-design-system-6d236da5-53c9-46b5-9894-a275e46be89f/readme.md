# SolarCRM Design System

> AI-ready design reference for SolarCRM — a CRM for small businesses in Latin America.
> Version 1.0 · June 2026

---

## Product Context

**SolarCRM** is a CRM platform built for small and medium businesses across Latin America. It helps owners and sales teams manage contacts, deals, pipelines, and activities from a single, fast interface.

**Personality:** Poderoso y profesional · Confiable y sólido
**References:** Linear, Stripe, Attio, Notion
**Language:** Spanish (es-419 — Latin American Spanish)
**Platforms:** Web desktop (primary) + mobile responsive

**Sources used to build this system:**
- Design spec document: `SolarCRM — Design System Spec` (provided inline, June 2026)
- No external Figma links or GitHub repos were provided. All tokens and components were generated from the spec above. If you have a Figma file or codebase, re-attach it so this system can be refined.

---

## Content Fundamentals

- **Language:** Spanish (es-419). All UI copy, labels, errors, and placeholders are in Latin American Spanish.
- **Casing:** Sentence case always. Never Title Case on buttons, labels, or nav items.
  - ✅ "Nuevo cliente" ❌ "Nuevo Cliente"
- **Numbers:** `1.234,56 MXN` — period for thousands, comma for decimals (Latin American convention).
- **Dates:** Prefer relative: "Hoy", "Ayer", "Hace 2 días". Raw timestamps only in detail views.
- **Error copy:** Always explains *what* went wrong + *how* to fix it. Never blames the user.
  - ✅ "RFC inválido — verifica el formato (XAXX000000AAA)" ❌ "Error en RFC"
- **Tone:** Direct, professional, warm. Feels like a trusted tool, not a startup toy.
- **Emoji:** Never used in product UI.
- **Microcopy:** Terse and functional. Labels are uppercase with letter-spacing, never decorative.

---

## Visual Foundations

### Colors
Single amber accent (`#C98A0A`) — never introduce a second brand color. Warm off-white (`#F8F7F4`) as page background, never pure white. All neutrals carry a slight amber/warm tint (not pure gray). See `tokens/colors.css`.

### Typography
Two-font system: **IBM Plex Mono** for structure (headings, labels, data, buttons, nav) and **IBM Plex Sans** for content (body, descriptions, helper text). Mono headings use tight negative tracking (−0.02 to −0.04em) for a dense, authoritative feel. No decorative or display fonts. See `tokens/typography.css`.

### Spacing
Base-4 scale from 4px to 64px. Standard card padding is 24px (`--space-6`). Dense but never cramped — minimum 24px padding on any card surface. See `tokens/spacing.css`.

### Backgrounds
Flat, warm off-white page background. White card surfaces. Dark warm-black sidebar (`#181512`). No gradients anywhere — not on backgrounds, buttons, or decorative elements.

### Animation
Functional only. Four timing tokens: micro (120ms hover), state (200ms collapse), modal (250ms entry), exit (150ms). No decorative loops. No bounce. Easing is natural (ease or cubic-bezier spring for entry, ease-in for exit).

### Hover & Press States
Hover: slightly darker background (amber palette step down, e.g. brand-500 → brand-600). Ghost/secondary hover: subtle `rgba(0,0,0,0.04)` wash. No opacity tricks on primary actions. No element shrink on press.

### Borders
Default: `1px solid #E9E6E0`. Strong: `1px solid #D6D2CB`. Always pair with borders before adding shadows. Focus ring: 2px amber + 4px outer ring in page background color.

### Shadows
Warm-tinted, barely visible. Four levels (xs → lg). Never colored. Never dramatic. Never shadow-only separation.

### Corner Radii
**0px by default** — sharp corners on everything interactive (buttons, inputs, cards, dropdowns). Minimal exceptions: badges/chips 2px, inputs 3px, modals 3px, dots/progress 9999px. Never >6px. No pill buttons, no capsule inputs.

### Cards
White background, 1px warm border, 0px radius, shadow-xs. 24px padding. Header has bottom border separator. Monospace title.

### Iconography
See ICONOGRAPHY section below.

### Imagery
No product imagery specified in the source spec. When used: warm color grading preferred. No cold or bluish palettes.

### Dark Mode
Triggered via `data-theme="dark"` on `<html>` or `<body>`. Warm dark surfaces, not pure black. Text inverts to warm off-white. See `tokens/colors.css`.

---

## Iconography

**Library:** [Lucide Icons](https://lucide.dev) — outline style, `stroke-width: 1.5`
**CDN:** `<script src="https://unpkg.com/lucide@latest"></script>`

```html
<i data-lucide="building-2" style="width:16px;height:16px"></i>
<script>lucide.createIcons();</script>
```

**Sizes:**
- 16px — inline in text, badges, table cells
- 20px — action buttons, navigation items
- 24px — section icons, empty states

**Rules:**
- Always `currentColor` (inherits parent text color)
- Outline/stroke ONLY — never filled, never multicolor
- No emoji as icons. No unicode chars as icons. No hand-rolled SVGs for UI icons.

No custom icon font or sprite was provided. Lucide is the designated library.

---

## File Index

```
styles.css                     ← Root entry point (@import only)
tokens/
  colors.css                   ← Brand + neutral + semantic + dark mode
  typography.css               ← Fonts, scale, utility classes
  spacing.css                  ← Base-4 spacing scale
  shadows.css                  ← Shadow levels, border tokens, radii, animation
components/
  actions/   Button            ← Primary action button, 4 variants × 3 sizes
  feedback/  Badge             ← Status indicator, 6 variants
  forms/     Input             ← Text input, label + helper + error
  layout/    Card              ← Surface container with optional header
  data/      Table             ← CRM data table with sortable columns
guidelines/                    ← Foundation specimen cards (Design System tab)
ui_kits/
  crm/                         ← Full CRM web app UI kit (index.html)
assets/                        ← Logos and brand assets
readme.md                      ← This file
SKILL.md                       ← Agent skill definition
```

---

## Components

| Component | Path | Description |
|---|---|---|
| `Button` | `components/actions/` | 4 variants, 3 sizes, disabled |
| `Badge` | `components/feedback/` | 6 semantic variants, dot, sm/md |
| `Input` | `components/forms/` | Label, helper, error, disabled, icon |
| `Card` | `components/layout/` | Surface container, optional header |
| `Table` | `components/data/` | CRM record table, hover rows, custom cells |

Use via bundle: `const { Button } = window.SolarCRMDesignSystem_6d236d`

---

*SolarCRM Design System v1.0 · Generated June 2026*
