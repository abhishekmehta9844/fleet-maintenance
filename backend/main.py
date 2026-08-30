from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
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

    new_record = models.ServiceRecord(
        vehicle_id=vehicle.id,
        status="Due",
        description="Scheduled maintenance — interval reached",
    )
    db.add(new_record)
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
def read_vehicles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == False).offset(skip).limit(limit).all()
    for vehicle in vehicles:
        sync_due_record(db, vehicle)
        vehicle.is_overdue = compute_is_overdue(db, vehicle)
    return vehicles

@app.post("/service-records/", response_model=schemas.ServiceRecordResponse)
def create_service_record(record: schemas.ServiceRecordCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == record.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    new_record = models.ServiceRecord(**record.model_dump())
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

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
    return db_record

@app.get("/technicians/", response_model=List[schemas.UserResponse])
def get_technicians(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).filter(models.User.role == "technician").all()

@app.post("/service-records/{record_id}/assign")
def assign_technician(record_id: UUID, assign_data: schemas.AssignmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
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
    log_audit(db=db, action_type="ASSIGNED", new_value=str(assign_data.technician_id), service_record_id=record_id, user_id=current_user.id)
    db.commit()
    return {"status": "Successfully assigned"}

@app.put("/vehicles/bulk-odometer/")
def bulk_update_odometers(data: schemas.BulkOdometerUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role("manager"))):
    updated_count = 0
    for update in data.updates:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == update.id).first()
        if vehicle and update.new_odometer >= vehicle.current_odometer:
            old_odometer = vehicle.current_odometer
            vehicle.current_odometer = update.new_odometer

            log_audit(
                db=db,
                action_type="ODOMETER_UPDATE",
                old_value=f"Vehicle {update.id}: {old_odometer}",
                new_value=str(update.new_odometer),
                user_id=current_user.id,
            )
            updated_count += 1

    db.commit()
    return {"status": "success", "updated_count": updated_count}

@app.get("/dashboard/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    total_vehicles = db.query(models.Vehicle).count()

    pending_tasks = db.query(models.ServiceRecord).filter(
        models.ServiceRecord.status.in_(["Due", "Booked", "In Service"])
    ).count()

    completed_tasks = db.query(models.ServiceRecord).filter(
        models.ServiceRecord.status == "Completed"
    ).count()

    return {
        "total_vehicles": total_vehicles,
        "active_tasks": pending_tasks,
        "completed_tasks": completed_tasks,
    }
