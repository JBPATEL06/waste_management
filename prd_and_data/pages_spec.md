# Pages Specification — Waste Journey Tracking Portal

Version: 1.0 | Related: `final_prd.md`, `activity_diagrams.md`, `data_dictionary_and_auth.md`

Total: **36 pages** = Common 5 (error pages 403/404 counted as one) + shared Profile 1 + Admin 9 + Stage panels 4 x 4 = 16 + Head Officer 5. Route count is 37 because 403 and 404 are separate routes.
Reusable components: Stage panels share Queue, Batch View, Entry Form, History (role config driven). Profile is one page for all 6 roles.

---

## 0. Global Conventions

| Item | Rule |
|---|---|
| Layout | Top bar (logo, user name, role badge, Profile, Logout) + sidebar (desktop) / bottom nav or drawer (mobile) |
| Route guard | Frontend redirects by role (UX only); server enforces real access |
| Table behavior | Server-side pagination, sorting, filters, search debounce 300 ms |
| Forms | Inline validation, disabled submit while saving, error summary on top |
| Status badges | Created (grey), Collected (blue), In Transit (amber), At RTS (purple), Completed (green) |
| Time display | IST, stored UTC |
| Empty / loading / error | Skeleton while loading, friendly empty text, retry button on error |
| Confirmations | Delete, reassign, deactivate, logout-all need confirm dialog |

### Sidebar menus

| Panel | Menu items |
|---|---|
| Admin | Dashboard, Batches, Create Batch, Master Data, Users, Export, Audit Log, Settings |
| Collection / Transportation / RTS / Processing | Dashboard, History |
| Head Officer | Dashboard, Batches, Export, Audit Log |
| All logged-in | Profile (top bar), Logout |

---

## 1. Common & Public Pages

### 1.1 Login — `/login`

| Item | Detail |
|---|---|
| Access | Public |
| Purpose | Single login for all six roles |
| UI | Email, password (show/hide), Login button, error area |
| Actions | Submit credentials; role-based redirect to `/admin/dashboard`, `/collection/dashboard`, `/transportation/dashboard`, `/rts/dashboard`, `/processing/dashboard`, `/ho/dashboard` |
| States | Invalid credentials (generic message), account locked (shows minutes left), account disabled |
| Rules | If `must_change_password`, redirect to `/change-password` |
| API | POST `/auth/login` |

### 1.2 Change Password — `/change-password`

| Item | Detail |
|---|---|
| Access | Logged in (forced on first login) |
| UI | Current password, new password, confirm, strength hint |
| Rules | Min 8 chars, letter + number, cannot equal current. On success all other sessions revoked, redirect to role dashboard |
| API | POST `/auth/change-password` |

### 1.3 Public Search — `/track`

| Item | Detail |
|---|---|
| Access | Public |
| UI | Batch ID input, Search button |
| Actions | Open `/track/:batchCode`; not found shows message and stays |
| API | GET `/public/track/:batchCode` |

### 1.4 Public Tracking — `/track/:batchCode`

| Item | Detail |
|---|---|
| Access | Public (QR scan target) |
| UI | Batch card: Batch ID, waste type, quantity, source, current status. Vertical timeline: Collection, Transportation, RTS, Processing with date/time, location, status. Pending stages shown greyed |
| Hidden | Driver/user names, vehicle numbers, notes, handover details, corrections/deleted history |
| States | Not found (404 page), rate limited message |
| API | GET `/public/track/:batchCode` |

### 1.5 Error Pages — `/403`, `/404`

Static pages with "Go to dashboard / login" button.

---

## 2. Profile (shared, all roles) — `/profile`

| Item | Detail |
|---|---|
| Access | Any logged-in user |
| Sections | (1) Account info: name (editable), email (read-only), role (read-only), last login. (2) Security: change password link, "Logout from all devices". (3) Stage users only: assigned batch counts (Ready, Submitted, Locked) |
| Actions | Save name; logout all devices (confirm, revokes all refresh tokens, redirects to login) |
| Not included | Avatar, phone, theme settings |
| API | GET `/me`, PATCH `/me`, POST `/auth/logout-all` |

---

## 3. Admin Panel

### 3.1 Dashboard — `/admin/dashboard`

| Section | Content |
|---|---|
| Filter bar | Date range, waste type, route, vehicle, RTS, facility, status. Reset button |
| KPI cards | Total, Created, Collected, In Transit, At RTS, Completed (click opens filtered Batch List) |
| Quantity funnel | Collected vs received at RTS vs processed, with variance |
| Breakdown charts | By waste type, route, vehicle, RTS, facility, process type, final status |
| Operational | Avg journey duration, delayed/stuck batches, pending per stage per user |
| Alerts | Flagged variances list |
| Recent | Latest updates, latest corrections/deletions |
| API | GET `/dashboard/summary`, `/dashboard/breakdowns`, `/dashboard/pending`, `/dashboard/recent` |

