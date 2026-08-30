# System Architecture

The Fleet Maintenance System is built using a modern, decoupled client-server architecture.

## Frontend (Client)
* **Framework:** React 18 built with Vite for rapid compilation and Hot Module Replacement (HMR).
* **Styling:** Tailwind CSS v4 for utility-first, responsive component design.
* **State Management:** React Hooks (`useState`, `useEffect`) passing down props to encapsulated components (e.g., `VehicleList` -> `ServiceRecords`).

## Backend (API Layer)
* **Framework:** FastAPI (Python) chosen for its high performance, automatic OpenAPI documentation, and asynchronous capabilities.
* **Data Validation:** Pydantic models (Schemas) enforce strict input/output typing, converting raw JSON into validated Python objects.
* **Server:** Uvicorn ASGI server.

## Database (Data Layer)
* **ORM:** SQLAlchemy maps Python classes to SQL tables.
* **Database Engine:** SQLite (local `fleet.db`) selected for zero-configuration, highly portable local development.
* **Migrations/Schema:** Managed directly via SQLAlchemy Base metadata creation.