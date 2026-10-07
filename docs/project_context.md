# Waste Journey Tracker — Current Project Context

**Last reviewed:** October 7, 2026

This is the current operational reference for the repository. Older phase audits
and migration notes in `docs/QNA/` and `docs/mock_audit.md` are historical
snapshots, not specifications of the current implementation. Credential
documents are intentionally excluded from this overview.

For the repository layout, local setup, backend request lifecycle, and common
developer commands, see the [Developer Guide](./developer_guide.md).

## Architecture

- Frontend: React, Vite, React Router, and TanStack Query in `frontend/`.
- Backend: Express API in `server/`, also exposed to Vercel through
  `server/api/index.js`.
- Database: PostgreSQL accessed through `pg`; production is deployed as separate
  frontend and backend Vercel projects.
- The frontend calls the backend through `/api`; `frontend/vercel.json` rewrites
  those requests to the backend deployment.
- `GET /health` and `GET /api/health` perform a database connectivity check and
  return `503` when it is unavailable.

## Authentication and roles

- Access tokens are held in frontend memory; refresh uses an HTTP-only cookie.
- Production cookie defaults are `Secure` and `SameSite=None`. Explicit
  `COOKIE_SECURE` and `COOKIE_SAMESITE` environment values override defaults.
- `ADMIN` manages batches, stage entries, users, master data, and settings.
- `HEAD_OFFICER` has read-only analytics, batch, export, and audit access.
- `COLLECTION`, `TRANSPORTATION`, `RTS`, and `PROCESSING` operators see queues
  and can submit entries only for their assigned stage.
- Session refresh failures clear the frontend session and redirect to login.

## Batch workflow

The ordered operational stages are:

1. Collection
2. Transportation
3. RTS
4. Processing

Each downstream stage requires the preceding active stage entry. RTS additionally
requires Transportation arrival time. The arrival is mandatory when submitting
a Transportation entry and must not precede its departure time. Queue lock
reasons identify the earliest missing prerequisite.

Stage operators submit corrections as new versions with a required reason.
Administrators can edit the stage-specific fields of an active entry or delete
entries with an audit reason. Batch deletion is an administrator-only,
permanent operation; related records are removed and a snapshot is retained in
the audit log.

## Data loading and export

- Query defaults and master-data cache policy are configured in
  `frontend/src/queryClient.js`.
- API errors are surfaced through the shared toast infrastructure; queries with
  cached data retain that data and show a refresh warning on failed refetch.
- Export is available to Admin and Head Officer for batches, stage records, full
  history, current status, and audit records in CSV or XLSX.
- Export filters (date range, status, route, vehicle, and waste type) are sent
  to the backend. Preview uses the selected dataset and returns at most 10
  matching rows.
- Custom export date ranges require both dates and an end date on or after the
  start date.

## Vercel database connection limits

The PostgreSQL pool is module-scoped so a warm serverless instance can reuse it.
On Vercel, the default pool maximum is **1 connection per function instance**.
`DB_POOL_MAX` overrides that default. It is a per-instance limit, not a global
limit: concurrent instances can each open their configured maximum.

On October 7, 2026, production dashboard requests returned HTTP 500 with
`EMACONNSESSION max clients reached`. Commit `8601f7c` changed the Vercel
default pool maximum to 1. If the error continues after deployment:

1. Confirm the backend deployment contains that commit.
2. Check the backend Vercel environment for `DB_POOL_MAX`; remove it or set it
   to `1` unless the database provider's pooler and connection budget justify a
   higher per-instance maximum.
3. Check the database provider's active-connection limit and pooler settings.
4. Check the backend function logs and `/health` response.

Increasing `DB_POOL_MAX` does not increase the database's total capacity. Under
serverless concurrency, even a small per-instance pool can multiply across
instances.

## Recent verification

- Frontend production build passed after the shared-logo and export-preview
  changes on October 7, 2026.
- Backend `node --check` passed for the database pool change and export
  controller, service, and route files.
- No automated test suite was run during those changes.
