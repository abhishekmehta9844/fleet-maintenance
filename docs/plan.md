# Plan

## How did you break the work into sessions?

Four real working sessions, spread across five calendar days, reconstructed against the actual
git history:

- **Aug 29 (~2 hours)** — Initial scaffolding built with a different AI tool, before this guided
  rebuild began: FastAPI + React project setup and the docs folder structure.
- **Aug 30 (~4.5 hours)** — The heaviest single day, and really two things back to back. First,
  the tail end of the original scaffold got committed — database models, the vehicle form, a
  first pass at the dashboard, the fake frontend-only role switcher, and wiring the audit log
  model in. Then the actual guided rebuild in this conversation started the same day: real JWT
  authentication, the enforced service-record state machine, vehicle edit/archive/restore, and
  server-side search/filter/pagination.
- **Aug 31 (~1.5 hours)** — The dashboard rework with real metrics, exposing the audit timeline in
  the UI (plus notes and technician unassignment, both previously missing), and the overdue alerts
  feature.
- **Sep 1&ndash;3 (~3.5&ndash;4 hours combined)** — Two small fixes on Sep 1 (exposing the missing
  service-interval fields on the vehicle form, and fixing the hardcoded API URL ahead of
  deployment), folded into the same block as the actual deployment work on Sep 2&ndash;3:
  Supabase, Render, and Vercel setup, the CORS and IPv6/connection-pooler debugging, seeding the
  live database, and this documentation.

**Total: roughly 11.5&ndash;12 hours.**

## What order did you build in, and why that order?

The build went goal-by-goal rather than on a fixed session timer, each one built as a complete,
tested module before starting the next:

1. **Authentication and server-side roles first.** Almost every other goal depends on knowing who
   the caller is and what they're allowed to do — vehicle CRUD, service record creation,
   technician assignment, and the CSV bulk-update are all manager-only; service record visibility
   and editing depend on whether a technician is actually assigned. Building this first meant
   every later module could just declare `Depends(auth.require_role(...))` instead of retrofitting
   permission checks onto already-built endpoints.
2. **The state machine and grace-period logic second.** This is the most rule-heavy part of the
   brief (illegal transitions rejected with a reason, booking preconditions, the interval reset on
   completion) and several later features depend on it existing correctly first — the dashboard's
   status breakdown, the search page's status filter, and the alerts feature all assume the state
   machine's four statuses and the auto-generated "Due" record already work.
3. **Vehicle edit/archive/restore.** A self-contained gap with no dependencies on anything else,
   picked as a deliberately fast, low-risk module after two more complex ones.
4. **Server-side search, filter, sort, and pagination** for the fleet-wide service record view.
5. **CSV bulk import and export**, replacing an earlier manual-entry version of the bulk-odometer
   feature with the CSV-driven flow the brief actually asks for.
6. **The dashboard rework**, once there was enough real state-machine activity (Due/Booked/In
   Service/Completed records) to have real numbers to show.
7. **Exposing the audit timeline in the UI** — the logging itself had existed since the state
   machine work, but was never surfaced; this pass also added technician unassignment and notes,
   both required by the brief but not yet built.
8. **Overdue alerts**, last of the ten core goals, since it builds directly on the grace-period
   logic from step 2.
9. **Deployment** — Supabase, then Render, then Vercel, in that order, since each one needed
   something from the one before it.
10. **Documentation and interview preparation**, once the app itself was feature-complete and
    deployed.

## What did you estimate versus what it actually took?

Going in, the personal estimate was **7&ndash;8 hours**. An earlier AI-drafted version of this
plan had separately budgeted a fuller **12 hours** across six 2-hour sessions. Actual time landed
at roughly **11.5&ndash;12 hours** — close to that AI-drafted budget, despite the lower personal
estimate at the start. Most of the overrun sits in the Aug 30 session, which ended up absorbing
both the tail of the original scaffold's commits and the start of the full guided rebuild in one
sitting, rather than being spread across the smaller session sizes originally planned.

## What did you cut when you ran short?

None of the optional stretch goals (trip logs, fuel tracking, parts inventory, inspection
checklists, etc.) were attempted — all available time went to getting the ten required goals
solid rather than starting extras. Within the required scope, nothing else was cut: everything
described in `architecture.md`, `schema.md`, and `decisions.md` was actually completed, including
the two things noted there as deliberate scope boundaries rather than gaps — no background
scheduler for due-detection (it runs lazily on read instead), and no explicit row-level locking on
the state machine against a genuine concurrent-request race condition.