### 3.2 Master Data — `/admin/master`

| Item | Detail |
|---|---|
| Tabs | Routes, Vehicles, RTS Locations, Processing Facilities, Process Types, Waste Categories, Drivers/Supervisors |
| Table | Name/code, key fields, status (Active/Inactive), actions |
| Actions | Add (modal form), Edit, Deactivate/Activate, Delete (only if never used) |
| Fields per tab | Routes: code, name, description. Vehicles: number, type, capacity kg. RTS: name, location. Facilities: name, location. Process types: name. Waste categories: name. Drivers: name, phone, designation |
| Rules | Duplicate names/vehicle numbers blocked; deactivated items hidden in dropdowns but remain in old records |
| API | GET/POST/PATCH `/master/:type` |

### 3.3 Users — `/admin/users`

| Item | Detail |
|---|---|
| Table | Name, email, role, status, last login, actions |
| Filters | Role, status, search |
| Actions | Add user (name, email, role, temp password shown once), Edit, Reset password, Activate/Deactivate |
| Rules | Multiple users per role; deactivating user with pending assigned batches opens reassign dialog; deactivation revokes sessions |
| API | `/users` CRUD, POST `/users/:id/reset-password`, `/deactivate` |

### 3.4 Create Batch — `/admin/batches/new`

| Section | Fields |
|---|---|
| Batch details | Date, waste type (Wet/Dry), quantity (kg), source/area, route (dropdown), vehicle (dropdown) |
| Assignment | Collection user, Transportation user, RTS user, Processing user (dropdowns, active users of that role only) |
| Info | Initial status = Created (read-only), Batch ID and datetime generated on save |
| After save | Success screen with Batch ID, QR, Download PNG, Print, "Create another", "Open batch" |
| Validation | All fields required, quantity > 0, all 4 users assigned |
| API | POST `/batches`, GET `/master/*`, GET `/users?role=` |

### 3.5 Batch List — `/admin/batches`

| Item | Detail |
|---|---|
| Table | Batch ID, date, waste type, qty, source, route, vehicle, status, current stage, last updated |
| Filters | Batch ID search, status, date range, route, vehicle, waste type |
| Actions | Open batch, quick QR download |
| API | GET `/batches` |

### 3.6 Batch Detail — `/admin/batches/:code`

| Section | Content |
|---|---|
| Header | Batch ID, status badge, QR thumbnail + download |
| Details card | Batch fields, edit button |
| Assignment card | Assigned user per stage, Reassign button |
| Timeline | Current valid entry per stage with all stage fields |
| History | All versions per stage including superseded and deleted, with who/when/reason; flagged variance marker |
| Actions | Edit entry (reason mandatory), Delete entry (reason mandatory, blocked if later stage exists), Reassign user, Edit batch, Download QR |
| Rules | Every action logs old/new values; status re-derived after change |
| API | GET `/batches/:id`, PATCH `/batches/:id`, PUT `/batches/:id/assignments`, PATCH/DELETE `/entries/:id` |

### 3.7 Export — `/admin/export`

| Item | Detail |
|---|---|
| Dataset | Batches, Stage-wise records, Full history incl. corrections, Current status |
| Filters | Date range, status, route, vehicle, waste type |
| Format | CSV or Excel (one sheet per dataset) |
| States | No records message; download starts on success |
| API | GET `/export/:dataset?format=csv|xlsx` |

### 3.8 Audit Log — `/admin/audit`

| Item | Detail |
|---|---|
| Table | Time, action, user, batch, entity, reason, old/new values (expandable) |
| Filters | Action type, user, Batch ID, date range |
| Note | Admin's own activity is covered here (filter by user = me); no separate Admin history page |
| API | GET `/audit` |

### 3.9 Settings — `/admin/settings`

| Item | Detail |
|---|---|
| Fields | Variance threshold % (default 10) |
| Rules | Applies to new RTS entries; existing flags unchanged |
| API | GET/PATCH `/settings` |

---

## 4. Stage Panels (Collection, Transportation, RTS, Processing)

Route prefixes: `/collection`, `/transportation`, `/rts`, `/processing`. Each panel has 4 pages built from the same components with a role config.

### 4.1 Queue Dashboard — `/<role>/dashboard`

| Item | Detail |
|---|---|
| Counts | Locked, Ready, Submitted (+ In Transit for Transportation if arrival missing) |
| Tabs | Ready (action needed), Locked (waiting previous stage, shows reason), Submitted (current valid entry per batch) |
| List item | Batch ID, waste type, qty, source, route, assigned date, status |
| Actions | Open batch view; search by Batch ID |
| Scope | Only batches assigned to this user for this stage |
| API | GET `/batches` (role-filtered), GET `/dashboard/queue` |

