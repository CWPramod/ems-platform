from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.multi_metric_detector import MultiMetricDetector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml/multi-metric", tags=["Multi-Metric Detection"])

# Global multi-metric detector
multi_metric_detector = MultiMetricDetector(contamination=0.1)

# Request/Response Models
class TrainMultiMetricRequest(BaseModel):
    metrics_data: Dict[str, List[float]]

class DetectMultiMetricRequest(BaseModel):
    metric_values: Dict[str, float]

class CorrelationAnalysisRequest(BaseModel):
    metrics_data: Dict[str, List[float]]

class CompositeHealthRequest(BaseModel):
    metric_values: Dict[str, float]

# Endpoints
@router.post("/train")
async def train_multi_metric(request: TrainMultiMetricRequest):
    """
    Train multivariate anomaly detector on multiple metrics.
    """
    try:
        result = multi_metric_detector.train(request.metrics_data)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Training failed")
            )
        
        logger.info(f"Trained on {len(result['metrics'])} metrics")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect")
async def detect_multi_metric(request: DetectMultiMetricRequest):
    """
    Detect anomalies across multiple metrics simultaneously.
    """
    try:
        if not multi_metric_detector.is_trained:
            raise HTTPException(
                status_code=400,
                detail="Model not trained. Call /train first."
            )
        
        result = multi_metric_detector.detect(request.metric_values)
        
        return {
            "metric_values": request.metric_values,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-correlations")
async def analyze_correlations(request: CorrelationAnalysisRequest):
    """
    Analyze correlations between multiple metrics.
    """
    try:
        result = multi_metric_detector.analyze_correlations(request.metrics_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Correlation analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/composite-health")
async def calculate_composite_health(request: CompositeHealthRequest):
    """
    Calculate composite health score across all metrics.
    """
    try:
        if not multi_metric_detector.is_trained:
            raise HTTPException(
                status_code=400,
                detail="Model not trained. Call /train first."
            )
        
        result = multi_metric_detector.calculate_composite_health(request.metric_values)
        
        return {
            "metric_values": request.metric_values,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_multi_metric_status():
    """
    Get status of multi-metric detector.
    """
    return {
        "is_trained": multi_metric_detector.is_trained,
        "metrics": multi_metric_detector.metric_names,
        "training_statistics": multi_metric_detector.training_stats,
        "contamination": multi_metric_detector.contamination
    }