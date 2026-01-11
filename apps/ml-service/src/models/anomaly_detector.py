import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnomalyDetector:
    """
    Detects anomalies in time-series metric data using Isolation Forest.
    """
    
    def __init__(self, contamination: float = 0.1):
        """
        Initialize the anomaly detector.
        
        Args:
            contamination: Expected proportion of anomalies (0.1 = 10%)
        """
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        self.is_trained = False
        self.threshold = -0.5  # Anomaly score threshold
        
    def train(self, data: List[float]) -> None:
        """
        Train the model on historical metric data.
        
        Args:
            data: List of metric values
        """
        if len(data) < 10:
            logger.warning("Insufficient data for training. Need at least 10 points.")
            return
            
        # Reshape for sklearn (needs 2D array)
        X = np.array(data).reshape(-1, 1)
        
        # Train the model
        self.model.fit(X)
        self.is_trained = True
        logger.info(f"Model trained on {len(data)} data points")
        
    def detect(self, value: float) -> Dict[str, Any]:
        """
        Detect if a single value is anomalous.
        
        Args:
            value: Metric value to check
            
        Returns:
            Dict with is_anomaly flag, score, and confidence
        """
        if not self.is_trained:
            return {
                "is_anomaly": False,
                "score": 0.0,
                "confidence": 0.0,
                "reason": "Model not trained"
            }
        
        # Reshape for prediction
        X = np.array([[value]])
        
        # Get anomaly score (negative = anomaly, positive = normal)
        score = self.model.score_samples(X)[0]
        prediction = self.model.predict(X)[0]
        
        # Calculate confidence (0-1 scale)
        confidence = abs(score) / 2.0  # Normalize to 0-1
        confidence = min(max(confidence, 0.0), 1.0)
        
        is_anomaly = prediction == -1
        
        return {
            "is_anomaly": bool(is_anomaly),
            "score": float(score),
            "confidence": float(confidence),
            "reason": "Value deviates from normal pattern" if is_anomaly else "Within normal range"
        }
    
    def detect_batch(self, values: List[float]) -> List[Dict[str, Any]]:
        """
        Detect anomalies in a batch of values.
        
        Args:
            values: List of metric values
            
        Returns:
            List of detection results
        """
        return [self.detect(v) for v in values]
    
    def get_statistics(self, data: List[float]) -> Dict[str, float]:
        """
        Calculate statistics for metric data.
        
        Args:
            data: List of metric values
            
        Returns:
            Dict with mean, std, min, max, median
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