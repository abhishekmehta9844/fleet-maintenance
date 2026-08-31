import csv
import io
from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
import models, schemas, auth
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fleet Maintenance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OVERDUE_GRACE_PERIOD_DAYS = 3

VALID_TRANSITIONS = {
    "Due": "Booked",
    "Booked": "In Service",
    "In Service": "Completed",
}

VALID_SORT_FIELDS = {
    "scheduled_date": models.ServiceRecord.scheduled_date,
    "status": models.ServiceRecord.status,
    "updated_at": models.ServiceRecord.updated_at,
}

def log_audit(db: Session, action_type: str, old_value: str = None, new_value: str = None, service_record_id: UUID = None, user_id: UUID = None):
    new_log = models.AuditLog(
        action_type=action_type,
        old_value=old_value,
        new_value=new_value,
        service_record_id=service_record_id,
        user_id=user_id,
    )
    db.add(new_log)

def vehicle_is_due(vehicle: models.Vehicle) -> bool:
    baseline_date = vehicle.last_service_date or vehicle.created_at
    baseline_odometer = vehicle.last_service_odometer if vehicle.last_service_odometer is not None else 0

    months_since = (datetime.utcnow() - baseline_date).days / 30
    if months_since >= vehicle.service_interval_months:
        return True

    miles_since = vehicle.current_odometer - baseline_odometer
    if miles_since >= vehicle.service_interval_miles:
        return True

    return False

def sync_due_record(db: Session, vehicle: models.Vehicle):
    open_statuses = ["Due", "Booked", "In Service"]
    existing_open = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.vehicle_id == vehicle.id)
        .filter(models.ServiceRecord.status.in_(open_statuses))
        .first()
    )
    if existing_open or not vehicle_is_due(vehicle):
        return

    # A brand new due cycle is starting, so any earlier dismissal no longer applies.
    vehicle.is_alert_dismissed = False

    new_record = models.ServiceRecord(
        vehicle_id=vehicle.id,
        status="Due",
        description="Scheduled maintenance — interval reached",
    )
    db.add(new_record)
    db.flush()
    log_audit(db=db, action_type="CREATED", new_value="Auto-generated: interval reached", service_record_id=new_record.id, user_id=None)
    db.commit()

def compute_is_overdue(db: Session, vehicle: models.Vehicle) -> bool:
    due_record = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.vehicle_id == vehicle.id, models.ServiceRecord.status == "Due")
        .order_by(models.ServiceRecord.created_at.desc())
        .first()
    )
    if not due_record:
        return False
    grace_deadline = due_record.created_at + timedelta(days=OVERDUE_GRACE_PERIOD_DAYS)
    return datetime.utcnow() > grace_deadline

def should_show_alert(db: Session, vehicle: models.Vehicle) -> bool:
    return compute_is_overdue(db, vehicle) and not vehicle.is_alert_dismissed


