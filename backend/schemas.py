from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, List

# --- Vehicle Schemas ---
class VehicleBase(BaseModel):
    registration_number: str
    make_model: str
    current_odometer: int
    service_interval_months: int
    service_interval_miles: int

class VehicleCreate(VehicleBase):
    pass

class VehicleResponse(VehicleBase):
    id: UUID
    last_service_date: Optional[datetime] = None
    last_service_odometer: Optional[int] = None
    is_archived: bool
    is_alert_dismissed: bool

    class Config:
        from_attributes = True

# --- Service Record Schemas ---
class ServiceRecordBase(BaseModel):
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None

class ServiceRecordCreate(ServiceRecordBase):
    vehicle_id: UUID

class ServiceRecordUpdate(BaseModel):
    status: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ServiceRecordResponse(ServiceRecordBase):
    id: UUID
    vehicle_id: UUID
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- User & Assignment Schemas ---
class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    technician_id: UUID

# --- Bulk Update Schemas ---
class OdometerUpdate(BaseModel):
    id: UUID
    new_odometer: int

class BulkOdometerUpdateRequest(BaseModel):
    updates: List[OdometerUpdate]

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: str
    password: str
    role: str

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
