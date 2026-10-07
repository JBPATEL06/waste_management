# Developer Guide

This guide explains where the frontend and backend live, how requests flow
between them, and how to run and change the application locally. Do not commit
local environment files, passwords, tokens, or production credentials.

## Repository structure

```text
waste_Management/
├── frontend/                 # React + Vite browser application
│   ├── public/               # Static files and favicon
│   ├── src/
│   │   ├── api/              # Frontend API clients and HTTP wrapper
│   │   ├── components/       # Shared UI and page layouts
│   │   ├── constants/        # Stage labels and UI constants
│   │   ├── context/          # Authentication/session context
│   │   ├── pages/            # Public, admin, officer, and operator pages
│   │   ├── queryClient.js    # TanStack Query defaults and error feedback
│   │   └── utils/            # Formatting, URLs, toast helpers
│   ├── index.html
│   ├── vite.config.js        # Local dev server and API proxy
│   └── vercel.json           # Hosted frontend rewrite to backend
├── server/                   # Express + PostgreSQL backend API
│   ├── api/index.js          # Vercel serverless entry point
│   ├── src/
│   │   ├── config/           # Environment validation
│   │   ├── controllers/      # HTTP request/response handlers
│   │   ├── db/               # PostgreSQL pool and query helpers
│   │   ├── middleware/       # Authentication, validation, errors, limits
│   │   ├── routes/           # API endpoint definitions and access rules
│   │   ├── services/         # Business logic and database operations
│   │   ├── utils/             # Errors and token helpers
│   │   └── validators/       # Zod request schemas
│   ├── app.js                # Express application and route mounts
│   ├── server.js             # Local HTTP server startup
│   └── package.json
├── supabase/
│   ├── migrations/           # Database schema migrations
│   └── seed.sql              # Base reference data (review before applying)
├── scripts/                  # Repository-level operational scripts
├── docs/                     # Developer, deployment, and historical notes
└── README.md                 # Project overview
```

The frontend is in **`frontend/`**. The backend API is in **`server/`**.
`server/server.js` starts Express locally; `server/api/index.js` exports the
same Express app for Vercel Functions.

## Request flow

### Local development

```text
Browser :5173 → Vite /api proxy → Express :5000 → PostgreSQL
```

The browser uses `/api` in development. Vite forwards those requests to the
local Express server at `http://localhost:5000`. The backend also mounts routes
with and without the `/api` prefix.

### Hosted deployment

```text
Browser → frontend Vercel deployment → /api rewrite
        → backend Vercel Function → PostgreSQL
```

The rewrite target is configured in `frontend/vercel.json`. The backend's
serverless entry point is `server/api/index.js`.

## Local setup

Prerequisites: Node.js 20 or newer, npm, and a reachable PostgreSQL database.
Use a local database or a development Supabase project; do not point local
experiments at production data.

1. Configure the backend's required environment variables in a local,
   git-ignored environment file. Required values include `DATABASE_URL` and a
   `JWT_SECRET` of at least 32 characters. `PORT` defaults to `5000` and
   `NODE_ENV` defaults to `development`. See `server/src/config/env.js` for the
   authoritative schema. Never paste real values into source files or docs.
2. Install backend dependencies and start the API:

   ```bash
   cd server
   npm install
   npm run dev
   ```

   The local API listens on `http://localhost:5000` by default. Check
   `http://localhost:5000/health`; a healthy response is `{"ok":true}`.
3. In a second terminal, install and start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open the Vite URL shown in the terminal (normally
   `http://localhost:5173`). API calls use the Vite `/api` proxy.

If using a local database, apply migrations using the database workflow your
team has configured before using API pages. Review SQL migrations and seeds
before applying them; seeding may create or change database records.

## Backend request lifecycle

For a typical endpoint, follow this path:

1. `server/src/routes/` declares the URL, middleware, and required role.
2. `server/src/middleware/` authenticates the user and validates the request.
3. `server/src/controllers/` translates the HTTP request into a service call
   and sends the response.
4. `server/src/services/` contains business rules and database queries.
5. `server/src/db/index.js` provides the shared `pg` connection pool.
6. Errors flow to `server/src/middleware/errorHandler.js`.

Keep business rules in services and request shape validation in validators.
Use parameterized SQL (`$1`, `$2`, ...) for values; never interpolate
user-supplied values into SQL.

## API areas

- `/auth`: login, refresh, logout, password change
- `/me`, `/users`: profile, session history, and user administration
- `/batches`, `/entries`: batch and stage-entry lifecycle
- `/master`: routes, vehicles, facilities, categories, drivers, and process types
- `/dashboard`: admin/officer analytics and operator queues
- `/export`, `/audit`: filtered exports and audit records
- `/public`: privacy-limited public batch tracking
- `/settings`: system settings

Routes and role restrictions are defined in `server/src/routes/`. The Express
mounts and `/api` aliases are in `server/src/app.js`.

## Frontend areas

- `frontend/src/api/`: endpoint wrappers; `client.js` handles auth and HTTP.
- `frontend/src/pages/`: route-level screens.
- `frontend/src/components/`: shared UI, layouts, buttons, skeletons, and logo.
- `frontend/src/context/AuthContext.jsx`: current session and user actions.
- `frontend/src/queryClient.js`: caching, retry, and global query/mutation
  feedback.

The route table is in `frontend/src/App.jsx`. Use shared API modules rather than
calling `fetch` directly from pages. For server data, prefer TanStack Query.

## Common validation commands

```bash
# Frontend production build
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint

# Backend syntax check for a changed JavaScript file
node --check server/src/path/to/changed-file.js
```

The backend `npm test` script currently points to
`server/test-auth-and-masters.js`; check that file and its prerequisites before
running it. Do not run tests against production credentials or production data.

## Production database connections

On Vercel, the backend PostgreSQL pool defaults to one connection per function
instance. `DB_POOL_MAX`, if set, overrides that value; it is not a global cap.
See [project context](./project_context.md) and
[deployment guidance](./deployment.md) before changing connection settings.