@app.post("/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role not in ("manager", "technician"):
        raise HTTPException(status_code=400, detail="role must be 'manager' or 'technician'")
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = models.User(
        email=user.email,
        password_hash=auth.hash_password(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = auth.create_access_token(user_id=str(user.id), role=user.role)
    return schemas.Token(access_token=token)

@app.get("/auth/me", response_model=schemas.UserResponse)
def read_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.post("/vehicles/", response_model=schemas.VehicleResponse)
def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.registration_number == vehicle.registration_number).first()
    if db_vehicle:
        raise HTTPException(status_code=400, detail="Registration number already registered")

    new_vehicle = models.Vehicle(**vehicle.model_dump())
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    new_vehicle.is_overdue = False
    return new_vehicle

@app.get("/vehicles/", response_model=List[schemas.VehicleResponse])
def read_vehicles(skip: int = 0, limit: int = 100, archived: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == archived).offset(skip).limit(limit).all()
    for vehicle in vehicles:
        if not archived:
            sync_due_record(db, vehicle)
        vehicle.is_overdue = should_show_alert(db, vehicle)
    return vehicles

@app.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleResponse)
def update_vehicle(vehicle_id: UUID, updates: schemas.VehicleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    update_data = updates.model_dump(exclude_unset=True)

    if "registration_number" in update_data:
        duplicate = (
            db.query(models.Vehicle)
            .filter(models.Vehicle.registration_number == update_data["registration_number"])
            .filter(models.Vehicle.id != vehicle_id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Registration number already registered to another vehicle")

    for field, value in update_data.items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)
    vehicle.is_overdue = should_show_alert(db, vehicle)
    return vehicle

@app.put("/vehicles/{vehicle_id}/archive", response_model=schemas.VehicleResponse)
def archive_vehicle(vehicle_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.is_archived = True
    db.commit()
    db.refresh(vehicle)
    vehicle.is_overdue = False
    return vehicle

@app.put("/vehicles/{vehicle_id}/restore", response_model=schemas.VehicleResponse)
def restore_vehicle(vehicle_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.is_archived = False
    db.commit()
    db.refresh(vehicle)
    vehicle.is_overdue = should_show_alert(db, vehicle)
    return vehicle

@app.put("/vehicles/{vehicle_id}/dismiss-alert", response_model=schemas.VehicleResponse)
def dismiss_alert(vehicle_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.is_alert_dismissed = True
    db.commit()
    db.refresh(vehicle)
    vehicle.is_overdue = False
    return vehicle

@app.get("/alerts/", response_model=List[schemas.VehicleResponse])
def get_alerts(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    active_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == False).all()
    alerts = []
    for vehicle in active_vehicles:
        sync_due_record(db, vehicle)
        vehicle.is_overdue = should_show_alert(db, vehicle)
        if vehicle.is_overdue:
            alerts.append(vehicle)
    return alerts

@app.get("/alerts/count")
def get_alert_count(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    active_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == False).all()
    count = 0
    for vehicle in active_vehicles:
        sync_due_record(db, vehicle)
        if should_show_alert(db, vehicle):
            count += 1
    return {"count": count}

@app.post("/vehicles/bulk-odometer-csv/")
async def bulk_update_odometers_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file.")

    raw = await file.read()
    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read the file as UTF-8 text.")

    reader = csv.DictReader(io.StringIO(decoded))
    required_columns = {"registration_number", "odometer"}
    if not reader.fieldnames or not required_columns.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="CSV must have 'registration_number' and 'odometer' columns.")

    results = []
    vehicle_cache: dict = {}

    for row_number, row in enumerate(reader, start=2):
        reg = (row.get("registration_number") or "").strip()
        raw_odometer = (row.get("odometer") or "").strip()

        if not reg:
            results.append({"row": row_number, "registration_number": reg, "status": "rejected", "reason": "Missing registration number."})
            continue

        try:
            new_odometer = int(raw_odometer)
        except (TypeError, ValueError):
            results.append({"row": row_number, "registration_number": reg, "status": "rejected", "reason": f"'{raw_odometer}' is not a valid whole-number odometer reading."})
            continue

        vehicle = vehicle_cache.get(reg)
        if vehicle is None:
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.registration_number == reg).first()
            if vehicle:
                vehicle_cache[reg] = vehicle

        if not vehicle:
            results.append({"row": row_number, "registration_number": reg, "status": "rejected", "reason": "No vehicle found with this registration number."})
            continue

        if new_odometer < vehicle.current_odometer:
            results.append({
                "row": row_number,
                "registration_number": reg,
                "status": "rejected",
                "reason": f"New reading ({new_odometer}) is lower than the current recorded reading ({vehicle.current_odometer}).",
            })
            continue

        old_odometer = vehicle.current_odometer
        vehicle.current_odometer = new_odometer
        log_audit(
            db=db,
            action_type="ODOMETER_UPDATE",
            old_value=f"Vehicle {vehicle.id}: {old_odometer}",
            new_value=str(new_odometer),
            user_id=current_user.id,
        )
        results.append({"row": row_number, "registration_number": reg, "status": "success", "reason": None})

    db.commit()

    success_count = sum(1 for r in results if r["status"] == "success")
    return {
        "total_rows": len(results),
        "success_count": success_count,
        "rejected_count": len(results) - success_count,
        "results": results,
    }

@app.get("/service-records/export-csv/")
def export_service_records_csv(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    records = db.query(models.ServiceRecord).order_by(models.ServiceRecord.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["vehicle_registration_number", "status", "description", "scheduled_date", "created_at", "completed_at"])
    for record in records:
        writer.writerow([
            record.vehicle.registration_number if record.vehicle else "",
            record.status,
            record.description or "",
            record.scheduled_date.isoformat() if record.scheduled_date else "",
            record.created_at.isoformat() if record.created_at else "",
            record.completed_at.isoformat() if record.completed_at else "",
        ])
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=service_history.csv"},
    )

@app.post("/service-records/", response_model=schemas.ServiceRecordResponse)
def create_service_record(record: schemas.ServiceRecordCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == record.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    new_record = models.ServiceRecord(**record.model_dump())
    db.add(new_record)
    db.flush()
    log_audit(db=db, action_type="CREATED", new_value=new_record.description, service_record_id=new_record.id, user_id=current_user.id)
    db.commit()
    db.refresh(new_record)
    new_record.vehicle_registration_number = vehicle.registration_number
    return new_record

@app.get("/service-records/", response_model=schemas.ServiceRecordListResponse)
def list_service_records(
    search: str = "",
    vehicle_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    technician_id: Optional[UUID] = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.ServiceRecord)

    if current_user.role == "technician":
        query = query.join(models.Assignment).filter(models.Assignment.technician_id == current_user.id)
    elif technician_id:
        query = query.join(models.Assignment).filter(models.Assignment.technician_id == technician_id)

    if search:
        query = query.filter(models.ServiceRecord.description.ilike(f"%{search}%"))
    if vehicle_id:
        query = query.filter(models.ServiceRecord.vehicle_id == vehicle_id)
    if status_filter:
        query = query.filter(models.ServiceRecord.status == status_filter)

    total = query.count()

    sort_column = VALID_SORT_FIELDS.get(sort_by, models.ServiceRecord.updated_at)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())

    records = query.offset(skip).limit(limit).all()
    for record in records:
        record.vehicle_registration_number = record.vehicle.registration_number if record.vehicle else None

    return schemas.ServiceRecordListResponse(total=total, items=records)

@app.get("/vehicles/{vehicle_id}/service-records/", response_model=List[schemas.ServiceRecordResponse])
def get_vehicle_service_records(vehicle_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.ServiceRecord).filter(models.ServiceRecord.vehicle_id == vehicle_id)
    if current_user.role == "technician":
        query = query.join(models.Assignment).filter(models.Assignment.technician_id == current_user.id)
    records = query.order_by(models.ServiceRecord.created_at.desc()).all()
    return records

@app.get("/me/service-records/", response_model=List[schemas.ServiceRecordResponse])
def get_my_service_records(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("technician"))):
    records = (
        db.query(models.ServiceRecord)
        .join(models.Assignment)
        .filter(models.Assignment.technician_id == current_user.id)
        .order_by(models.ServiceRecord.created_at.desc())
        .all()
    )
    return records

@app.put("/service-records/{record_id}", response_model=schemas.ServiceRecordResponse)
def update_service_status(record_id: UUID, record_update: schemas.ServiceRecordUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_record = db.query(models.ServiceRecord).filter(models.ServiceRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="Service record not found")

    if current_user.role == "technician":
        assigned = db.query(models.Assignment).filter_by(service_record_id=record_id, technician_id=current_user.id).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="You are not assigned to this service record")

    old_status = db_record.status
    new_status = record_update.status

    if new_status != old_status:
        expected_next = VALID_TRANSITIONS.get(old_status)
        if new_status != expected_next:
            if expected_next:
                detail = f"Cannot move a service record from '{old_status}' to '{new_status}'. The only allowed next step is '{expected_next}'."
            else:
                detail = f"'{old_status}' is a final state and cannot be changed."
            raise HTTPException(status_code=400, detail=detail)

        if new_status == "Booked":
            has_date = record_update.scheduled_date or db_record.scheduled_date
            if not has_date:
                raise HTTPException(status_code=400, detail="Cannot move to Booked without a scheduled date.")
            technician_count = db.query(models.Assignment).filter_by(service_record_id=record_id).count()
            if technician_count == 0:
                raise HTTPException(status_code=400, detail="Cannot move to Booked without at least one technician assigned.")

        db_record.status = new_status

        if new_status == "Completed":
            db_record.completed_at = datetime.utcnow()
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == db_record.vehicle_id).first()
            if vehicle:
                vehicle.last_service_date = db_record.completed_at
                vehicle.last_service_odometer = vehicle.current_odometer

        log_audit(
            db=db,
            action_type="STATUS_CHANGE",
            old_value=old_status,
            new_value=new_status,
            service_record_id=record_id,
            user_id=current_user.id,
        )

    if record_update.scheduled_date:
        db_record.scheduled_date = record_update.scheduled_date
    if record_update.description is not None:
        db_record.description = record_update.description

    db.commit()
    db.refresh(db_record)
    db_record.vehicle_registration_number = db_record.vehicle.registration_number if db_record.vehicle else None
    return db_record

@app.get("/technicians/", response_model=List[schemas.UserResponse])
def get_technicians(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).filter(models.User.role == "technician").all()

@app.post("/service-records/{record_id}/assign")
def assign_technician(record_id: UUID, assign_data: schemas.AssignmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    technician = db.query(models.User).filter(models.User.id == assign_data.technician_id, models.User.role == "technician").first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found.")

    existing = db.query(models.Assignment).filter_by(
        service_record_id=record_id,
        technician_id=assign_data.technician_id,
    ).first()

    if existing:
        return {"status": "Already assigned"}

    new_assignment = models.Assignment(
        service_record_id=record_id,
        technician_id=assign_data.technician_id,
    )
    db.add(new_assignment)
    log_audit(db=db, action_type="ASSIGNED", new_value=technician.email, service_record_id=record_id, user_id=current_user.id)
    db.commit()
    return {"status": "Successfully assigned"}

@app.delete("/service-records/{record_id}/assign/{technician_id}")
def unassign_technician(record_id: UUID, technician_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    assignment = db.query(models.Assignment).filter_by(service_record_id=record_id, technician_id=technician_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="This technician is not assigned to this service record.")

    technician = db.query(models.User).filter(models.User.id == technician_id).first()
    db.delete(assignment)
    log_audit(
        db=db,
        action_type="UNASSIGNED",
        old_value=technician.email if technician else str(technician_id),
        service_record_id=record_id,
        user_id=current_user.id,
    )
    db.commit()
    return {"status": "Technician unassigned"}

@app.post("/service-records/{record_id}/notes")
def add_note(record_id: UUID, note: schemas.NoteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    record = db.query(models.ServiceRecord).filter(models.ServiceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Service record not found")

    if current_user.role == "technician":
        assigned = db.query(models.Assignment).filter_by(service_record_id=record_id, technician_id=current_user.id).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="You are not assigned to this service record")

    if not note.text.strip():
        raise HTTPException(status_code=400, detail="Note text cannot be empty.")

    log_audit(db=db, action_type="NOTE", new_value=note.text.strip(), service_record_id=record_id, user_id=current_user.id)
    db.commit()
    return {"status": "Note added"}

@app.get("/service-records/{record_id}/timeline", response_model=List[schemas.TimelineEntryResponse])
def get_service_record_timeline(record_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    record = db.query(models.ServiceRecord).filter(models.ServiceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Service record not found")

    if current_user.role == "technician":
        assigned = db.query(models.Assignment).filter_by(service_record_id=record_id, technician_id=current_user.id).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="You are not assigned to this service record")

    entries = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.service_record_id == record_id)
        .order_by(models.AuditLog.created_at.asc())
        .all()
    )
    for entry in entries:
        entry.actor_email = entry.user.email if entry.user else "System"
    return entries

@app.get("/dashboard/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)

    active_vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == False).all()
    for vehicle in active_vehicles:
        sync_due_record(db, vehicle)

    vehicles_due = (
        db.query(models.ServiceRecord.vehicle_id)
        .filter(models.ServiceRecord.status == "Due")
        .distinct()
        .count()
    )
    vehicles_in_service = (
        db.query(models.ServiceRecord.vehicle_id)
        .filter(models.ServiceRecord.status == "In Service")
        .distinct()
        .count()
    )
    completed_this_week = (
        db.query(models.ServiceRecord)
        .filter(models.ServiceRecord.status == "Completed")
        .filter(models.ServiceRecord.completed_at >= one_week_ago)
        .count()
    )
    vehicles_overdue = sum(1 for v in active_vehicles if should_show_alert(db, v))

    status_rows = (
        db.query(models.ServiceRecord.status, func.count(models.ServiceRecord.id))
        .group_by(models.ServiceRecord.status)
        .all()
    )
    status_breakdown = {status_name: count for status_name, count in status_rows}

    technician_rows = (
        db.query(models.User.email, func.count(models.Assignment.service_record_id))
        .join(models.Assignment, models.Assignment.technician_id == models.User.id)
        .filter(models.User.role == "technician")
        .group_by(models.User.email)
        .all()
    )
    technician_breakdown = [{"technician": email, "count": count} for email, count in technician_rows]

    weekly_completions = []
    for week_index in range(7, -1, -1):
        week_start = now - timedelta(days=7 * (week_index + 1))
        week_end = now - timedelta(days=7 * week_index)
        count = (
            db.query(models.ServiceRecord)
            .filter(models.ServiceRecord.status == "Completed")
            .filter(models.ServiceRecord.completed_at >= week_start)
            .filter(models.ServiceRecord.completed_at < week_end)
            .count()
        )
        weekly_completions.append({"week_start": week_start.date().isoformat(), "completed": count})

    return {
        "vehicles_due": vehicles_due,
        "vehicles_in_service": vehicles_in_service,
        "completed_this_week": completed_this_week,
        "vehicles_overdue": vehicles_overdue,
        "status_breakdown": status_breakdown,
        "technician_breakdown": technician_breakdown,
        "weekly_completions": weekly_completions,
    }
