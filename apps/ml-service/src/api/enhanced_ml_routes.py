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
from services.database import db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml/enhanced", tags=["Enhanced ML"])

# Initialize ML models
anomaly_detector = AnomalyDetector(contamination=0.1)
root_cause_analyzer = RootCauseAnalyzer()

# Request/Response Models
class TrainFromDatabaseRequest(BaseModel):
    asset_id: str
    metric_name: str
    lookback_hours: int = 24

class DetectAnomalyFromDBRequest(BaseModel):
    asset_id: str
    metric_name: str
    current_value: float

class AnalyzeAssetHealthRequest(BaseModel):
    asset_id: str

# Endpoints
@router.post("/train-from-database")
async def train_from_database(request: TrainFromDatabaseRequest):
    """
    Train anomaly detector using real data from PostgreSQL.
    """
    try:
        # Fetch historical metrics from database
        metrics = db_service.get_metrics_by_asset(
            asset_id=request.asset_id,
            metric_name=request.metric_name,
            limit=1000
        )
        
        if not metrics:
            raise HTTPException(
                status_code=404,
                detail=f"No metrics found for asset {request.asset_id}"
            )
        
        # Extract values
        values = [float(m['value']) for m in metrics]
        
        if len(values) < 10:
            raise HTTPException(
                status_code=400,
                detail="Need at least 10 data points for training"
            )
        
        # Train the model
        anomaly_detector.train(values)
        stats = anomaly_detector.get_statistics(values)
        
        logger.info(f"Trained model on {len(values)} metrics from database")
        
        return {
            "status": "trained",
            "asset_id": request.asset_id,
            "metric_name": request.metric_name,
            "data_points": len(values),
            "statistics": stats,
            "training_data_range": {
                "oldest": metrics[-1]['timestamp'].isoformat() if metrics else None,
                "newest": metrics[0]['timestamp'].isoformat() if metrics else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-from-database")
async def detect_from_database(request: DetectAnomalyFromDBRequest):
    """
    Detect anomaly after training on historical database data.
    """
    try:
        # Fetch historical metrics
        metrics = db_service.get_metrics_by_asset(
            asset_id=request.asset_id,
            metric_name=request.metric_name,
            limit=100
        )
        
        if not metrics:
            raise HTTPException(
                status_code=404,
                detail="No historical data found"
            )
        
        # Extract values and train
        historical_values = [float(m['value']) for m in metrics]
        
        if len(historical_values) >= 10:
            anomaly_detector.train(historical_values)
        
        # Detect anomaly on current value
        result = anomaly_detector.detect(request.current_value)
        
        return {
            "asset_id": request.asset_id,
            "metric_name": request.metric_name,
            "current_value": request.current_value,
            "historical_data_points": len(historical_values),
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-asset-health")
async def analyze_asset_health(request: AnalyzeAssetHealthRequest):
    """
    Comprehensive health analysis for an asset using all available data.
    """
    try:
        # Get all metrics for this asset
        all_metrics = db_service.get_metrics_by_asset(
            asset_id=request.asset_id,
            limit=200
        )
        
        if not all_metrics:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for asset {request.asset_id}"
            )
        
        # Get recent events
        events = db_service.get_events_by_asset(
            asset_id=request.asset_id,
            limit=50
        )
        
        # Group metrics by name
        metrics_by_name = {}
        for metric in all_metrics:
            name = metric['metricName']
            if name not in metrics_by_name:
                metrics_by_name[name] = []
            metrics_by_name[name].append(float(metric['value']))
        
        # Analyze each metric
        anomalies = {}
        for metric_name, values in metrics_by_name.items():
            if len(values) >= 10:
                # Train on historical data
                temp_detector = AnomalyDetector(contamination=0.1)
                temp_detector.train(values[1:])  # Train on all but latest
                
                # Check if latest value is anomalous
                result = temp_detector.detect(values[0])
                
                if result['is_anomaly']:
                    anomalies[metric_name] = {
                        "latest_value": values[0],
                        "confidence": result['confidence'],
                        "score": result['score']
                    }
        
        # Calculate health score (0-100, 100 = healthy)
        health_score = 100
        if anomalies:
            health_score = max(0, 100 - (len(anomalies) * 20))
        
        # Determine health status
        if health_score >= 80:
            health_status = "healthy"
        elif health_score >= 60:
            health_status = "warning"
        else:
            health_status = "critical"
        
        return {
            "asset_id": request.asset_id,
            "health_score": health_score,
            "health_status": health_status,
            "metrics_analyzed": len(metrics_by_name),
            "anomalies_detected": len(anomalies),
            "anomaly_details": anomalies,
            "recent_events_count": len(events),
            "timestamp": all_metrics[0]['timestamp'].isoformat() if all_metrics else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/database-status")
async def get_database_status():
    """
    Check database connection and get statistics.
    """
    try:
        is_connected = db_service.is_connected()
        
        metrics_count = 0
        
        if is_connected:
            # Get metrics count properly
            metrics = db_service.get_all_metrics(limit=10000)
            metrics_count = len(metrics)
            
            logger.info(f"Found {metrics_count} metrics in database")
        
        return {
            "database_connected": is_connected,
            "metrics_in_database": metrics_count,
            "status": "connected" if is_connected else "disconnected"
        }
        
    except Exception as e:
        logger.error(f"Database status error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "database_connected": False,
            "status": "error",
            "error": str(e)
        }