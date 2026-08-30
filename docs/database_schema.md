# Database Schema

The system utilizes a relational database structure with enforced UUID primary keys.

| Table | Primary Key | Relationships | Description |
| :--- | :--- | :--- | :--- |
| **users** | `id` (UUID) | 1:M with `assignments` | Stores fleet managers and technicians. Includes role-based flags. |
| **vehicles** | `id` (UUID) | 1:M with `service_records` | Master record for fleet assets. Tracks current odometer and service intervals. |
| **service_records** | `id` (UUID) | M:1 with `vehicles`<br>1:M with `assignments` | Tracks individual maintenance tasks through a state machine (Due -> Completed). |
| **assignments** | `id` (UUID) | M:1 with `users`<br>M:1 with `service_records` | Association table enabling multiple technicians to be assigned to a single task. |
| **audit_logs** | `id` (UUID) | M:1 with `service_records`<br>M:1 with `users` | Immutable ledger tracking status changes and odometer updates. |