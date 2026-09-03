# AI prompts

AI (Claude, Gemini) was used throughout this project, for planning, code generation, debugging, and this
documentation itself. This file groups the prompts by what was being worked on, in the order they
happened, and is honest about the rounds that didn't work the first time.

## Deciding the tech stack

### Prompt
"is mern stack a good option"

### What you got
An analysis of MERN (Mongo/Express/React/Node) against the project's actual data shape — the
many-to-many technician assignment, the required audit trail, and the dashboard's grouped
aggregate queries all favor a relational database over a document store — recommending
PostgreSQL with Prisma or a similar relational setup instead of Mongo, while keeping React on the
frontend.

### What you corrected
By the time actual project files were reviewed, a partial FastAPI + SQLAlchemy backend already
existed (built with a different AI tool before this conversation). Rather than rewrite it in
Node as first suggested, the decision was made to keep FastAPI and build on what already existed,
given the 12-hour time budget — see `decisions.md`, Decision 1's context.

## Auditing the existing codebase

### Prompt
"i have already created a bit of it with some ai, but missing something can you tell me the exact
changes step by step to achieve this"

### What you got
A full goal-by-goal audit against all 10 required goals, comparing the uploaded `backend.zip` /
`frontend.zip` against the brief. This surfaced a real crash bug (an undefined variable
`old_odo` in the bulk-odometer endpoint that would `NameError` on every call), and flagged that
`decisions.md` (misnamed `devisions.md`) contained a decision to skip real server-side
authentication entirely — directly contradicting the brief's explicit requirement.

### What you corrected
Nothing was "wrong" in this response itself, but it's the reason the very next module (auth) was
prioritized first — the audit made clear that almost everything else in the brief depended on
real roles being enforced server-side.

## Building the authentication module

### Prompt
"Auth + server-side roles (blocks everything else)"

### What you got
A full JWT + bcrypt authentication module: `auth.py`, updated `schemas.py`/`main.py`, and new
frontend files (`lib/api.ts`, `context/AuthContext.tsx`, `components/Login.tsx`), replacing the
old client-side role dropdown.

### What you corrected
Several environment issues surfaced while applying this, unrelated to the code itself:
`pip install` had run against the global Python interpreter instead of the project's virtual
environment (`ModuleNotFoundError: No module named 'jwt'`), fixed by properly activating the venv
first; and the new `lib/` and `context/` folders had never actually been created on disk, causing
Vite import errors, fixed by creating them directly from the terminal rather than relying on a
manual copy-paste step that had been skipped.

## Building the state machine, and everything after it

### Prompt
(across several turns) "Fix the state machine + grace period logic", then in turn: search/filter/
pagination, CSV import/export, archive/restore, the dashboard rework, the audit timeline, and
overdue alerts — each requested as its own focused module once the previous one was confirmed
working.

### What you got
Each module as a self-contained set of full-file replacements (never partial diffs, to avoid
manual-edit mistakes), plus explicit test steps for each one before moving to the next.

### What you corrected
A real bug was introduced during the CSV module: after a successful upload,
`BulkOdometerUpdate`'s results table would flash and then vanish. The cause was a `key` prop on
that component in `App.tsx`, copied from a pattern used for a different, genuinely
data-fetching component — React treats a changed `key` as an instruction to fully unmount and
remount a component, which was wiping the very state that had just been set. Fixed by removing
the `key` prop from that one component, since it never needed the forced-refetch behavior in the
first place.

## Deploying to production

### Prompt
"look at deployment", followed by many rounds of pasting real error screenshots as they occurred.

### What you got
A step-by-step deployment sequence (Supabase &rarr; Render &rarr; Vercel &rarr; connect CORS
&rarr; seed data), plus code changes to make the hardcoded `localhost:8000` URLs and the
hardcoded CORS origin configurable via environment variables.

### What you corrected — the one that took the most rounds to get right
The frontend kept calling `localhost:8000` in production no matter what was set in Vercel's
dashboard, across several redeploys, cache-clears, and incognito tests. Each fix attempt targeted
the wrong layer: first assumed to be a stale build cache, then assumed to be a Vercel environment
variable scope issue. The actual root cause only surfaced after directly checking what code was
committed to GitHub — the fixed version of `api.ts` (the one that reads
`import.meta.env.VITE_API_BASE_URL`) had never actually been pushed; GitHub still had the old,
fully hardcoded version. No Vercel configuration could have fixed a problem that was in the
committed source code itself. This was corrected by committing and pushing the actual fix, and
became the single biggest lesson of the deployment process: confirm what's really on the branch
being built before assuming the hosting configuration is wrong.

Separately, two Supabase/Render-specific connection errors were hit and fixed in sequence: a
"Network is unreachable" error caused by Render's lack of outbound IPv6 support against
Supabase's IPv6-only direct connection (fixed by switching to Supabase's IPv4 connection pooler),
and then a password-authentication failure caused by the pooler requiring a
`postgres.<project-ref>` username format rather than the plain `postgres` used by the direct
connection.

## Seeding demo data

### Prompt
"please give me dummy data for 5 to 6 vehicles and go step by step"

### What you got
Six realistic vehicles with deliberately varied intervals, designed to demonstrate both the
mileage-triggered and date-triggered "Due" paths.

### What you corrected
While seeding, discovered the "Add Vehicle" form never exposed input fields for the two service
interval values at all — it silently submitted hardcoded defaults (6 months / 5000 miles)
regardless of what was intended. This was fixed by adding the two missing fields to the form, and
is a good example of a gap that only surfaced through actually trying to use the feature with
real data, rather than through code review alone.

## Documentation and interview preparation

### Prompt
"tell me everything from scratch ... put everything in pdf" and "let's go for documentation"

### What you got
A full technical reference PDF (stack, code walkthrough, architecture, all real bugs hit during
the build, design decisions, and an interview question bank with model answers), and rewritten
versions of `architecture.md`, `schema.md`, `decisions.md`, and this file, reflecting the final
state of the project rather than the original stubs.

### What you corrected
N/A for this pass — these were synthesis/documentation requests rather than code changes, and
were reviewed for accuracy against the actual conversation rather than corrected after the fact.
