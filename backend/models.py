import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, Uuid
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    service_records = relationship("ServiceRecord", secondary="assignments", back_populates="technicians")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_number = Column(String(50), unique=True, index=True, nullable=False)
    make_model = Column(String(255), nullable=False)
    current_odometer = Column(Integer, nullable=False)
    service_interval_months = Column(Integer, nullable=False)
    service_interval_miles = Column(Integer, nullable=False)
    last_service_date = Column(DateTime, nullable=True)
    last_service_odometer = Column(Integer, nullable=True)
    is_archived = Column(Boolean, default=False)
    is_alert_dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("ServiceRecord", back_populates="vehicle")

class ServiceRecord(Base):
    __tablename__ = "service_records"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(Uuid(as_uuid=True), ForeignKey("vehicles.id"))
    status = Column(String(50), nullable=False, default="Due")
    scheduled_date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    vehicle = relationship("Vehicle", back_populates="records")
    technicians = relationship("User", secondary="assignments", back_populates="service_records")

class Assignment(Base):
    __tablename__ = "assignments"
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    service_record_id = Column(Uuid(as_uuid=True), ForeignKey("service_records.id"), primary_key=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_record_id = Column(Uuid(as_uuid=True), ForeignKey("service_records.id"))
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"))
    action_type = Column(String(50), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
