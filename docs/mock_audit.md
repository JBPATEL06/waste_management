# Frontend Mock Audit & Migration Checklist

This document tracks all mock data, hardcoded structures, fake authentication, and client-side simulations in the frontend, along with their status as they are migrated to the real Node.js/Supabase backend API.

---

## 1. API Client & Authentication Infrastructure
- [ ] `src/api/client.js`: Create centralized HTTP client (`fetch`) with base URL (`VITE_API_URL`), in-memory access token storage, credentials (`withCredentials: true`), 401 refresh queue with retry, and redirect to `/login` on token expiry.
- [ ] `src/api/modules/*.js`: Resource modules for `auth`, `me`, `users`, `master`, `batches`, `entries`, `dashboard`, `public`, `export`, `audit`, and `settings`.
- [ ] `src/constants/stages.js`: Move pure UI labels, route paths, badge styling, and stage numbers from `mockData.js` to an allowed constants file (strictly excluding mock names, operator IDs, or dummy batches).
- [ ] `src/context/AuthContext.jsx`:
  - [ ] Remove `MOCK_USERS` default and fake credential validation.
  - [ ] Remove `localStorage` token/user persistence.
  - [ ] Implement startup session restore via `GET /auth/refresh` + `GET /me`.
  - [ ] Implement `login(email, password)` calling `POST /auth/login`.
  - [ ] Implement `logout()` calling `POST /auth/logout` and clearing memory token.
  - [ ] Implement `logoutAll()` calling `POST /auth/logout-all`.
  - [ ] Handle `must_change_password` flag and navigation.
  - [ ] Handle `ACCOUNT_LOCKED` and `ACCOUNT_DISABLED` errors from API.
- [ ] Route Guards in `src/App.jsx`:
  - [ ] Authenticated vs unauthenticated guards.
  - [ ] Role-based guards for `/admin/*`, `/ho/*`, `/collection/*`, `/transportation/*`, `/rts/*`, `/processing/*`.
  - [ ] Forced redirect to `/change-password` when `user.must_change_password` is true.

---

## 2. Shared Master Data & Dropdowns
- [ ] Cache master data lookups with TanStack Query (`staleTime: 5 mins`):
  - Routes (`GET /master/routes`)
  - Vehicles (`GET /master/vehicles`)
  - RTS Locations (`GET /master/rts-locations`)
  - Processing Facilities (`GET /master/processing-facilities`)
  - Process Types (`GET /master/process-types`)
  - Waste Categories (`GET /master/waste-categories`)
  - Drivers (`GET /master/drivers`)
  - Active users by stage for batch assignments (`GET /users?is_active=true`)

---

## 3. Page-by-Page Migration Checklist

### 3.1 Public Pages
- [ ] `src/pages/Login.jsx`:
  - Connect to `useAuth().login`.
  - Remove hardcoded demo text (`Demo: operator123`).
  - Render API error banner on 401/403/429/account locked.
- [ ] `src/pages/ChangePassword.jsx`:
  - Connect to `POST /auth/change-password` via `useAuth().changePassword`.
  - Display server validation errors.
- [ ] `src/pages/PublicSearch.jsx`:
  - Query `GET /public/track/:batchCode`.
  - Validate batch code format client-side.
  - Show 404 state if batch is not found.
- [ ] `src/pages/PublicTracking.jsx`:
  - Fetch tracking details from `GET /public/track/:batchCode`.
  - Render strictly whitelisted data (timeline, current status, quantity, waste type, source area).
  - Remove all mock batch fallbacks.
  - Generate client-side QR with `qrcode.react` with Download PNG and Print buttons.

### 3.2 Admin Panel Pages
- [ ] `src/pages/AdminDashboard.jsx`:
  - Connect KPI cards to `GET /dashboard/summary`.
  - Connect quantity funnel to `summary.funnel`.
  - Connect breakdown charts to `GET /dashboard/breakdowns`.
  - Connect recent updates table to `GET /dashboard/recent`.
  - Remove all inline dummy chart arrays and mock constants.
- [ ] `src/pages/BatchList.jsx`:
  - Connect to `GET /batches` with server-side pagination, sorting, status/route/vehicle/date filters, and debounced search.
  - Remove `MOCK_BATCHES` and `MOCK_ROUTES`.
  - Add loading skeleton, empty state, and error-with-retry.
