"""
Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums

class SeverityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MetricType(str, Enum):
    cpu = "cpu_usage"
    memory = "memory_usage"
    bandwidth = "bandwidth_usage"
    packet_loss = "packet_loss"
    latency = "latency"
    custom = "custom"


# Request Schemas

class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection"""
    assetId: Optional[int] = Field(None, description="Specific asset ID, if None analyze all")
    metricNames: Optional[List[str]] = Field(None, description="Specific metrics to analyze")
    timeRange: Optional[int] = Field(3600, description="Time range in seconds (default 1 hour)")
    threshold: Optional[float] = Field(0.7, description="Anomaly threshold (0-1)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": 1,
                "metricNames": ["cpu_usage", "memory_usage"],
                "timeRange": 3600,
                "threshold": 0.7
            }
        }


class TrainModelRequest(BaseModel):
    """Request to train a new model"""
    modelType: str = Field(..., description="Type of model to train")
    assetIds: Optional[List[int]] = Field(None, description="Specific assets to train on")
    timeRange: Optional[int] = Field(86400, description="Training data time range in seconds")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Model hyperparameters")
    
    class Config:
        json_schema_extra = {
            "example": {
                "modelType": "anomaly_detection",
                "assetIds": [1, 2, 3],
                "timeRange": 86400,
                "parameters": {"contamination": 0.1, "n_estimators": 100}
            }
        }


class PredictionRequest(BaseModel):
    """Generic prediction request"""
    assetId: int = Field(..., description="Asset ID")
    metricName: str = Field(..., description="Metric name")
    data: List[float] = Field(..., description="Data points for prediction")
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": 1,
                "metricName": "cpu_usage",
                "data": [45.2, 52.1, 48.9, 55.3, 62.7]
            }
        }


# Response Schemas

class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(..., description="Current timestamp")
    database: bool = Field(..., description="Database connection status")
    redis: Optional[bool] = Field(None, description="Redis connection status")
    models: Dict[str, bool] = Field(..., description="Loaded models status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "timestamp": "2026-01-21T10:30:00Z",
                "database": True,
                "redis": True,
                "models": {"anomaly_detection": True}
            }
        }


class AnomalyResult(BaseModel):
    """Single anomaly detection result"""
    assetId: int
    assetName: str
    metricName: str
    value: float
    score: float = Field(..., description="Anomaly score (0-1, higher = more anomalous)")
    isAnomaly: bool
    threshold: float
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": 1,
                "assetName": "Core-Router-01",
                "metricName": "cpu_usage",
                "value": 95.7,
                "score": 0.89,
                "isAnomaly": True,
                "threshold": 0.7,
                "timestamp": "2026-01-21T10:30:00Z",
                "metadata": {"deviation": 3.2}
            }
        }


class AnomalyDetectionResponse(BaseModel):
    """Response for anomaly detection"""
    success: bool
    totalAnalyzed: int
    anomaliesDetected: int
    results: List[AnomalyResult]
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "totalAnalyzed": 150,
                "anomaliesDetected": 3,
                "results": [],
                "metadata": {"model": "IsolationForest", "threshold": 0.7}
            }
        }


class MetricData(BaseModel):
    """Metric data point"""
    timestamp: datetime
    value: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2026-01-21T10:30:00Z",
                "value": 65.4
            }
        }


class AssetMetricsResponse(BaseModel):
    """Response with asset metrics"""
    assetId: int
    assetName: str
    metricName: str
    unit: str
    data: List[MetricData]
    statistics: Optional[Dict[str, float]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": 1,
                "assetName": "Core-Router-01",
                "metricName": "cpu_usage",
                "unit": "%",
                "data": [],
                "statistics": {"mean": 55.2, "std": 12.3, "min": 23.1, "max": 89.4}
            }
        }


class ModelInfo(BaseModel):
    """ML model information"""
    modelType: str
    modelVersion: str
    trainingDate: datetime
    status: str
    metrics: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None


class ModelsListResponse(BaseModel):
    """Response with list of available models"""
    success: bool
    models: List[ModelInfo]
    totalModels: int


class TrainModelResponse(BaseModel):
    """Response after training a model"""
    success: bool
    message: str
    modelType: str
    modelVersion: str
    trainingMetrics: Optional[Dict[str, Any]] = None
    trainingSamples: int
    trainingDuration: float = Field(..., description="Training duration in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Model trained successfully",
                "modelType": "anomaly_detection",
                "modelVersion": "1.0.0",
                "trainingMetrics": {"accuracy": 0.95, "f1_score": 0.92},
                "trainingSamples": 5000,
                "trainingDuration": 45.2
            }
        }


class ErrorResponse(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "Invalid request",
                "detail": "Asset ID not found",
                "timestamp": "2026-01-21T10:30:00Z"
            }
        }


# Statistics Schemas

class MetricStatistics(BaseModel):
    """Statistical summary of metrics"""
    mean: float
    median: float
    std: float
    min: float
    max: float
    q25: float = Field(..., description="25th percentile")
    q75: float = Field(..., description="75th percentile")
    count: int


class AssetHealthScore(BaseModel):
    """Asset health score"""
    assetId: int
    assetName: str
    healthScore: float = Field(..., ge=0, le=100, description="Health score 0-100")
    status: str = Field(..., description="Health status: healthy, warning, critical")
    factors: Dict[str, float] = Field(..., description="Contributing factors")
    lastUpdated: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "assetId": 1,
                "assetName": "Core-Router-01",
                "healthScore": 87.5,
                "status": "healthy",
                "factors": {
                    "cpu_usage": 0.9,
                    "memory_usage": 0.85,
                    "uptime": 1.0
                },
                "lastUpdated": "2026-01-21T10:30:00Z"
            }
        }
