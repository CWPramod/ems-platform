import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any, Optional
import logging
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.model_storage import model_storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PersistentAnomalyDetector:
    """
    Anomaly detector with automatic model persistence.
    """
    
    def __init__(self, model_name: str = "anomaly_detector", contamination: float = 0.1):
        """
        Initialize detector with persistence.
        
        Args:
            model_name: Name for saving/loading the model
            contamination: Expected proportion of anomalies
        """
        self.model_name = model_name
        self.contamination = contamination
        self.model = None
        self.is_trained = False
        self.threshold = -0.5
        self.training_data_stats = {}
        
        # Try to load existing model
        self._load_model()
    
    def _load_model(self) -> bool:
        """
        Try to load a previously saved model.
        
        Returns:
            True if model loaded successfully
        """
        try:
            loaded_model = model_storage.load_model(self.model_name, version='latest')
            
            if loaded_model:
                self.model = loaded_model
                self.is_trained = True
                
                # Load metadata
                metadata = model_storage.load_metadata(self.model_name, version='latest')
                if metadata:
                    self.training_data_stats = metadata.get('statistics', {})
                    logger.info(f"Loaded model '{self.model_name}' trained on {metadata.get('data_points', 0)} points")
                else:
                    logger.info(f"Loaded model '{self.model_name}' (no metadata)")
                
                return True
            else:
                logger.info(f"No saved model found for '{self.model_name}'")
                return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def train(self, data: List[float], auto_save: bool = True) -> Dict[str, Any]:
        """
        Train the model on data and optionally save it.
        
        Args:
            data: List of metric values
            auto_save: Whether to automatically save the trained model
            
        Returns:
            Training result with statistics
        """
        if len(data) < 10:
            logger.warning("Insufficient data for training. Need at least 10 points.")
            return {
                "success": False,
                "error": "Need at least 10 data points"
            }
        
        try:
            # Reshape for sklearn
            X = np.array(data).reshape(-1, 1)
            
            # Create and train model
            self.model = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100
            )
            self.model.fit(X)
            self.is_trained = True
            
            # Calculate statistics
            self.training_data_stats = self.get_statistics(data)
            
            logger.info(f"Model trained on {len(data)} data points")
            
            # Auto-save if enabled
            if auto_save:
                metadata = {
                    "model_type": "IsolationForest",
                    "contamination": self.contamination,
                    "data_points": len(data),
                    "statistics": self.training_data_stats,
                    "n_estimators": 100
                }
                
                model_storage.save_model(
                    model=self.model,
                    model_name=self.model_name,
                    metadata=metadata
                )
            
            return {
                "success": True,
                "data_points": len(data),
                "statistics": self.training_data_stats,
                "model_saved": auto_save
            }
            
        except Exception as e:
            logger.error(f"Training error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def detect(self, value: float) -> Dict[str, Any]:
        """
        Detect if a value is anomalous.
        
        Args:
            value: Metric value to check
            
        Returns:
            Detection result
        """
        if not self.is_trained:
            return {
                "is_anomaly": False,
                "score": 0.0,
                "confidence": 0.0,
                "reason": "Model not trained"
            }
        
        try:
            # Reshape for prediction
            X = np.array([[value]])
            
            # Get anomaly score
            score = self.model.score_samples(X)[0]
            prediction = self.model.predict(X)[0]
            
            # Calculate confidence
            confidence = abs(score) / 2.0
            confidence = min(max(confidence, 0.0), 1.0)
            
            is_anomaly = prediction == -1
            
            return {
                "is_anomaly": bool(is_anomaly),
                "score": float(score),
                "confidence": float(confidence),
                "reason": "Value deviates from normal pattern" if is_anomaly else "Within normal range"
            }
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return {
                "is_anomaly": False,
                "score": 0.0,
                "confidence": 0.0,
                "reason": f"Error: {str(e)}"
            }
    
    def get_statistics(self, data: List[float]) -> Dict[str, float]:
        """
        Calculate statistics for data.
        
        Args:
            data: List of metric values
            
        Returns:
            Statistics dict
        """
        if not data:
            return {
                "mean": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0,
                "median": 0.0
            }
        
        arr = np.array(data)
        return {
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr)),
            "median": float(np.median(arr))
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model.
        
        Returns:
            Model info dict
        """
        return {
            "model_name": self.model_name,
            "is_trained": self.is_trained,
            "training_statistics": self.training_data_stats,
            "contamination": self.contamination
        }