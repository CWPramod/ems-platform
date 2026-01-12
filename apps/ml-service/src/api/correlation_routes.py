from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.alert_correlator import AlertCorrelator
from services.database import db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml/correlation", tags=["Alert Correlation"])

# Initialize correlator
alert_correlator = AlertCorrelator()

# Request/Response Models
class CorrelationRequest(BaseModel):
    alerts: List[Dict[str, Any]]
    time_window_minutes: int = 30

class SuppressionRequest(BaseModel):
    alerts: List[Dict[str, Any]]
    time_window_minutes: int = 30

class RootCauseIdentificationRequest(BaseModel):
    alerts: List[Dict[str, Any]]

# Endpoints
@router.post("/find-correlations")
async def find_correlations(request: CorrelationRequest):
    """
    Find correlated alerts based on fingerprint, asset, and time proximity.
    """
    try:
        result = alert_correlator.find_correlated_alerts(
            alerts=request.alerts,
            time_window_minutes=request.time_window_minutes
        )
        
        logger.info(f"Found {len(result['correlation_groups'])} correlation groups")
        
        return result
        
    except Exception as e:
        logger.error(f"Correlation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/suggest-suppression")
async def suggest_suppression(request: SuppressionRequest):
    """
    Suggest which alerts to suppress to reduce noise.
    """
    try:
        # First find correlations
        correlation_result = alert_correlator.find_correlated_alerts(
            alerts=request.alerts,
            time_window_minutes=request.time_window_minutes
        )
        
        # Then get suppression suggestions
        suppression = alert_correlator.suggest_suppression(
            alerts=request.alerts,
            correlation_result=correlation_result
        )
        
        logger.info(f"Suggested suppressing {suppression['suppressible_alerts']} alerts")
        
        return {
            "correlation_analysis": correlation_result,
            "suppression_suggestions": suppression
        }
        
    except Exception as e:
        logger.error(f"Suppression suggestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/identify-root-cause")
async def identify_root_cause(request: RootCauseIdentificationRequest):
    """
    Identify which alert is the likely root cause.
    """
    try:
        root_cause = alert_correlator.identify_root_cause_alert(
            alerts=request.alerts
        )
        
        if not root_cause:
            return {
                "root_cause_found": False,
                "message": "No alerts provided or unable to determine root cause"
            }
        
        logger.info(f"Identified root cause: {root_cause['root_cause_alert_id']}")
        
        return {
            "root_cause_found": True,
            **root_cause
        }
        
    except Exception as e:
        logger.error(f"Root cause identification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/correlation-stats")
async def get_correlation_stats():
    """
    Get statistics about alert correlation capabilities.
    """
    return {
        "status": "ready",
        "features": {
            "fingerprint_correlation": True,
            "asset_correlation": True,
            "time_clustering": True,
            "alert_storm_detection": True,
            "suppression_suggestions": True,
            "root_cause_identification": True
        },
        "default_time_window_minutes": 30,
        "correlation_algorithms": [
            "Fingerprint matching (0.9 score)",
            "Asset grouping (0.7 score)",
            "Time proximity (0.6 score)"
        ]
    }