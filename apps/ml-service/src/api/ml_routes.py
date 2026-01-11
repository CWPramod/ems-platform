from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.anomaly_detector import AnomalyDetector
from models.root_cause_analyzer import RootCauseAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml", tags=["Machine Learning"])

# Initialize ML models
anomaly_detector = AnomalyDetector(contamination=0.1)
root_cause_analyzer = RootCauseAnalyzer()

# Request/Response Models
class MetricData(BaseModel):
    values: List[float]

class AnomalyDetectionRequest(BaseModel):
    value: float
    historical_data: Optional[List[float]] = None

class RootCauseRequest(BaseModel):
    event: Dict[str, Any]
    related_events: List[Dict[str, Any]] = []
    asset_metrics: Dict[str, List[float]] = {}

class BusinessImpactRequest(BaseModel):
    event: Dict[str, Any]
    asset_tier: int = 3
    related_events_count: int = 0

# Endpoints
@router.post("/train-anomaly-detector")
async def train_anomaly_detector(data: MetricData):
    """
    Train the anomaly detection model with historical data.
    """
    try:
        if len(data.values) < 10:
            raise HTTPException(
                status_code=400,
                detail="Need at least 10 data points for training"
            )
        
        anomaly_detector.train(data.values)
        stats = anomaly_detector.get_statistics(data.values)
        
        return {
            "status": "trained",
            "data_points": len(data.values),
            "statistics": stats
        }
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-anomaly")
async def detect_anomaly(request: AnomalyDetectionRequest):
    """
    Detect if a metric value is anomalous.
    """
    try:
        # Train if historical data provided
        if request.historical_data and len(request.historical_data) >= 10:
            anomaly_detector.train(request.historical_data)
        
        # Detect anomaly
        result = anomaly_detector.detect(request.value)
        
        return {
            "value": request.value,
            **result
        }
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-root-cause")
async def analyze_root_cause(request: RootCauseRequest):
    """
    Analyze event to determine root cause asset.
    """
    try:
        result = root_cause_analyzer.analyze(
            event=request.event,
            related_events=request.related_events,
            asset_metrics=request.asset_metrics
        )
        
        return result
    except Exception as e:
        logger.error(f"Root cause analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calculate-business-impact")
async def calculate_business_impact(request: BusinessImpactRequest):
    """
    Calculate business impact score for an event.
    """
    try:
        result = root_cause_analyzer.calculate_business_impact(
            event=request.event,
            asset_tier=request.asset_tier,
            related_events_count=request.related_events_count
        )
        
        return result
    except Exception as e:
        logger.error(f"Business impact calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-status")
async def get_model_status():
    """
    Get status of ML models.
    """
    return {
        "anomaly_detector": {
            "is_trained": anomaly_detector.is_trained,
            "contamination": 0.1,
            "algorithm": "Isolation Forest"
        },
        "root_cause_analyzer": {
            "status": "ready",
            "algorithm": "Correlation Analysis"
        }
    }