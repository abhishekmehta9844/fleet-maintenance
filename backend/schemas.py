from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, List

# --- User & Assignment Schemas ---
class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    technician_id: UUID

# --- Vehicle Schemas ---
class VehicleBase(BaseModel):
    registration_number: str
    make_model: str
    current_odometer: int
    service_interval_months: int
    service_interval_miles: int

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    registration_number: Optional[str] = None
    make_model: Optional[str] = None
    current_odometer: Optional[int] = None
    service_interval_months: Optional[int] = None
    service_interval_miles: Optional[int] = None

class VehicleResponse(VehicleBase):
    id: UUID
    last_service_date: Optional[datetime] = None
    last_service_odometer: Optional[int] = None
    is_archived: bool
    is_alert_dismissed: bool
    is_overdue: bool = False

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
    vehicle_registration_number: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    technicians: List[UserResponse] = []

    class Config:
        from_attributes = True

class ServiceRecordListResponse(BaseModel):
    total: int
    items: List[ServiceRecordResponse]

# --- Timeline & Notes Schemas ---
class NoteCreate(BaseModel):
    text: str

class TimelineEntryResponse(BaseModel):
    id: UUID
    action_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    actor_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

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
