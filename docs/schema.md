# Schema

## Table by table: what columns and types does each one have?

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| email | string, unique, indexed | |
| password_hash | string | bcrypt hash, never the plain password |
| role | string | `"manager"` or `"technician"` |
| created_at | datetime | |

**vehicles**
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| registration_number | string, unique, indexed | |
| make_model | string | |
| current_odometer | integer | |
| service_interval_months | integer | |
| service_interval_miles | integer | |
| last_service_date | datetime, nullable | null until the vehicle's first completed service |
| last_service_odometer | integer, nullable | reset together with last_service_date on completion |
| is_archived | boolean | |
| is_alert_dismissed | boolean | reset to false automatically whenever a new due cycle starts |
| created_at | datetime | used as the due-date baseline for a vehicle never yet serviced |

**service_records**
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| vehicle_id | UUID, FK &rarr; vehicles.id | |
| status | string | `"Due"`, `"Booked"`, `"In Service"`, or `"Completed"` |
| scheduled_date | datetime, nullable | required before a record can move to Booked |
| description | text, nullable | |
| created_at | datetime | |
| updated_at | datetime | auto-maintained by SQLAlchemy's `onupdate`, used for "sort by last update" |
| completed_at | datetime, nullable | |

**assignments** (the technician &harr; service record join table)
| Column | Type | Notes |
|---|---|---|
| technician_id | UUID, FK &rarr; users.id | part of the composite primary key |
| service_record_id | UUID, FK &rarr; service_records.id | part of the composite primary key |
| assigned_at | datetime | |

**audit_logs**
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| service_record_id | UUID, FK &rarr; service_records.id, nullable | null for odometer-update entries, which aren't tied to one record |
| user_id | UUID, FK &rarr; users.id, nullable | null for interval-triggered auto-created "Due" records, which have no human actor |
| action_type | string | `CREATED`, `STATUS_CHANGE`, `ASSIGNED`, `UNASSIGNED`, `NOTE`, `ODOMETER_UPDATE` |
| old_value | text, nullable | |
| new_value | text, nullable | |
| created_at | datetime | |

## Which relationships are one-to-many, and which are many-to-many?

- **vehicles &rarr; service_records**: one-to-many. Every service record belongs to exactly one
  vehicle, enforced by the foreign key.
- **service_records &harr; users (technicians)**: many-to-many, through the `assignments` join
  table. Any number of technicians can be assigned to a record, and a technician can be assigned
  to any number of records.
- **audit_logs &rarr; service_records** and **audit_logs &rarr; users**: both many-to-one, and
  both nullable for the reasons noted above.

## Which constraints live in the database, and which in the application?

**Database-level:** primary keys, foreign keys (a service record can't reference a vehicle that
doesn't exist), the unique constraint on `registration_number`, and the composite primary key on
`assignments` — which makes it structurally impossible to double-assign the same technician to
the same record, with no application code needed to prevent it.

**Application-level:** the state-machine transition rules (`Due &rarr; Booked &rarr; In Service
&rarr; Completed`, with the specific pre-conditions for Booked), the role-based permission checks,
the overdue grace-period calculation, the CSV row-validation logic, and the rule that a new
odometer reading can't be lower than the last recorded one. None of these map cleanly onto plain
SQL constraints without stored procedures, so they live in `main.py`, where they're easier to
read, test, and change.

## What was deliberately denormalized?

`vehicle_registration_number` is attached to `ServiceRecordResponse` at request time even though
it isn't a real column on `service_records` — it's pulled from the related `Vehicle` and set as a
response-only attribute right before serialization. This lets a flat, fleet-wide list of service
records show which vehicle each one belongs to without a second round-trip. It's safe to
denormalize this way specifically because it's read-only and recomputed on every response, so it
can never drift out of sync with the real data.

## What would break first at 100x the data?

The N+1 query pattern in `read_vehicles` and the dashboard's overdue-count calculation, both of
which loop over every active vehicle in Python and issue a separate query per vehicle to check its
due/overdue status (`sync_due_record`, `compute_is_overdue`). At today's demo scale this is
invisible; at 100x the fleet size it would become the dominant cost on the two most-visited pages
in the app. The fix is pushing that per-vehicle logic into a single aggregate SQL query (joining
vehicles to their most recent Due record and computing the grace-period comparison in SQL) and
adding an index on `service_records(vehicle_id, status)`, which today relies only on the primary
key and the foreign key column itself.
