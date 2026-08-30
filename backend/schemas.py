from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional

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