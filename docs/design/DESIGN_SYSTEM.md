# Design System — "Iron & Volt"

Design system for the gym management SaaS (web admin, super admin, and later the React Native member/trainer apps). The screens in `/designs` are the visual source of truth; this document is the rulebook behind them. If a design file and this document disagree, follow this document and flag the difference.

---

## 1. Principles

1. **Mobile-first, Bangla-first.** Bangla (`bn`) is the default UI language, English (`en`) is a toggle. Gym owners often run the business from a phone.
2. **Numbers are the hero.** Money, dues, days left and check-ins are the most important information. Show them big, in the numeric font, with tabular figures.
3. **Status by colour *and* text.** Green = active/allowed, amber = due/soon, red = expired/blocked. Never rely on colour alone: always add a text label.
4. **Big touch targets.** Minimum 44 × 44 px for anything clickable (people use this with sweaty hands at a front desk).
5. **Calm surfaces, one loud accent.** Charcoal/white surfaces, volt lime used only for primary actions and key numbers.

---

## 2. Colour tokens

All colours are defined as CSS variables in `tokens.css`. Components must use tokens, never raw hex.

### Dark theme (default)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0E0F12` | Page background |
| `--surface` | `#1A1C21` | Cards, sidebar, panels |
| `--surface-2` (chip) | `#23262D` | Table headers, chips, inner tiles |
| `--border` | `#2A2D34` | Card borders, dividers |
| `--text` | `#F4F4F5` | Primary text |
| `--text-muted` | `#A1A7B0` | Secondary text, labels |
| `--accent` | `#C6FF3D` | Primary buttons, active nav, key numbers |
| `--accent-text` | `#C6FF3D` | Accent-coloured text |
| `--on-accent` | `#0E0F12` | Text/icons on accent backgrounds |
| `--secondary` | `#FF6B2C` | Expense bars, highlights (sparingly) |
| `--success` | `#4ADE80` | Active, allowed, positive change |
| `--warning` | `#FBBF24` | Dues, expiring soon |
| `--danger` | `#F87171` | Expired, blocked, errors |
| `--info` | `#38BDF8` | Trial, informational |

### Light theme

| Token | Hex |
|---|---|
| `--bg` | `#F4F5F1` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#EEF0EA` |
| `--border` | `#E2E4DE` |
| `--text` | `#111214` |
| `--text-muted` | `#555B64` |
| `--accent` | `#C6FF3D` (fills only) |
| `--accent-text` | `#3F6212` (lime is unreadable as text on white) |
| `--on-accent` | `#0E0F12` |
| `--success` | `#15803D` |
| `--warning` | `#B45309` |
| `--danger` | `#B91C1C` |
| `--info` | `#075985` |

### Status badges

Pill shape, 12 px semibold text, padding 3–4 px × 10–12 px.

| Status | Dark (bg / text) | Light (bg / text) |
|---|---|---|
| Green (সক্রিয়, অনুমোদিত, সম্পন্ন) | `rgba(74,222,128,.14)` / `#4ADE80` | `#DCFCE7` / `#166534` |
| Amber (বকেয়া, যাচাই বাকি) | `rgba(251,191,36,.14)` / `#FBBF24` | `#FEF3C7` / `#92400E` |
| Red (মেয়াদ শেষ, আটকানো) | `rgba(248,113,113,.14)` / `#F87171` | `#FEE2E2` / `#991B1B` |
| Blue (ট্রায়াল) | `rgba(56,189,248,.14)` / `#7DD3FC` | `#E0F2FE` / `#075985` |
| Gray (ফ্রিজ, স্থগিত) | `rgba(161,167,176,.16)` / `#C3C8CF` | `#E5E7EB` / `#374151` |

**Accessibility:** body text must meet WCAG AA contrast (4.5:1). Check any new colour combination before using it.

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Bangla + UI text | **Hind Siliguri** (400, 500, 600, 700) | Google Fonts. Primary font for all text. |
| Numbers, money, English headings | **Space Grotesk** (400–700) | Always with `font-variant-numeric: tabular-nums` so amounts line up. |
| Fallback | `system-ui, sans-serif` | |

Load both via `next/font/google`. Test Bangla conjuncts (যুক্তাক্ষর) on a low-end Android phone early.

### Type scale

