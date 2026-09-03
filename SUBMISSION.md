# Submission

## Links

- **GitHub repository:** https://github.com/abhishekmehta9844/fleet-maintenance
- **Live application:**  https://fleet-maintenance-seven.vercel.app


## Notes for the reviewer

The backend is hosted on Render's free tier, which sleeps after inactivity. The first request after
it's been idle can take 30–60 seconds to wake up — if the app looks broken on first load, wait a
minute and refresh before assuming something's wrong.

<-- Add anything else here you think a reviewer should know before clicking the link — e.g. any
known rough edges, or anything you ran out of time to polish. -->

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@fleet.com | pass123 |
| Technician | tech@fleet.com | pass123 |


## Stack

| Layer    | What you used                                                   | Why |
|----------|-----------------------------------------------------------------|-----|
| Frontend | React + Vite + TypeScript + Tailwind CSS                        | Fast dev server, type safety, utility-first styling for quick iteration |
| Backend  | FastAPI + SQLAlchemy + PyJWT + bcrypt                           | Async-friendly, automatic OpenAPI docs at /docs, lightweight ORM, no heavier framework needed for this scope |
| Database | PostgreSQL (Supabase, pooled connection) in production; SQLite locally | Relational model (vehicles → service records → many-to-many technician assignments, foreign-key-backed audit log) fits a relational database much better than a document store; Supabase gives a free managed Postgres instance |
| Hosting  | Render (backend) + Vercel (frontend) + Supabase (database)      | Matches the brief's suggested free-tier combination; deployed in that order so each service had what it needed from the one before it |


## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | JWT auth, bcrypt-hashed passwords, manager/technician roles; every permission check enforced server-side via a `require_role` dependency, not hidden in the UI |
| 2 | Vehicles | Done | Create, edit, archive, restore; archiving hides a vehicle from the default view without deleting its service history |
| 3 | Service records | Done | Created by managers; description editable by whoever's assigned; assigned technicians shown on each record; vehicle history visible |
| 4 | Service lifecycle with rules | Done | Due → Booked → In Service → Completed enforced server-side; any other transition rejected with a specific reason; booking requires a scheduled date and an assigned technician; completing resets both interval counters; auto-generated "Due" records with a grace-period overdue calculation |
| 5 | Assignment | Done | Multiple technicians per record, manager-only add/remove; technicians see all their assigned records across every vehicle |
| 6 | Finding service records | Done | Server-side text search, filters (vehicle/status/technician), sort (scheduled date/status/last updated), and real pagination with a total match count |
| 7 | Bulk odometer updates + export | Done | CSV upload with a per-row success/reject report and reasons; valid rows apply even when others in the same file fail; separate CSV export of full service history |
| 8 | Dashboard | Done | Due/in-service/completed-this-week/overdue headline numbers, breakdowns by status and technician, 8-week completed-per-week chart |
| 9 | Immutable timeline | Done | Every status change, assignment/unassignment, and note is logged and shown per record, nothing editable or deletable after the fact — note: this logging was added partway through the build, so records/actions from earlier sessions won't have a full timeline |
| 10 | Overdue alerts | Done | Alerts area with a dismiss action and a live nav badge; dismissal resets automatically when the vehicle enters its next due cycle, so the alert genuinely returns rather than staying dismissed forever |


## How much time did you actually spend?

<-- Only you know this — tally it up honestly, even if it's over or under your original estimate. -->

## What would you do next, with another 12 hours?

<-- Your own answer. Some real candidates, if it helps jog thinking: the interval-detection logic
that auto-creates "Due" records only runs when someone happens to hit an endpoint that checks for
it (no real background scheduler); "completed this week" and the chart both use a rolling 7-day
window rather than calendar weeks; there's no distinction between an auto-generated "Due" record and
one a manager creates by hand for something unrelated to the interval. Use these only if they
genuinely match what you'd prioritize — don't just copy them in. -->

## What are you least happy with in this codebase, and why?

<-- Your own honest answer — this is the question most worth answering for real, since it's
exactly what you'll be asked to defend on the call. -->
