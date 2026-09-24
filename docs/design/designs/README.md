# Design files — how to read them

These `.dc.html` files are the screen designs exported from the design canvas. They are **visual references, not code to reuse**. Rebuild each screen as proper Next.js/React components that follow `DESIGN_SYSTEM.md` and `tokens.css`.

## How the format works

- Each file is one screen. Layout, spacing, radius, font sizes and Bangla copy are written as inline `style="…"` and plain markup — read them directly.
- `{{t.surface}}`, `{{t.muted}}`, `{{accent}}` etc. are theme tokens. Their values are defined in the `<script type="text/x-dc">` block at the bottom of each file (dark and light sets). They map to the CSS variables in `tokens.css` (`t.surface` → `--surface`, `t.chip` → `--surface-2`, `t.muted` → `--text-muted`, `t.accentText` → `--accent-text`, etc.).
- `<sc-for list="{{rows}}" as="r">` = a loop; the sample data for it is in the same script block (`rows: [...]`). Treat it as example data only.
- `<sc-if value="{{x}}">` = conditional rendering.
- `<dc-import name="Sidebar" active="members">` = a shared component (`Sidebar.dc.html` / `SASidebar.dc.html`) with props.
- `<x-dc>`, `<helmet>` and `support.js` belong to the design tool. Ignore them.
- All names, numbers and amounts are **sample data**. `[প্রোডাক্টের নাম]` and `[দাম]` are placeholders to be filled later.

## Screen map

### Gym admin web app (build first)
| File | Screen | Route suggestion |
|---|---|---|
| `Sidebar.dc.html` | Desktop sidebar (shared) | layout component |
| `Dashboard-Desktop.dc.html` | Dashboard ≥1200px | `/[locale]/app` |
| `Dashboard-Tablet.dc.html` | Dashboard 768–1199px (icon rail) | same route, responsive |
| `Dashboard-Mobile.dc.html` | Dashboard <768px (top bar + bottom nav) | same route, responsive |
| `Members.dc.html` | Members list | `/app/members` |
| `MemberProfile.dc.html` | Member profile | `/app/members/[id]` |
| `Payments.dc.html` | Payments + take payment panel | `/app/payments` |
| `Access.dc.html` | Access control (devices, live entries, auto-lock rules) | `/app/access` |
| `Reports.dc.html` | Reports | `/app/reports` |

### Super admin (SaaS owner)
| File | Screen | Route suggestion |
|---|---|---|
| `SASidebar.dc.html` | Super admin sidebar | layout component |
| `SA-Dashboard.dc.html` | SaaS dashboard (MRR, gyms, alerts) | `/admin` |
| `SA-Gyms.dc.html` | All gyms | `/admin/gyms` |
| `SA-Billing.dc.html` | Plans & invoices | `/admin/billing` |
| `SA-Ops.dc.html` | Devices, message usage, support tickets | `/admin/ops` |

### Mobile apps (later, React Native — reference only for now)
| File | Screen |
|---|---|
| `Main.dc.html` | Owner mobile app home |
| `M-Home.dc.html` | Member app home |
| `M-Workout.dc.html` | Member workout |
| `M-Diet.dc.html` | Member diet + AI meal photo |
| `M-Progress.dc.html` | Member progress |
| `M-Membership.dc.html` | Member QR check-in, renew, payment history |

Screens not designed yet (build with the same system): packages, trainers & staff, sales & stock, income/expense, WhatsApp & SMS, website builder, settings, login/onboarding.