### 4.2 Batch View — `/<role>/batches/:code`

| Section | Content |
|---|---|
| Batch details | Read-only summary |
| Previous stages | Read-only cards of earlier stage entries |
| Own stage | If no entry: "Add Entry" button (disabled with reason if locked). If entry exists: current entry with version no. and "Submit Correction" button |
| Rules | No edit/delete buttons for stage users; locked message e.g. "Waiting for Collection entry" |
| API | GET `/batches/:id` |

### 4.3 Entry / Correction Form — `/<role>/batches/:code/entry`

Mode: Add (no entry yet) or Correction (existing entry, reason mandatory, fields prefilled with current values).

| Panel | Fields | Prefill / auto | Lock condition |
|---|---|---|---|
| Collection | Collection area/location, route, vehicle, waste type, quantity, collection date, exact time, driver/supervisor, note | Route, vehicle, waste type, quantity from batch | Batch not assigned |
| Transportation | Start location, destination, RTS/next location, vehicle, departure datetime, arrival datetime (optional), note | Start location and vehicle from Collection; duration auto-calculated | No valid Collection entry |
| RTS | RTS name, RTS location (auto), arrival date + time, quantity received, waste category, handover/receiving details, next process/destination, note | Name from Transportation RTS; variance % shown live vs collected qty with flag warning | No Transportation entry with arrival time |
| Processing | Facility, process type, arrival date + time, quantity, final status, note | Facility from RTS next destination | No valid RTS entry |

| Common rule | Detail |
|---|---|
| Validation | Required fields, qty > 0, no future time, time order Collection <= Departure <= Arrival <= RTS <= Processing, master values active |
| On save | Entry stored, batch status updated, audit log written. Correction marks old version Superseded |
| After Processing save | Batch becomes Completed, journey closed |
| Mobile | Single column, large inputs, native date/time pickers |
| API | POST `/batches/:id/entries`, POST `/entries/:id/correct` |

### 4.4 History — `/<role>/history`

| Item | Detail |
|---|---|
| Purpose | Record of all own submissions (entry-wise, all versions), read-only |
| Data | Entries created by this user across batches |
| Columns | Batch ID, stage, version no., status (Active/Superseded), event time, submitted at, correction reason |
| Filters | Date range, status, Batch ID search |
| Click | Opens Batch View |
| Difference from Submitted tab | Submitted tab = batch-wise, current valid entry, action oriented (correction). History = entry-wise, all versions, view only |
| API | GET `/me/history` |

---

## 5. Head Officer Panel (read-only)

### 5.1 Dashboard — `/ho/dashboard`

Same analytics as Admin dashboard (filters, KPI cards, funnel, breakdowns, operational, flagged variances, recent). No links to master/users/settings and no write controls.

### 5.2 Batch List — `/ho/batches`

Same table and filters as Admin Batch List, no create or quick-edit actions. Row opens read-only detail.

### 5.3 Batch Detail — `/ho/batches/:code`

Details, timeline and full history incl. superseded/deleted entries and flagged variances. No edit, delete, reassign, or batch-edit controls. QR download allowed.

### 5.4 Export — `/ho/export`

Same as Admin Export (all four datasets, CSV or Excel).

### 5.5 Audit Log — `/ho/audit`

Same as Admin Audit Log, read-only.

---

## 6. Route Summary

| Panel | Routes |
|---|---|
| Common / Public | `/login`, `/change-password`, `/track`, `/track/:batchCode`, `/403`, `/404` |
| Shared | `/profile` |
| Admin | `/admin/dashboard`, `/admin/master`, `/admin/users`, `/admin/batches/new`, `/admin/batches`, `/admin/batches/:code`, `/admin/export`, `/admin/audit`, `/admin/settings` |
| Collection | `/collection/dashboard`, `/collection/batches/:code`, `/collection/batches/:code/entry`, `/collection/history` |
| Transportation | `/transportation/dashboard`, `/transportation/batches/:code`, `/transportation/batches/:code/entry`, `/transportation/history` |
| RTS | `/rts/dashboard`, `/rts/batches/:code`, `/rts/batches/:code/entry`, `/rts/history` |
| Processing | `/processing/dashboard`, `/processing/batches/:code`, `/processing/batches/:code/entry`, `/processing/history` |
| Head Officer | `/ho/dashboard`, `/ho/batches`, `/ho/batches/:code`, `/ho/export`, `/ho/audit` |

## 7. New APIs Introduced by Pages (add to API list)

| Endpoint | Method | Roles |
|---|---|---|
| `/me` | GET, PATCH | All logged in |
| `/me/history` | GET | Collection, Transportation, RTS, Processing |
| `/auth/logout-all` | POST | All logged in |
| `/dashboard/queue` | GET | Stage roles |
| `/settings` | GET, PATCH | Admin (GET also Head Officer) |
