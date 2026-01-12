import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any, Optional
import logging
from scipy import stats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MultiMetricDetector:
    """
    Detects anomalies across multiple metrics simultaneously.
    """
    
    def __init__(self, contamination: float = 0.1):
        """
        Initialize multi-metric detector.
        
        Args:
            contamination: Expected proportion of anomalies
        """
        self.contamination = contamination
        self.model = None
        self.is_trained = False
        self.metric_names = []
        self.training_stats = {}
    
    def train(self, metrics_data: Dict[str, List[float]]) -> Dict[str, Any]:
        """
        Train on multiple metrics simultaneously.
        
        Args:
            metrics_data: Dict of {metric_name: [values]}
            
        Returns:
            Training result
        """
        if not metrics_data:
            return {
                "success": False,
                "error": "No metrics data provided"
            }
        
        # Validate all metrics have same length
        lengths = [len(values) for values in metrics_data.values()]
        if len(set(lengths)) > 1:
            return {
                "success": False,
                "error": "All metrics must have same number of data points"
            }
        
        if lengths[0] < 10:
            return {
                "success": False,
                "error": "Need at least 10 data points per metric"
            }
        
        try:
            # Store metric names
            self.metric_names = list(metrics_data.keys())
            
            # Convert to numpy array (rows = samples, cols = metrics)
            data_matrix = np.column_stack([metrics_data[name] for name in self.metric_names])
            
            # Train multivariate model
            self.model = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100
            )
            self.model.fit(data_matrix)
            self.is_trained = True
            
            # Calculate statistics for each metric
            for name in self.metric_names:
                values = np.array(metrics_data[name])
                self.training_stats[name] = {
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)),
                    "min": float(np.min(values)),
                    "max": float(np.max(values))
                }
            
            logger.info(f"Multi-metric model trained on {len(self.metric_names)} metrics")
            
            return {
                "success": True,
                "metrics": self.metric_names,
                "data_points": lengths[0],
                "statistics": self.training_stats
            }
            
        except Exception as e:
            logger.error(f"Training error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def detect(self, metric_values: Dict[str, float]) -> Dict[str, Any]:
        """
        Detect anomalies across multiple metrics.
        
        Args:
            metric_values: Dict of {metric_name: current_value}
            
        Returns:
            Detection result
        """
        if not self.is_trained:
            return {
                "is_anomaly": False,
                "reason": "Model not trained"
            }
        
        # Validate metrics match training
        if set(metric_values.keys()) != set(self.metric_names):
            return {
                "is_anomaly": False,
                "reason": f"Expected metrics: {self.metric_names}"
            }
        
        try:
            # Create data point in same order as training
            data_point = np.array([[metric_values[name] for name in self.metric_names]])
            
            # Get anomaly score
            score = self.model.score_samples(data_point)[0]
            prediction = self.model.predict(data_point)[0]
            
            is_anomaly = prediction == -1
            confidence = min(abs(score) / 2.0, 1.0)
            
            # Analyze which metrics are anomalous individually
            anomalous_metrics = []
            for name in self.metric_names:
                value = metric_values[name]
                stats = self.training_stats[name]
                
                # Check if value is outside 3 standard deviations
                z_score = abs((value - stats["mean"]) / stats["std"]) if stats["std"] > 0 else 0
                
                if z_score > 3:
                    anomalous_metrics.append({
                        "metric": name,
                        "value": value,
                        "z_score": float(z_score),
                        "expected_range": f"{stats['mean'] - 3*stats['std']:.2f} - {stats['mean'] + 3*stats['std']:.2f}"
                    })
            
            return {
                "is_anomaly": bool(is_anomaly),
                "score": float(score),
                "confidence": float(confidence),
                "anomalous_metrics": anomalous_metrics,
                "reason": "Multivariate anomaly detected" if is_anomaly else "Within normal pattern"
            }
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return {
                "is_anomaly": False,
                "reason": f"Error: {str(e)}"
            }
    
    def analyze_correlations(self, metrics_data: Dict[str, List[float]]) -> Dict[str, Any]:
        """
        Analyze correlations between metrics.
        
        Args:
            metrics_data: Dict of {metric_name: [values]}
            
        Returns:
            Correlation analysis
        """
        if len(metrics_data) < 2:
            return {
                "correlations": [],
                "message": "Need at least 2 metrics for correlation analysis"
            }
        
        try:
            metric_names = list(metrics_data.keys())
            correlations = []
            
            # Calculate pairwise correlations
            for i, name1 in enumerate(metric_names):
                for name2 in metric_names[i+1:]:
                    values1 = np.array(metrics_data[name1])
                    values2 = np.array(metrics_data[name2])
                    
                    # Pearson correlation
                    corr_coef, p_value = stats.pearsonr(values1, values2)
                    
                    correlations.append({
                        "metric1": name1,
                        "metric2": name2,
                        "correlation": float(corr_coef),
                        "p_value": float(p_value),
                        "strength": self._correlation_strength(corr_coef),
                        "direction": "positive" if corr_coef > 0 else "negative"
                    })
            
            # Sort by absolute correlation
            correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)
            
            return {
                "correlations": correlations,
                "total_pairs": len(correlations)
            }
            
        except Exception as e:
            logger.error(f"Correlation analysis error: {e}")
            return {
                "correlations": [],
                "error": str(e)
            }
    
    def calculate_composite_health(self, metric_values: Dict[str, float]) -> Dict[str, Any]:
        """
        Calculate overall system health score.
        
        Args:
            metric_values: Dict of {metric_name: current_value}
            
        Returns:
            Composite health score
        """
        if not self.is_trained:
            return {
                "health_score": 0,
                "status": "unknown",
                "reason": "Model not trained"
            }
        
        try:
            # Get anomaly detection result
            detection = self.detect(metric_values)
            
            # Start with base score
            health_score = 100
            
            # Reduce score for anomalies
            if detection["is_anomaly"]:
                health_score -= 30
            
            # Reduce score for each anomalous individual metric
            anomalous_count = len(detection.get("anomalous_metrics", []))
            health_score -= (anomalous_count * 15)
            
            # Ensure score stays in 0-100 range
            health_score = max(0, min(100, health_score))
            
            # Determine status
            if health_score >= 80:
                status = "healthy"
            elif health_score >= 60:
                status = "warning"
            elif health_score >= 40:
                status = "degraded"
            else:
                status = "critical"
            
            return {
                "health_score": health_score,
                "status": status,
                "is_anomaly": detection["is_anomaly"],
                "anomalous_metrics_count": anomalous_count,
                "confidence": detection["confidence"]
            }
            
        except Exception as e:
            logger.error(f"Health calculation error: {e}")
            return {
                "health_score": 0,
                "status": "error",
                "reason": str(e)
            }
    
    def _correlation_strength(self, correlation: float) -> str:
        """
        Classify correlation strength.
        
        Args:
            correlation: Correlation coefficient
            
        Returns:
            Strength classification
        """
        abs_corr = abs(correlation)
        
        if abs_corr >= 0.7:
            return "strong"
        elif abs_corr >= 0.4:
            return "moderate"
        elif abs_corr >= 0.2:
            return "weak"
        else:
            return "negligible"