- [ ] `src/pages/CreateBatch.jsx`:
  - Populate route, vehicle, and 4 stage assignee dropdowns from `GET /master/*` and `GET /users`.
  - Submit form to `POST /batches`.
  - Display server 422 field errors inline.
  - Redirect to batch detail on success.
- [ ] `src/pages/BatchDetail.jsx`:
  - Fetch batch metadata, assignments, timeline, and history from `GET /batches/:id`.
  - Implement Admin Edit Batch (`PATCH /batches/:id`) with reason prompt.
  - Implement Reassign User (`PUT /batches/:id/assignments`) with audit confirmation.
  - Implement Edit Stage Entry (`PATCH /entries/:id`) with reason modal.
  - Implement Delete Stage Entry (`DELETE /entries/:id`) with reverse deletion rule and confirmation dialog.
  - Client-side QR generation with Download PNG / Print.
- [ ] `src/pages/MasterData.jsx`:
  - Connect tabs to `GET /master/:type` for all 7 master types.
  - Add/Edit items via `POST /master/:type` and `PATCH /master/:type/:id`.
  - Toggle active state and handle hard delete with usage block error display.
- [ ] `src/pages/UserManagement.jsx`:
  - Fetch users list from `GET /users`.
  - Add user via `POST /users`.
  - Edit user via `PATCH /users/:id`.
  - Reset password via `POST /users/:id/reset-password` (copy temp password modal).
  - Deactivate user with pending assignment conflict error handling.
- [ ] `src/pages/ExportData.jsx`:
  - Download streamed CSV/XLSX from `GET /export/:dataset?format=...` using current filter params.
- [ ] `src/pages/AuditLog.jsx`:
  - Fetch ledger from `GET /audit` with action, user, batch, date filters and pagination.
  - Display expandable old/new payload diffs.
- [ ] `src/pages/Settings.jsx`:
  - Fetch system settings from `GET /settings`.
  - Update `variance_threshold_pct` via `PATCH /settings`.

### 3.3 Head Officer Panel Pages
- [ ] `src/pages/ho/HeadOfficerDashboard.jsx`:
  - Connect to `GET /dashboard/summary`, `breakdowns`, `recent` (read-only).
- [ ] `src/pages/ho/HeadOfficerBatchList.jsx`:
  - Connect to `GET /batches` with read-only view.
- [ ] `src/pages/ho/HeadOfficerBatchDetail.jsx`:
  - Connect to `GET /batches/:id` (strictly read-only, QR code download).

### 3.4 Stage Operational Pages
- [ ] `src/pages/stage/StageDashboard.jsx`:
  - Connect KPI counts and lists to `GET /dashboard/queue`.
  - Render Ready, Locked, and Submitted queues with real batches.
- [ ] `src/pages/stage/StageBatchView.jsx`:
  - Fetch batch details from `GET /batches/:id`.
  - Verify stage assignment and check lock prerequisites (`STAGE_LOCKED`).
  - Provide link to `StageEntryForm` if unlocked and pending.
- [ ] `src/pages/stage/StageEntryForm.jsx`:
  - Fetch batch details and previous stage data for pre-filling.
  - Collection: submit to `POST /batches/:id/entries` (`quantity`, `collection_time`, `vehicle_id`, `route_id`, `driver_id`, `notes`).
  - Transportation: submit dispatch / arrival data.
  - RTS: live variance warning calculation against collection weight; submit weighbridge entry.
  - Processing: submit process type, facility, output/residue quantities.
  - Corrections: submit to `POST /entries/:id/correct` with mandatory reason.
- [ ] `src/pages/stage/StageHistory.jsx`:
  - Fetch operator's logged entries from `GET /me/history`.

### 3.5 Layouts & Profile
- [ ] `src/pages/Profile.jsx`:
  - Fetch profile from `GET /me`.
  - Update name via `PATCH /me`.
  - Change password via `POST /auth/change-password`.
  - View active sessions and call `POST /auth/logout-all`.
- [ ] `src/components/layout/StageLayout.jsx`:
  - Dynamically display logged-in operator's actual name and station from auth / profile context.
- [ ] `src/components/common/TopBar.jsx`:
  - Display current user's real name and role badge.
  - Connect Logout button to `useAuth().logout()`.

---

## 4. Deletion & Cleanup
- [ ] Delete `src/data/mockData.js`.
- [ ] Grep for all occurrences of `mockData`, `MOCK_`, `dummy`, `sample`, `fake`, `lorem`, `WB-2026-`, `setTimeout`.
- [ ] Verify zero mock data remains in frontend code.