| Name | Size / line-height | Weight | Use |
|---|---|---|---|
| display | 40–44 px / 1.05 | 700 | Hero number (today's collection) |
| h1 | 26 px / 1.3 | 700 | Page title (desktop); 22 px on mobile |
| h2 | 17 px / 1.4 | 700 | Card title |
| kpi | 28–32 px / 1 | 700 | KPI values |
| body | 14–15 px / 1.5 | 400–600 | Default text, table cells |
| small | 12–13 px / 1.4 | 400–600 | Labels, meta, badges |
| nav | 11 px | 400/600 | Bottom-nav labels |

Numbers: English digits for money and figures (e.g. `৳18,500`), formatted with the Bangladeshi lakh system (`৳3,42,000`). Dates may be Bangla or English per locale.

---

## 4. Spacing, radius, elevation

- **Spacing scale (px):** 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32. Default card padding 18–20; page padding 28 × 32 desktop, 24 tablet, 16–20 mobile. Gaps between sections 16–24.
- **Radius:** 6 (tiny bars), 10 (small buttons, inner tiles), 12 (inputs, buttons), 14 (small cards), 16 (cards), 18 (mobile hero cards), 999 (pills, badges).
- **Elevation:** no heavy shadows. Use `1px solid var(--border)` on cards. Emphasis = accent border (`2px solid var(--accent)`), not shadow.

---

## 5. Layout & breakpoints

| Breakpoint | Width | Navigation | Layout |
|---|---|---|---|
| Mobile | < 768 (design: 390) | Top bar (menu, gym name, bell) + bottom tab bar (5 items) | Single column, stacked cards, KPIs 2 × 2 |
| Tablet | 768–1199 (design: 834) | 76 px icon rail | KPIs 2 × 2, full-width chart, lists |
| Desktop | ≥ 1200 (design: 1440) | 248 px sidebar with labels, branch switcher, trial card, user | 12-col feel: KPIs in 4–5 columns, charts 2/3 + 1/3, tables |

Tables become card lists on mobile. Side panels (e.g. "take payment") become full-screen sheets on mobile.

---

## 6. Components

**Buttons**
- Primary: `bg --accent`, `text --on-accent`, weight 600, radius 12, height 44 (52 for main form submit).
- Secondary: `bg --surface`, `border --border`, `text --text`.
- Danger-text: secondary style with `text --danger` (e.g. স্থগিত).
- Icon button: 44 × 44 (36 × 36 inside dense tables), must have `aria-label`.

**Cards:** `bg --surface`, `border 1px --border`, radius 16, padding 18–20, title = h2.

**KPI card:** label (small, muted) → value (kpi font, may be tinted by status) → sub-line (small; green for positive change, muted otherwise).

**Inputs:** height 44–48, radius 12, `bg --bg` inside panels, `border --border`, focus = `border --accent` + visible focus ring. Every input has a visible `<label>`.

**Segmented tabs / filters:** container `bg --surface` + border, radius 12, padding 4; active item `bg --accent` `text --on-accent`; inactive `text --text-muted`. Counts shown next to labels.

**Tables:** header row `bg --surface-2`, 13 px muted; rows 14 px with `border-top --border`; avatar initial circle (34–40 px, `bg --surface-2`); right-aligned action buttons.

**Badges:** see Status badges above.

**Sidebar nav item:** height 44, radius 10, icon 20 px + label; active = `bg --accent` + `text --on-accent` + 600; optional count pill (amber for dues, red for alerts).

**Bottom nav (mobile):** 5 items, icon 22 + label 11 px, active = `--accent-text` + 600.

**Charts:** bars with top radius 3–6. Income = `--accent`, expense = `--secondary`, new = `--success`, expired = `--danger`. Muted bars (`#3A3E47` dark / `#D4D8CF` light) with the latest bar highlighted in accent. Always show a legend.

**Toggles:** 46 × 26 track, 20 px white knob, on = `--accent`.

**Icons:** Lucide, stroke 2, 18–22 px. No emoji in the UI.

---

## 7. Content & voice

- Plain, short Bangla. Buttons say exactly what happens: "পেমেন্ট নিশ্চিত করুন", "রিনিউ", "হোয়াটসঅ্যাপ রিমাইন্ডার".
- Errors explain what went wrong and how to fix it. No vague "কিছু ভুল হয়েছে".
- Empty states invite action, e.g. "এখনো কোনো মেম্বার নেই — প্রথম মেম্বার যোগ করুন".
- AI nutrition values are always labelled as estimates.

---

## 8. Motion

150–250 ms ease-out for opening sheets, toasts and toggles. Respect `prefers-reduced-motion`. No decorative entrance animations on every card.
