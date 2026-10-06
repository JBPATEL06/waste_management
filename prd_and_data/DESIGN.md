# DESIGN.md — Waste Journey Tracker

Design system for a data-entry and tracking web app. Clean, functional, minimal. Not a marketing site, not a government portal.

## 1. Product Feel

- Simple admin tool: tables, forms, cards, timeline.
- Calm, light, lots of whitespace, one accent color (green).
- Content first. No decoration, no hero sections, no illustrations.
- App name: **Waste Journey Tracker**. Logo: small green leaf/recycle icon + app name text.

## 2. STRICT CONTENT RULES (most important)

Show **only** the elements listed for that screen. Do not invent anything extra.

**Never add:**
- Fake statistics, counters, "live", "telemetry", "today" numbers
- Hero banners, taglines, marketing text, testimonials
- Notices, security banners, alerts, tips, help cards, guidance sections, "citizen resources"
- Footer link columns, helpline numbers, department names, government/official wording, seals
- Extra navigation links, extra buttons, role chips, quick-login shortcuts
- Images, photos, illustrations, decorative graphics, gradients, glass effects

**Allowed:** app logo, page title, the fields/tables/cards listed for the screen, one primary action, short helper text under a field only when needed, error and empty states.

Sample data: realistic and small. Batch ID format `WB-2026-0001`. Waste type Wet/Dry. Quantities in kg. Times in IST like `06 Oct 2026, 09:30`.

## 3. Color Tokens

| Token | Hex | Use |
|---|---|---|
| primary | #15803D | Primary buttons, active nav, links |
| primary-hover | #166534 | Hover/pressed |
| primary-soft | #DCFCE7 | Active nav background, selected row |
| background | #F8FAFC | Page background |
| surface | #FFFFFF | Cards, tables, forms, sidebar |
| border | #E2E8F0 | Dividers, input borders, card borders |
| text | #0F172A | Main text |
| text-muted | #475569 | Labels, helper text |
| text-disabled | #94A3B8 | Disabled, placeholder |
| error | #DC2626 | Errors, destructive buttons |
| error-soft | #FEE2E2 | Error background |
| warning | #D97706 | Warnings, variance flag |
| warning-soft | #FEF3C7 | Warning background |

### Status badge colors (fixed meaning)

| Status | Text | Background |
|---|---|---|
| Created | #475569 | #F1F5F9 |
| Collected | #1D4ED8 | #DBEAFE |
| In Transit | #B45309 | #FEF3C7 |
| At RTS | #6D28D9 | #EDE9FE |
| Completed | #15803D | #DCFCE7 |
| Superseded (history) | #64748B | #F1F5F9, strikethrough text |
| Deleted (history) | #B91C1C | #FEE2E2 |

## 4. Typography

Font: **Inter** (fallback system sans-serif).

| Style | Size / weight | Use |
|---|---|---|
| Page title | 24 / 600 | One per page |
| Section title | 18 / 600 | Cards, sections |
| Body | 14 / 400 | Default text, table cells |
| Label | 13 / 500 | Form labels, table headers |
| Caption | 12 / 400 | Helper text, timestamps |
| Batch ID | 14 / 600, monospace feel | Batch codes |

## 5. Spacing, Radius, Elevation

- 4px grid: spacing 4, 8, 12, 16, 24, 32.
- Card padding 20. Page padding 24 desktop, 16 mobile.
- Radius: inputs/buttons 8, cards/modals 12, badges 999 (pill).
- Elevation: cards use 1px border only. Shadow only on modals and dropdowns.

## 6. Layout

| Context | Layout |
|---|---|
| Login, Change Password, Public Search | Single centered card, max width 400, on background color. Logo above card |
| Public Tracking | Centered column, max width 720: batch card, then timeline. Simple top bar with logo only |
| Admin, Head Officer | Top bar (56px) + left sidebar (240px, collapsible) + content max width 1280 |
| Stage panels (Collection, Transportation, RTS, Processing) | Mobile-first. Top bar + bottom nav on mobile (Dashboard, History, Profile). Sidebar on desktop |
| Mobile | Single column, 16px padding, tap targets min 44px, tables become stacked cards |

Top bar: logo left, user name + role badge + Profile + Logout right. Nothing else.

Sidebar items: only those listed in `pages_spec.md` §0 for that role.

## 7. Components

**Buttons:** Primary (green fill, white text), Secondary (white, border), Danger (red fill), Text link. Height 40 (44 mobile). One primary button per screen area.

**Inputs:** height 40, border `border`, radius 8, label above, helper/error below in caption. Focus: 2px primary ring. Error: red border + message.

**Select / date-time:** same style as inputs; native pickers on mobile.

**Table:** white card, header row `#F8FAFC` with label style, 48px rows, hover `#F8FAFC`, pagination bottom right, filter bar above. Status as badge.

**Card:** white, 1px border, radius 12, padding 20, optional title row.

**KPI card (dashboard):** label (muted), number (24/600), optional small status dot. No icons required, no trend arrows.

**Timeline (tracking):** vertical line with 4 nodes: Collection, Transportation, RTS / Transfer, Processing. Completed node = green filled dot, pending node = grey hollow dot with muted text. Each node: stage name, date/time, location, status. Newest stage at bottom, chronological order.

**Badge:** pill, 12/500, colors from status table.

**Modal / confirm dialog:** centered, max width 480, title, body, Cancel (secondary) + action (primary or danger). Reason textarea when needed.

**Toast:** top right, success green / error red, auto dismiss 4s.

**Empty state:** one short line + optional primary action. No illustrations.

**Loading:** skeleton rows/cards.

**Inline alerts:** only for real conditions (locked stage reason, variance warning, validation summary). Small, one line, `warning-soft` or `error-soft`.

**QR block:** QR image 160px, Batch ID below, Download PNG and Print buttons.

## 8. Screen Content (minimum set)

| Screen | Show only |
|---|---|
| Login | Logo + app name, Email, Password (show/hide), Login button, error message area |
| Change Password | Current password, New password, Confirm password, Update button |
| Public Search | Batch ID input, Search button |
| Public Tracking | Batch card (Batch ID, waste type, quantity, source, status badge) + timeline |
| Admin / Head Officer Dashboard | Filter bar, KPI cards, a few charts/tables as listed in pages spec |
| Lists | Filter bar + table + pagination |
| Forms | Fields listed in pages spec, Cancel + Save |
| Batch Detail | Header with Batch ID + status + QR, details card, assignment card, timeline, history |

All other screens: use exactly the sections described in `pages_spec.md`. Nothing more.

## 9. Responsive

- Breakpoints: mobile < 640, tablet 640–1024, desktop > 1024.
- Forms: 2 columns on desktop, 1 column on mobile.
- Dashboard cards: 4 per row desktop, 2 tablet, 1–2 mobile.
- Sidebar becomes drawer (admin/HO) or bottom nav (stage panels) on mobile.

## 10. Accessibility

- Text contrast at least 4.5:1.
- Status is never color only: always text label in badge.
- Visible focus ring, keyboard navigable.
- Error messages in text, not only red color.

## 11. Fix Prompt for Already Generated Screens

Paste this in Stitch chat after selecting the screens:

> Simplify these screens to match DESIGN.md. Remove all extra content: statistics, hero text, notices, banners, guidance cards, resource sections, footer link columns, role chips, helpline text, official/government wording, decorative elements. Keep only the elements listed in DESIGN.md section 8 for each screen. Use the exact colors, Inter font, radius and spacing from DESIGN.md.
