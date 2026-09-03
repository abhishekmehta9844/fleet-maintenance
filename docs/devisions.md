# Decisions

## Decision 1

- **Chose:** Full JWT-based authentication (bcrypt-hashed passwords, signed tokens, a
  `require_role` dependency enforced on every route) with real, server-side permission checks.
- **Rejected:** A frontend-only "view as manager / view as technician" role switcher, with no
  actual login and no server-side enforcement.
- **Why:** The brief is explicit that role differences "must be enforced on the server, not just
  hidden in the interface." A client-side switcher can't satisfy that requirement no matter how
  it's framed, since any request could still hit the API directly regardless of what the UI shows.
- **Later reversed:** this decision *is* the reversal. An earlier pass at this project had chosen
  the frontend-only switcher specifically to avoid "forcing the reviewer to create accounts, log
  in, and handle token expirations." That reasoning didn't hold up against the brief's explicit
  requirement, so it was replaced with real auth once the gap was identified.

## Decision 2

- **Chose:** PostgreSQL (via Supabase in production, SQLite locally) as the database, accessed
  through SQLAlchemy's ORM.
- **Rejected:** MongoDB / a MERN-style stack, which was the pattern most familiar from prior
  personal projects.
- **Why:** The data is fundamentally relational — one vehicle has many service records, a service
  record has many technicians and vice versa, and every action needs a foreign-key-backed,
  append-only audit trail. A relational database enforces referential integrity natively (you
  cannot create a service record pointing at a vehicle that doesn't exist), and the dashboard's
  grouped aggregates (`GROUP BY status`, `GROUP BY technician`) are one line of SQL instead of a
  more verbose aggregation pipeline in a document store.

## Decision 3

- **Chose:** Detecting that a vehicle has become due for service lazily — checked and, if needed,
  auto-created inline whenever the vehicle list or dashboard is fetched.
- **Rejected:** A real background scheduler (a cron job or periodic worker) sweeping all vehicles
  on a fixed interval regardless of who's using the app.
- **Why:** Render's free tier doesn't offer an easy always-on background worker process, and for a
  single-fleet-manager-at-a-time project, checking on read is simple to reason about and
  functionally equivalent from a user's perspective — the data is correct by the time anyone
  actually looks at it. At real scale this would need to become a genuine scheduled job so metrics
  stay accurate even when nobody is actively browsing.

## Decision 4

- **Chose:** A single `is_alert_dismissed` boolean on the `Vehicle` row, explicitly reset to
  `false` the moment a new "Due" record is auto-created for that vehicle.
- **Rejected:** A dedicated dismissal-tracking table keyed to a specific due-cycle or service
  record.
- **Why:** The system already guarantees a vehicle can have only one open (non-Completed) service
  record at a time, so "the current due cycle" and "the vehicle" are effectively the same thing at
  any given moment. A per-vehicle flag is sufficient and considerably simpler than a table
  designed to track dismissals across cycles that, by construction, never overlap. This is also
  what makes the brief's requirement work correctly — the alert genuinely returns on the next due
  cycle rather than staying silently dismissed forever.

## Decision 5

- **Chose:** A small, hand-rolled inline SVG bar chart for the dashboard's 8-week completions
  chart.
- **Rejected:** A charting library such as Recharts or Chart.js.
- **Why:** No charting library was installed in the frontend, and adding one late in a time-boxed
  build means a new dependency, a new import surface, and a new way for the build to fail — for a
  chart simple enough (eight bars, one number each) that plain SVG covers completely. A dashboard
  needing richer interactivity (tooltips, zooming, multiple series) would justify a real library;
  this one didn't.

## Decision 6

- **Chose:** Storing the JWT in the browser's `localStorage` and attaching it manually as an
  `Authorization` header on every request.
- **Rejected:** An httpOnly, secure cookie set by the server, which JavaScript can never read
  directly.
- **Why:** The frontend (Vercel) and backend (Render) run on entirely different domains. A
  manually-attached Bearer header sidesteps a class of cross-site cookie configuration issues
  (SameSite, cross-domain cookie attributes) that would otherwise need careful handling for this
  split-hosting setup. The accepted trade-off is that a successful XSS attack could read the token
  from `localStorage`, which an httpOnly cookie would be immune to — a reasonable trade for this
  project's scope, though a production system handling more sensitive data would likely decide
  differently.
