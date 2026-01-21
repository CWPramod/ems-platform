"""
SQLAlchemy ORM models for existing EMS database
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean, Enum
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class AssetType(str, enum.Enum):
    """Asset type enumeration"""
    server = "server"
    application = "application"
    database = "database"
    network = "network"
    router = "router"
    switch = "switch"
    firewall = "firewall"
    load_balancer = "load_balancer"


class AssetStatus(str, enum.Enum):
    """Asset status enumeration"""
    online = "online"
    offline = "offline"
    maintenance = "maintenance"
    unknown = "unknown"


class EventSeverity(str, enum.Enum):
    """Event severity enumeration"""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Asset(Base):
    """
    Asset model - maps to existing 'assets' table
    """
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="online")
    ip = Column(String(50), nullable=True, index=True)  # Note: 'ip' not 'ipAddress'
    location = Column(String(255), nullable=True)
    meta_data = Column(JSON, nullable=True)  # JSONB in PostgreSQL
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Asset(id={self.id}, name='{self.name}', type='{self.type}', status='{self.status}')>"


class Event(Base):
    """
    Event model - maps to existing 'events' table
    """
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    assetId = Column(Integer, nullable=False, index=True)
    eventType = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="low", index=True)
    message = Column(Text, nullable=False)
    source = Column(String(50), nullable=True, default="system", index=True)
    meta_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<Event(id={self.id}, assetId={self.assetId}, severity='{self.severity}', type='{self.eventType}')>"


class Metric(Base):
    """
    Metric model - maps to existing 'metrics' table
    """
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    assetId = Column(Integer, nullable=False, index=True)
    metricName = Column(String(100), nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=True)
    meta_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<Metric(id={self.id}, assetId={self.assetId}, name='{self.metricName}', value={self.value})>"


class Alert(Base):
    """
    Alert model - maps to existing 'alerts' table
    """
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    assetId = Column(Integer, nullable=False, index=True)
    alertType = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="low", index=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open", index=True)
    meta_data = Column(JSON, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), index=True)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())
    acknowledgedAt = Column(DateTime, nullable=True)
    resolvedAt = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Alert(id={self.id}, assetId={self.assetId}, severity='{self.severity}', status='{self.status}')>"


# Additional ML-specific models (if needed for storing ML results)

class AnomalyScore(Base):
    """
    Anomaly score model - stores ML anomaly detection results
    """
    __tablename__ = "anomaly_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    assetId = Column(Integer, nullable=False, index=True)
    metricName = Column(String(100), nullable=False, index=True)
    score = Column(Float, nullable=False)  # Anomaly score (0-1, higher = more anomalous)
    isAnomaly = Column(Boolean, nullable=False, default=False)
    threshold = Column(Float, nullable=False)
    meta_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<AnomalyScore(id={self.id}, assetId={self.assetId}, score={self.score}, isAnomaly={self.isAnomaly})>"


class ModelMetadata(Base):
    """
    Model metadata - stores information about trained ML models
    """
    __tablename__ = "model_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    modelType = Column(String(100), nullable=False, index=True)
    modelVersion = Column(String(50), nullable=False)
    trainingDate = Column(DateTime, nullable=False)
    metrics = Column(JSON, nullable=True)  # Model performance metrics
    parameters = Column(JSON, nullable=True)  # Model hyperparameters
    status = Column(String(20), nullable=False, default="active")
    filePath = Column(String(500), nullable=True)
    meta_data = Column(JSON, nullable=True)
    createdAt = Column(DateTime, server_default=func.now())
    
    def __repr__(self):
        return f"<ModelMetadata(id={self.id}, type='{self.modelType}', version='{self.modelVersion}')>"
