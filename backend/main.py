from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from uuid import UUID
import models, schemas
from database import engine, SessionLocal

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fleet Maintenance API")

# Configure CORS to allow the React frontend to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Dependency to open and close a database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/vehicles/", response_model=schemas.VehicleResponse)
def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db)):
    # Prevent duplicate registration numbers
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.registration_number == vehicle.registration_number).first()
    if db_vehicle:
        raise HTTPException(status_code=400, detail="Registration number already registered")
    
    new_vehicle = models.Vehicle(**vehicle.model_dump())
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle

@app.get("/vehicles/", response_model=List[schemas.VehicleResponse])
def read_vehicles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Only return active vehicles
    vehicles = db.query(models.Vehicle).filter(models.Vehicle.is_archived == False).offset(skip).limit(limit).all()
    return vehicles

@app.post("/service-records/", response_model=schemas.ServiceRecordResponse)
def create_service_record(record: schemas.ServiceRecordCreate, db: Session = Depends(get_db)):
    # Verify the vehicle exists first
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == record.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Status defaults to "Due" via the SQLAlchemy model
    new_record = models.ServiceRecord(**record.model_dump())
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@app.get("/vehicles/{vehicle_id}/service-records/", response_model=List[schemas.ServiceRecordResponse])
def get_vehicle_service_records(vehicle_id: UUID, db: Session = Depends(get_db)):
    # Fetch all service history for a specific vehicle
    records = db.query(models.ServiceRecord).filter(models.ServiceRecord.vehicle_id == vehicle_id).order_by(models.ServiceRecord.created_at.desc()).all()
    return records

@app.put("/service-records/{record_id}", response_model=schemas.ServiceRecordResponse)
def update_service_status(record_id: UUID, record_update: schemas.ServiceRecordUpdate, db: Session = Depends(get_db)):
    db_record = db.query(models.ServiceRecord).filter(models.ServiceRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="Service record not found")
    
    # Update the status
    db_record.status = record_update.status
    
    # Automatically timestamp when the job is marked as Completed
    if record_update.status == "Completed" and not db_record.completed_at:
        db_record.completed_at = datetime.utcnow()
        
    db.commit()
    db.refresh(db_record)
    return db_record