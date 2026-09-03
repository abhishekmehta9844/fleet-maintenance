# Architecture

## What are the moving pieces, and how do they talk to each other?

Three services, each owning one concern:

- **Frontend** — a React + TypeScript single-page app, built by Vite, styled with Tailwind CSS.
  It holds no business logic beyond what's needed to render state and call the API; every rule
  (who can do what, what transitions are legal, whether a reading is valid) is enforced by the
  backend, not the UI.
- **Backend** — a FastAPI (Python) REST API. All routes live in `main.py`, backed by SQLAlchemy
  models (`models.py`), Pydantic request/response schemas (`schemas.py`), and a small auth module
  (`auth.py`) handling password hashing and JWT issuing/verification.
- **Database** — PostgreSQL, accessed through SQLAlchemy's ORM layer. Locally this falls back to
  a SQLite file when `DATABASE_URL` is unset, so no local Postgres install is needed for
  development.

They talk over plain HTTPS with JSON bodies. The frontend never has a direct database connection
or any secret beyond the public API URL — every read and write goes through the FastAPI layer,
which is the only thing that can see the database. Authentication is stateless: after login, the
backend issues a signed JWT containing the user's id and role; the frontend stores it and attaches
it as an `Authorization: Bearer <token>` header on every request. The backend never stores session
state — each request is verified independently by decoding and validating that token.

## Where does each piece run?

- Frontend: **Vercel**, served as a static build from a CDN.
- Backend: **Render**, as a long-running `uvicorn` process (a real server process, not a
  serverless function, since the app needs a persistent database connection pool).
- Database: **Supabase**, a managed PostgreSQL instance, accessed through Supabase's IPv4
  connection pooler rather than its direct connection endpoint — the direct connection resolves
  to an IPv6-only address in several regions, and Render's outbound network doesn't support IPv6.

Configuration that differs between environments (`DATABASE_URL`, `JWT_SECRET_KEY`,
`ALLOWED_ORIGINS` on the backend; `VITE_API_BASE_URL` on the frontend) is passed through
environment variables, never hardcoded. The frontend's variable is baked in at build time (a
Vite/Vercel property, not a backend one), which means changing it requires a fresh build, not just
a restart.

## Request path for one representative action: a manager books a service record

1. The manager has already picked a technician and a scheduled date in the UI, and clicks
   "Book Service."
2. The frontend calls `PUT /service-records/{id}` with `{ status: "Booked", scheduled_date }`,
   through a shared `apiFetch` helper that attaches the stored JWT as an `Authorization` header.
3. FastAPI routes the request to `update_service_status`. Before the function body runs, its
   `Depends(auth.get_current_user)` dependency decodes and validates the JWT and loads the
   matching `User` row — an invalid or expired token stops the request here with a 401.
4. Inside the route: the record's current status ("Due") is looked up in a `VALID_TRANSITIONS`
   map, which confirms "Booked" is the only legal next state. Since the target is "Booked"
   specifically, two more checks run — a scheduled date must be present, and at least one row
   must already exist in the `assignments` table for this record — either failing raises a 400
   with a specific reason.
5. The record's status is updated, an `AuditLog` row is appended recording the old and new status
   and who made the change, and both changes commit to Postgres in one transaction.
6. The updated record is serialized through the `ServiceRecordResponse` schema and returned.
7. The frontend re-fetches that vehicle's service history so the UI reflects the new status.

## What did we decide not to build?

- **No background scheduler.** Detecting that a vehicle has become due for service happens lazily
  — whenever the vehicle list or dashboard is fetched, not on a fixed timer. Render's free tier
  doesn't offer an easy always-on worker process, and for this project's scale, data is always
  correct by the time anyone looks at it. At real scale this would need to move to an actual
  scheduled job so metrics stay accurate even with no active viewers.
- **No refresh-token rotation.** A single JWT is issued at login with an 8-hour expiry; there's no
  silent-refresh flow. A user whose token expires simply has to log in again.
- **No real-time updates.** The UI re-fetches after actions rather than using WebSockets or
  polling — acceptable for a single-fleet-manager-at-a-time tool, not for a scenario where many
  people need to see the same record update live.
- **No row-level locking on the state machine.** Two simultaneous requests moving the same record
  aren't explicitly guarded against beyond the database's default transaction isolation. Unlikely
  to matter at this scale; a real multi-manager deployment would want optimistic-concurrency
  versioning on `service_records`.
- **No file attachments, rate limiting, or configurable per-vehicle grace period** — the overdue
  grace period is a single global constant (`OVERDUE_GRACE_PERIOD_DAYS`), not a per-vehicle
  setting.
- **None of the stretch goals** (trip logs, fuel tracking, parts inventory, etc.) — the ten
  required goals used the full time budget.
