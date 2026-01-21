"""
Anomaly Detection Service using Isolation Forest and Statistical Methods
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import logging
from pathlib import Path

from app.config import settings
from app.services.data_processor import DataProcessor
from app.services.ems_client import ems_client

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Anomaly detection using Isolation Forest and statistical methods"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.contamination = settings.ANOMALY_CONTAMINATION
        self.threshold = settings.ANOMALY_THRESHOLD
        self.model_path = Path("app/ml/models")
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.data_processor = DataProcessor()
        
        # Try to load existing model
        self.load_model()
    
    def train(
        self,
        training_data: np.ndarray,
        contamination: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Train the Isolation Forest model
        
        Args:
            training_data: Training data array (n_samples, n_features)
            contamination: Proportion of outliers in the data
        
        Returns:
            Training metrics dictionary
        """
        try:
            if contamination is None:
                contamination = self.contamination
            
            logger.info(f"Training anomaly detection model with {len(training_data)} samples")
            
            # Scale the data
            scaled_data = self.scaler.fit_transform(training_data)
            
            # Train Isolation Forest
            self.model = IsolationForest(
                contamination=contamination,
                n_estimators=100,
                max_samples='auto',
                random_state=42,
                n_jobs=-1
            )
            
            self.model.fit(scaled_data)
            self.is_trained = True
            
            # Calculate training metrics
            scores = self.model.score_samples(scaled_data)
            predictions = self.model.predict(scaled_data)
            
            metrics = {
                "samples_trained": len(training_data),
                "contamination": contamination,
                "mean_score": float(np.mean(scores)),
                "std_score": float(np.std(scores)),
                "anomalies_detected": int(np.sum(predictions == -1)),
                "normal_detected": int(np.sum(predictions == 1))
            }
            
            # Save the model
            self.save_model()
            
            logger.info(f"Model trained successfully: {metrics}")
            return metrics
        
        except Exception as e:
            logger.error(f"Failed to train model: {e}")
            raise
    
    def predict(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict anomalies in data
        
        Args:
            data: Input data array (n_samples, n_features)
        
        Returns:
            Tuple of (anomaly_scores, is_anomaly)
            - anomaly_scores: Anomaly scores (0-1, higher = more anomalous)
            - is_anomaly: Boolean array indicating anomalies
        """
        if not self.is_trained:
            raise ValueError("Model is not trained. Call train() first.")
        
        try:
            # Scale the data
            scaled_data = self.scaler.transform(data)
            
            # Get anomaly scores (negative of decision function, normalized to 0-1)
            raw_scores = self.model.score_samples(scaled_data)
            
            # Normalize scores to 0-1 range (higher = more anomalous)
            # Isolation Forest scores are negative, so we invert them
            min_score = np.min(raw_scores)
            max_score = np.max(raw_scores)
            
            if max_score - min_score == 0:
                anomaly_scores = np.zeros_like(raw_scores)
            else:
                # Invert and normalize: lower raw score = higher anomaly score
                anomaly_scores = 1 - (raw_scores - min_score) / (max_score - min_score)
            
            # Determine if anomaly based on threshold
            is_anomaly = anomaly_scores > self.threshold
            
            return anomaly_scores, is_anomaly
        
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def detect_statistical_anomalies(
        self,
        data: np.ndarray,
        method: str = "zscore",
        threshold: float = 3.0
    ) -> np.ndarray:
        """
        Detect anomalies using statistical methods
        
        Args:
            data: Input data array
            method: Detection method ('zscore', 'iqr', 'mad')
            threshold: Threshold for anomaly detection
        
        Returns:
            Boolean array indicating anomalies
        """
        if len(data) < 3:
            return np.zeros(len(data), dtype=bool)
        
        if method == "zscore":
            # Z-score method
            mean = np.mean(data)
            std = np.std(data)
            if std == 0:
                return np.zeros(len(data), dtype=bool)
            z_scores = np.abs((data - mean) / std)
            return z_scores > threshold
        
        elif method == "iqr":
            # IQR method
            return self.data_processor.detect_outliers_iqr(data, multiplier=threshold)
        
        elif method == "mad":
            # Median Absolute Deviation method
            median = np.median(data)
            mad = np.median(np.abs(data - median))
            if mad == 0:
                return np.zeros(len(data), dtype=bool)
            modified_z_scores = 0.6745 * (data - median) / mad
            return np.abs(modified_z_scores) > threshold
        
        else:
            raise ValueError(f"Unknown method: {method}")
    
    async def analyze_asset_metrics(
        self,
        asset_id: int,
        metric_names: Optional[List[str]] = None,
        time_range: int = 3600,
        use_ml: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Analyze metrics for a specific asset
        
        Args:
            asset_id: Asset ID to analyze
            metric_names: List of metric names (if None, analyze all)
            time_range: Time range in seconds to analyze
            use_ml: Whether to use ML model (if False, use statistical method)
        
        Returns:
            List of anomaly results
        """
        try:
            # Get asset information
            asset = await ems_client.get_asset_by_id(asset_id)
            if not asset:
                logger.warning(f"Asset {asset_id} not found")
                return []
            
            # Calculate time range
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(seconds=time_range)
            
            # Get metrics
            metrics = await ems_client.get_metrics(
                asset_id=asset_id,
                start_time=start_time,
                end_time=end_time,
                limit=10000
            )
            
            if not metrics:
                logger.info(f"No metrics found for asset {asset_id}")
                return []
            
            # Convert to DataFrame
            df = self.data_processor.metrics_to_dataframe(metrics)
            
            # Filter by metric names if provided
            if metric_names:
                df = df[df['metricName'].isin(metric_names)]
            
            if df.empty:
                return []
            
            # Analyze each metric separately
            results = []
            
            for metric_name in df['metricName'].unique():
                metric_df = df[df['metricName'] == metric_name].copy()
                
                if len(metric_df) < 10:  # Need minimum samples
                    continue
                
                # Extract values
                values = metric_df['value'].values
                
                # Detect anomalies
                if use_ml and self.is_trained:
                    # Use ML model
                    # Prepare features (we'll use value and rolling statistics)
                    features = self._prepare_features(values)
                    
                    if features is not None:
                        scores, is_anomaly = self.predict(features)
                        
                        # Only report actual anomalies
                        for idx in np.where(is_anomaly)[0]:
                            if idx < len(metric_df):
                                row = metric_df.iloc[idx]
                                results.append({
                                    "assetId": asset_id,
                                    "assetName": asset.get("name", "Unknown"),
                                    "metricName": metric_name,
                                    "value": float(row['value']),
                                    "score": float(scores[idx]),
                                    "isAnomaly": True,
                                    "threshold": self.threshold,
                                    "timestamp": row['timestamp'].isoformat() if isinstance(row['timestamp'], datetime) else row['timestamp'],
                                    "method": "ml",
                                    "metadata": {
                                        "model": "IsolationForest",
                                        "deviation": float(scores[idx] - self.threshold)
                                    }
                                })
                
                else:
                    # Use statistical method
                    is_anomaly = self.detect_statistical_anomalies(values, method="zscore")
                    
                    for idx in np.where(is_anomaly)[0]:
                        if idx < len(metric_df):
                            row = metric_df.iloc[idx]
                            
                            # Calculate z-score as anomaly score
                            mean = np.mean(values)
                            std = np.std(values)
                            if std > 0:
                                z_score = abs((row['value'] - mean) / std)
                                score = min(z_score / 5.0, 1.0)  # Normalize to 0-1
                            else:
                                score = 0.0
                            
                            results.append({
                                "assetId": asset_id,
                                "assetName": asset.get("name", "Unknown"),
                                "metricName": metric_name,
                                "value": float(row['value']),
                                "score": float(score),
                                "isAnomaly": True,
                                "threshold": self.threshold,
                                "timestamp": row['timestamp'].isoformat() if isinstance(row['timestamp'], datetime) else row['timestamp'],
                                "method": "statistical",
                                "metadata": {
                                    "method": "zscore",
                                    "deviation": float(score)
                                }
                            })
            
            logger.info(f"Found {len(results)} anomalies for asset {asset_id}")
            return results
        
        except Exception as e:
            logger.error(f"Failed to analyze metrics for asset {asset_id}: {e}")
            return []
    
    def _prepare_features(self, values: np.ndarray) -> Optional[np.ndarray]:
        """
        Prepare features for ML model
        
        Args:
            values: Raw metric values
        
        Returns:
            Feature array or None if not enough data
        """
        if len(values) < 10:
            return None
        
        features = []
        
        for i in range(len(values)):
            feature_vector = [values[i]]
            
            # Add rolling statistics (if enough history)
            if i >= 5:
                recent = values[max(0, i-5):i+1]
                feature_vector.extend([
                    np.mean(recent),
                    np.std(recent),
                    np.min(recent),
                    np.max(recent)
                ])
            else:
                feature_vector.extend([values[i]] * 4)
            
            # Add lag features
            if i >= 1:
                feature_vector.append(values[i-1])
            else:
                feature_vector.append(values[i])
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def save_model(self) -> bool:
        """Save the trained model to disk"""
        try:
            if not self.is_trained:
                logger.warning("No trained model to save")
                return False
            
            model_file = self.model_path / "anomaly_detection_model.pkl"
            scaler_file = self.model_path / "anomaly_detection_scaler.pkl"
            
            joblib.dump(self.model, model_file)
            joblib.dump(self.scaler, scaler_file)
            
            logger.info(f"Model saved to {model_file}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            return False
    
    def load_model(self) -> bool:
        """Load a trained model from disk"""
        try:
            model_file = self.model_path / "anomaly_detection_model.pkl"
            scaler_file = self.model_path / "anomaly_detection_scaler.pkl"
            
            if not model_file.exists() or not scaler_file.exists():
                logger.info("No saved model found")
                return False
            
            self.model = joblib.load(model_file)
            self.scaler = joblib.load(scaler_file)
            self.is_trained = True
            
            logger.info(f"Model loaded from {model_file}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False


# Global detector instance
anomaly_detector = AnomalyDetector()
