"""
API Routes for ML Service
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import text
import logging

from app.database import get_db
from app.models import schemas, database_models
from app.services.anomaly_detection import anomaly_detector
from app.services.ems_client import ems_client
from app.services.data_processor import DataProcessor
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
data_processor = DataProcessor()


@router.get("/health", response_model=schemas.HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Check database
        db_healthy = True
        try:
            db.execute(text("SELECT 1"))
        except:
            db_healthy = False
        
        # Check EMS Core
        ems_healthy = await ems_client.health_check()
        
        # Check loaded models
        models = {
            "anomaly_detection": anomaly_detector.is_trained
        }
        
        status = "healthy" if db_healthy and ems_healthy else "degraded"
        
        return schemas.HealthResponse(
            status=status,
            timestamp=datetime.utcnow(),
            database=db_healthy,
            redis=None,  # TODO: Add Redis check if implemented
            models=models
        )
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anomaly/detect", response_model=schemas.AnomalyDetectionResponse)
async def detect_anomalies(
    request: schemas.AnomalyDetectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Detect anomalies in network metrics
    
    This endpoint analyzes metrics for specified assets and returns detected anomalies.
    If auto_create_alerts is enabled, it will also create events/alerts for anomalies.
    """
    try:
        logger.info(f"Anomaly detection request: {request}")
        
        # Determine which assets to analyze
        if request.assetId:
            asset_ids = [request.assetId]
        else:
            # Get all network assets
            assets = await ems_client.get_assets(status="online")
            asset_ids = [asset["id"] for asset in assets if asset.get("type") in [
                "router", "switch", "firewall", "load_balancer", "network"
            ]]
        
        if not asset_ids:
            return schemas.AnomalyDetectionResponse(
                success=True,
                totalAnalyzed=0,
                anomaliesDetected=0,
                results=[],
                metadata={"message": "No assets found to analyze"}
            )
        
        # Analyze each asset
        all_results = []
        
        for asset_id in asset_ids:
            results = await anomaly_detector.analyze_asset_metrics(
                asset_id=asset_id,
                metric_names=request.metricNames,
                time_range=request.timeRange,
                use_ml=anomaly_detector.is_trained
            )
            all_results.extend(results)
        
        # Auto-create events for anomalies (in background)
        if settings.AUTO_CREATE_ALERTS and all_results:
            background_tasks.add_task(create_anomaly_events, all_results)
        
        # Store anomaly scores in database
        background_tasks.add_task(store_anomaly_scores, all_results, db)
        
        # Convert to response schema
        anomaly_results = [
            schemas.AnomalyResult(**result) for result in all_results
        ]
        
        return schemas.AnomalyDetectionResponse(
            success=True,
            totalAnalyzed=len(asset_ids),
            anomaliesDetected=len(all_results),
            results=anomaly_results,
            metadata={
                "threshold": request.threshold,
                "time_range_seconds": request.timeRange,
                "model_type": "ml" if anomaly_detector.is_trained else "statistical"
            }
        )
    
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anomaly/train", response_model=schemas.TrainModelResponse)
async def train_anomaly_model(
    request: schemas.TrainModelRequest,
    db: Session = Depends(get_db)
):
    """
    Train the anomaly detection model
    
    This endpoint trains a new model using historical metrics data.
    """
    try:
        logger.info(f"Training request: {request}")
        
        start_time = datetime.utcnow()
        
        # Get training data
        end_time = datetime.utcnow()
        train_start_time = end_time - timedelta(seconds=request.timeRange)
        
        # Determine which assets to use for training
        if request.assetIds:
            asset_ids = request.assetIds
        else:
            assets = await ems_client.get_assets()
            asset_ids = [asset["id"] for asset in assets]
        
        # Collect training data
        training_data = []
        
        for asset_id in asset_ids:
            metrics = await ems_client.get_metrics(
                asset_id=asset_id,
                start_time=train_start_time,
                end_time=end_time,
                limit=10000
            )
            
            if metrics:
                df = data_processor.metrics_to_dataframe(metrics)
                
                # Train on all values together (no metricName grouping needed)
                values = df['value'].values

                if len(values) >= 10:
                    # Prepare features
                    features = anomaly_detector._prepare_features(values)
                    if features is not None:
                        training_data.extend(features)

        
        if len(training_data) < settings.MIN_TRAINING_SAMPLES:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient training data. Need at least {settings.MIN_TRAINING_SAMPLES} samples, got {len(training_data)}"
            )
        
        # Train the model
        import numpy as np
        training_array = np.array(training_data)
        
        contamination = request.parameters.get("contamination", settings.ANOMALY_CONTAMINATION) if request.parameters else settings.ANOMALY_CONTAMINATION
        
        training_metrics = anomaly_detector.train(training_array, contamination)
        
        # Calculate training duration
        training_duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Store model metadata
        model_metadata = database_models.ModelMetadata(
            modelType="anomaly_detection",
            modelVersion="1.0.0",
            trainingDate=datetime.utcnow(),
            metrics=training_metrics,
            parameters={"contamination": contamination},
            status="active",
            filePath="app/ml/models/anomaly_detection_model.pkl"
        )
        db.add(model_metadata)
        db.commit()
        
        return schemas.TrainModelResponse(
            success=True,
            message="Model trained successfully",
            modelType="anomaly_detection",
            modelVersion="1.0.0",
            trainingMetrics=training_metrics,
            trainingSamples=len(training_data),
            trainingDuration=training_duration
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{asset_id}", response_model=schemas.AssetMetricsResponse)
async def get_asset_metrics(
    asset_id: int,
    metric_name: Optional[str] = None,
    hours: int = 24
):
    """Get metrics for a specific asset with statistics"""
    try:
        # Get asset
        asset = await ems_client.get_asset_by_id(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get metrics
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        metrics = await ems_client.get_metrics(
            asset_id=asset_id,
            metric_name=metric_name,
            start_time=start_time,
            end_time=end_time
        )
        
        if not metrics:
            return schemas.AssetMetricsResponse(
                assetId=asset_id,
                assetName=asset.get("name", "Unknown"),
                metricName=metric_name or "all",
                unit="",
                data=[],
                statistics=None
            )
        
        # Convert to DataFrame and process
        df = data_processor.metrics_to_dataframe(metrics)
        
        if metric_name:
            df = df[df['metricName'] == metric_name]
        
        # Prepare response data
        metric_data = [
            schemas.MetricData(timestamp=row['timestamp'], value=row['value'])
            for _, row in df.iterrows()
        ]
        
        # Calculate statistics
        values = df['value'].values
        statistics = data_processor.calculate_statistics(values) if len(values) > 0 else None
        
        return schemas.AssetMetricsResponse(
            assetId=asset_id,
            assetName=asset.get("name", "Unknown"),
            metricName=metric_name or "all",
            unit=df.iloc[0]['unit'] if not df.empty and 'unit' in df.columns else "",
            data=metric_data,
            statistics=statistics
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=schemas.ModelsListResponse)
async def list_models(db: Session = Depends(get_db)):
    """List all available ML models"""
    try:
        # Get models from database
        models = db.query(database_models.ModelMetadata).filter(
            database_models.ModelMetadata.status == "active"
        ).all()
        
        model_infos = [
            schemas.ModelInfo(
                modelType=model.modelType,
                modelVersion=model.modelVersion,
                trainingDate=model.trainingDate,
                status=model.status,
                metrics=model.metrics,
                parameters=model.parameters
            )
            for model in models
        ]
        
        return schemas.ModelsListResponse(
            success=True,
            models=model_infos,
            totalModels=len(model_infos)
        )
    
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomaly/scores/{asset_id}")
async def get_anomaly_scores(
    asset_id: int,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """Get historical anomaly scores for an asset"""
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        scores = db.query(database_models.AnomalyScore).filter(
            database_models.AnomalyScore.assetId == asset_id,
            database_models.AnomalyScore.timestamp >= cutoff_time
        ).order_by(database_models.AnomalyScore.timestamp.desc()).all()
        
        return {
            "success": True,
            "assetId": asset_id,
            "scores": [
                {
                    "metricName": score.metricName,
                    "score": score.score,
                    "isAnomaly": score.isAnomaly,
                    "threshold": score.threshold,
                    "timestamp": score.timestamp.isoformat()
                }
                for score in scores
            ],
            "total": len(scores)
        }
    
    except Exception as e:
        logger.error(f"Failed to get anomaly scores: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Background task functions

async def create_anomaly_events(results: List[Dict]):
    """Create events for detected anomalies"""
    try:
        for result in results:
            await ems_client.create_event(
                asset_id=result["assetId"],
                event_type="anomaly_detected",
                severity=settings.ANOMALY_ALERT_SEVERITY,
                message=f"Anomaly detected in {result['metricName']}: {result['value']:.2f} (score: {result['score']:.2f})",
                source=settings.ANOMALY_ALERT_SOURCE,
                metadata=result.get("metadata", {})
            )
        
        logger.info(f"Created {len(results)} anomaly events")
    except Exception as e:
        logger.error(f"Failed to create anomaly events: {e}")


async def store_anomaly_scores(results: List[Dict], db: Session):
    """Store anomaly scores in database"""
    try:
        for result in results:
            score_entry = database_models.AnomalyScore(
                assetId=result["assetId"],
                metricName=result["metricName"],
                score=result["score"],
                isAnomaly=result["isAnomaly"],
                threshold=result["threshold"],
                metadata=result.get("metadata"),
                timestamp=datetime.fromisoformat(result["timestamp"]) if isinstance(result["timestamp"], str) else result["timestamp"]
            )
            db.add(score_entry)
        
        db.commit()
        logger.info(f"Stored {len(results)} anomaly scores")
    except Exception as e:
        logger.error(f"Failed to store anomaly scores: {e}")
        db.rollback()
