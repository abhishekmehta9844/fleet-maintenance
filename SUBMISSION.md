# Submission

## Links

- **GitHub repository:** https://github.com/abhishekmehta9844/fleet-maintenance
- **Live application:** https://fleet-maintenance-seven.vercel.app

## Notes for the reviewer

The backend is hosted on Render's free tier, which spins down after inactivity. The first request
after an idle period can take 30–60 seconds to wake up — if the login screen appears but nothing
happens on sign-in, wait a minute and try again before assuming something is broken. This is
expected behaviour on the free tier and is noted here so a slow first load is not read as a
broken deployment.

The application is seeded with demo data across six vehicles in various states — some due, some
with completed service records, and one that has gone through the full lifecycle (Due → Booked →
In Service → Completed) to populate the dashboard chart and technician breakdown.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Fleet Manager | manager@fleet.com | pass123 |
| Technician | tech@fleet.com | pass123 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React + TypeScript + Vite + Tailwind CSS | Fast build times, type safety across all API responses and component props, utility-first styling that keeps the component and its styles in one place |
| Backend | FastAPI + SQLAlchemy + PyJWT + bcrypt | Automatic request validation via Pydantic, built-in interactive docs at /docs, dependency injection for auth and database sessions, and a lightweight ORM that maps cleanly onto a relational schema |
| Database | PostgreSQL via Supabase (production), SQLite locally | The data is fundamentally relational — vehicles to service records (one-to-many), technicians to records (many-to-many), and a foreign-key-backed audit trail. Supabase provides a free managed Postgres instance with a connection pooler needed specifically because Render's network doesn't support outbound IPv6 |
| Hosting | Render (backend) + Vercel (frontend) + Supabase (database) | Deployed in that order — database first, then backend (which needs the connection string), then frontend (which needs the backend's public URL). Matches the brief's suggested free-tier combination |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | JWT auth with bcrypt-hashed passwords. Every permission check runs server-side via a require_role dependency — a technician cannot perform a manager action even by sending the API request directly |
| 2 | Vehicles | Done | Create (with both service intervals), edit, archive, restore. Archiving flips a boolean flag — service history is fully preserved and retrievable via the "Show archived" toggle |
| 3 | Service records | Done | Created by managers only. Description editable by whoever is assigned. Assigned technicians shown as chips on each record. Full service history visible per vehicle |
| 4 | Service lifecycle with rules | Done | Due → Booked → In Service → Completed enforced server-side. Any other transition returns a 400 with the specific reason. Booking requires a scheduled date and at least one assigned technician. Completing resets the vehicle's date and mileage baseline from that service's actual values. Due records are auto-generated the moment either interval is reached |
| 5 | Assignment | Done | Many-to-many via a join table with a composite primary key — structurally impossible to double-assign. Manager-only add and remove, both logged to the audit trail. Technicians see all their assigned records across every vehicle via the Service Records tab |
| 6 | Finding service records | Done | Server-side text search over descriptions, filters for vehicle/status/technician, sorting by scheduled date/status/last updated, and real pagination returning the total match count alongside each page |
| 7 | Bulk odometer updates and export | Done | CSV upload with per-row success/reject report and specific rejection reasons. Valid rows apply even when others in the same file are rejected. Separate CSV export of full service history |
| 8 | Dashboard | Done | Four headline numbers (due/in-service/completed-this-week/overdue), breakdown by status, breakdown by technician, and an 8-week completions chart. All numbers computed from live queries |
| 9 | History you cannot rewrite | Done | Every status change, assignment, unassignment, and note is appended to an audit log. No update or delete endpoint exists for audit rows — not permission-gated, simply absent. Timeline visible inline per service record |
| 10 | Overdue service alerts | Done | Alerts area with a nav badge showing the live count. Manager can dismiss an alert. Dismissal resets automatically when the vehicle enters its next due cycle, so the alert genuinely returns rather than staying suppressed |

## How much time did you actually spend?

Approximately 11.5–12 hours across four sessions over five days:
- Aug 29 (~2 hrs) — initial project scaffolding
- Aug 30 (~4.5 hrs) — core feature build (auth, state machine, search, archive)
- Aug 31 (~1.5 hrs) — dashboard rework, audit timeline, overdue alerts
- Sep 1–3 (~3.5 hrs) — deployment, debugging, seeding, and documentation

## What would you do next, with another 12 hours?

The single most impactful change would be replacing the lazy, on-read due-detection with a real
background scheduler. Right now a vehicle is only checked for being due when someone visits the
app — if the app sits idle for a week, a vehicle could pass its service interval with no alert
ever appearing. This is the most visible gap between a demo project and a genuinely reliable
production system. Everything else needed for it already exists (the due-detection logic,
the auto-record creation, the alert system) — it just needs a scheduled job to call that logic
on a fixed interval rather than waiting for a human page load to trigger it.

Beyond that: row-level locking on the state machine (currently unguarded against a genuine
concurrent-request race condition), a fuel-tracking model linked to vehicles, and driver-to-
vehicle assignment — all of which would extend what's already built rather than introducing
new patterns.

## What are you least happy with in this codebase, and why?

The N+1 query pattern in the vehicle list and dashboard overdue calculation. Both loop over every
active vehicle in Python and issue a separate database query per vehicle to check its due/overdue
status. At the current demo scale this is invisible, but it would become the dominant cost at
real fleet sizes — the fix is a single aggregate SQL query that computes overdue status across
all vehicles in one round-trip, plus an index on service_records(vehicle_id, status). It was a
deliberate cut given the time budget, but it's the piece I'd be least comfortable defending at
production scale.
