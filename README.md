# Fleet Maintenance System

A full-stack web application for managing a fleet of delivery vehicles — tracking service
intervals, assigning technicians, and replacing a wall calendar and whiteboard with a single
source of truth.

Built as Assignment 08 for a hiring process. All 10 required goals completed and deployed.

## Live Demo

**[fleet-maintenance-seven.vercel.app](https://fleet-maintenance-seven.vercel.app)**

> The backend is hosted on Render's free tier and may take 30–60 seconds to wake up on the
> first request after a period of inactivity.

| Role | Email | Password |
|------|-------|----------|
| Fleet Manager | manager@fleet.com | pass123 |
| Technician | tech@fleet.com | pass123 |

---

## What it does

- Vehicles are tracked with two independent service triggers — a date interval and a mileage
  interval. Whichever is reached first flags the vehicle as Due.
- Service records move through a strict lifecycle: **Due → Booked → In Service → Completed**.
  Illegal transitions are rejected by the server with a specific reason.
- Fleet managers and technicians have genuinely different permissions, enforced server-side on
  every request — not just hidden in the UI.
- Every status change, technician assignment, and note is written to an immutable audit trail
  that cannot be edited or deleted after the fact.
- Overdue alerts appear when a vehicle sits Due past its grace period without being booked.
  Dismissing an alert only silences it for the current cycle — it returns on the next one.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy + PyJWT + bcrypt |
| Database | PostgreSQL (Supabase in production, SQLite locally) |
| Hosting | Vercel (frontend) + Render (backend) + Supabase (database) |

---

## Running locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Backend

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\Activate.ps1

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# Create a .env file
cp .env.example .env
# Edit .env and set JWT_SECRET_KEY to any long random string
# Leave DATABASE_URL as-is to use local SQLite

uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

### Seed demo accounts (first time only)

With the backend running, open a second terminal and run:

```powershell
# Windows PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"manager@fleet.com","password":"pass123","role":"manager"}'
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"tech@fleet.com","password":"pass123","role":"technician"}'
```

```bash
# Mac/Linux
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d '{"email":"manager@fleet.com","password":"pass123","role":"manager"}'
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d '{"email":"tech@fleet.com","password":"pass123","role":"technician"}'
```

### Frontend

```bash
cd frontend
npm install

# Create a .env file
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000 is already the default

npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Project structure

```
fleet-maintenance/
├── backend/
│   ├── main.py          # All API routes
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── auth.py          # JWT issuing, verification, role guards
│   ├── database.py      # Engine, session, get_db dependency
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── lib/
│       │   └── api.ts
│       └── components/
│           ├── Login.tsx
│           ├── VehicleList.tsx
│           ├── VehicleForm.tsx
│           ├── ServiceRecords.tsx
│           ├── FleetDashboard.tsx
│           ├── ServiceRecordSearch.tsx
│           ├── BulkOdometerUpdate.tsx
│           └── AlertsPanel.tsx
└── docs/
    ├── architecture.md
    ├── schema.md
    ├── decisions.md
    ├── plan.md
    └── ai-prompts.md
```

---

## Documentation

Full technical documentation is in the `docs/` folder:

- **`architecture.md`** — system overview, request path walkthrough, what was deliberately not built
- **`schema.md`** — every table, relationship, and constraint
- **`decisions.md`** — 6 real design decisions with alternatives considered
- **`plan.md`** — build order, time breakdown, what was cut
- **`ai-prompts.md`** — AI tools used, prompts that went wrong, what was corrected

---

## Goals completed

| # | Goal |
|---|------|
| 1 | Accounts and roles — server-enforced permissions |
| 2 | Vehicles — create, edit, archive, restore |
| 3 | Service records — manager creates, assignee edits description |
| 4 | Service lifecycle — strict state machine with rules |
| 5 | Assignment — many-to-many, manager-only, technician cross-vehicle view |
| 6 | Finding service records — server-side search, filter, sort, pagination |
| 7 | Bulk odometer CSV import + service history CSV export |
| 8 | Dashboard — live metrics, status/technician breakdown, 8-week chart |
| 9 | Immutable audit timeline — status changes, assignments, notes |
| 10 | Overdue alerts — nav badge, dismiss, per-cycle reset |
