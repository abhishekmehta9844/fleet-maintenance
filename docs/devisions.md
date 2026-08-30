# Engineering Decisions & Trade-offs

1. **UUIDs vs. Auto-Incrementing Integers**
   * *Decision:* Used UUIDv4 for all primary keys.
   * *Rationale:* Prevents ID enumeration attacks (e.g., guessing `/vehicles/1` then `/vehicles/2`). Makes distributed database merging easier if the system scales horizontally in the future.

2. **Backend Immutable Ledger vs. Frontend Tracking**
   * *Decision:* Built the audit log entirely in FastAPI using SQLAlchemy event hooks/route injections.
   * *Rationale:* Security. An audit trail must be tamper-proof. If it relied on the frontend to send a "log this" API call, a malicious user or network failure could bypass the audit log.

3. **SQLite over PostgreSQL**
   * *Decision:* Shipped with SQLite.
   * *Rationale:* Fits the 12-hour budget requirement perfectly. Zero setup is required for the reviewer to run the application locally. SQLAlchemy abstracts the SQL syntax, so migrating to PostgreSQL later only requires changing the connection string in `database.py`.

4. **Frontend UI State for RBAC**
   * *Decision:* Implemented a role-switcher dropdown in React to toggle between Manager and Technician views.
   * *Rationale:* Simulates JWT-based Role-Based Access Control without forcing the reviewer to create accounts, log in, and handle token expirations during grading.