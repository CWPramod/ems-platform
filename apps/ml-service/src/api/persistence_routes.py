from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.persistent_anomaly_detector import PersistentAnomalyDetector
from services.model_storage import model_storage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml/models", tags=["Model Persistence"])

# Global persistent detector
persistent_detector = PersistentAnomalyDetector(model_name="cpu_anomaly_detector")

# Request/Response Models
class TrainPersistentRequest(BaseModel):
    data: List[float]
    model_name: Optional[str] = "cpu_anomaly_detector"
    auto_save: bool = True

class DetectWithPersistentRequest(BaseModel):
    value: float
    model_name: Optional[str] = "cpu_anomaly_detector"

# Endpoints
@router.post("/train-persistent")
async def train_persistent_model(request: TrainPersistentRequest):
    """
    Train a model and automatically save it to disk.
    """
    try:
        # Create or get detector
        detector = PersistentAnomalyDetector(model_name=request.model_name)
        
        # Train
        result = detector.train(request.data, auto_save=request.auto_save)
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error'))
        
        logger.info(f"Trained and saved model: {request.model_name}")
        
        return {
            "status": "success",
            "model_name": request.model_name,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-persistent")
async def detect_with_persistent(request: DetectWithPersistentRequest):
    """
    Detect anomaly using a saved model.
    """
    try:
        # Load detector
        detector = PersistentAnomalyDetector(model_name=request.model_name)
        
        if not detector.is_trained:
            raise HTTPException(
                status_code=404,
                detail=f"No trained model found for '{request.model_name}'"
            )
        
        # Detect
        result = detector.detect(request.value)
        
        return {
            "model_name": request.model_name,
            "value": request.value,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_models():
    """
    List all saved models.
    """
    try:
        models = model_storage.list_models()
        
        return {
            "total_models": len(models),
            "models": models
        }
        
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/info/{model_name}")
async def get_model_info(model_name: str):
    """
    Get information about a specific model.
    """
    try:
        # Load metadata
        metadata = model_storage.load_metadata(model_name, version='latest')
        
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail=f"No model found: {model_name}"
            )
        
        return {
            "model_name": model_name,
            "metadata": metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete/{model_name}/{version}")
async def delete_model(model_name: str, version: str):
    """
    Delete a specific model version.
    """
    try:
        success = model_storage.delete_model(model_name, version)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Model not found: {model_name}_{version}"
            )
        
        return {
            "status": "deleted",
            "model_name": model_name,
            "version": version
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/storage-stats")
async def get_storage_stats():
    """
    Get statistics about model storage.
    """
    try:
        models = model_storage.list_models()
        
        total_size = sum(m.get('size_bytes', 0) for m in models)
        
        return {
            "total_models": len(models),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "storage_directory": model_storage.models_dir
        }
        
    except Exception as e:
        logger.error(f"Error getting storage stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))