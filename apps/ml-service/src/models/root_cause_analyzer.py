import numpy as np
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RootCauseAnalyzer:
    """
    Analyzes events and metrics to predict root cause assets.
    Uses correlation analysis and temporal patterns.
    """
    
    def __init__(self):
        self.asset_scores = {}
        self.event_history = []
        
    def analyze(
        self,
        event: Dict[str, Any],
        related_events: List[Dict[str, Any]],
        asset_metrics: Dict[str, List[float]]
    ) -> Dict[str, Any]:
        """
        Analyze an event to determine the root cause asset.
        
        Args:
            event: The current event to analyze
            related_events: List of correlated events
            asset_metrics: Dict of assetId -> recent metric values
            
        Returns:
            Analysis result with root cause prediction
        """
        logger.info(f"Analyzing event: {event.get('id', 'unknown')}")
        
        # Score each asset
        asset_scores = {}
        
        # 1. Score based on direct involvement
        if event.get('assetId'):
            asset_scores[event['assetId']] = 0.5
        
        # 2. Score based on related events
        for related in related_events:
            asset_id = related.get('assetId')
            if asset_id:
                asset_scores[asset_id] = asset_scores.get(asset_id, 0) + 0.2
        
        # 3. Score based on metric anomalies
        for asset_id, metrics in asset_metrics.items():
            if metrics and len(metrics) > 0:
                # Check if metrics show anomalies
                recent_values = metrics[-5:]  # Last 5 values
                if self._has_spike(recent_values):
                    asset_scores[asset_id] = asset_scores.get(asset_id, 0) + 0.3
        
        # 4. Normalize scores to 0-1 range
        if asset_scores:
            max_score = max(asset_scores.values())
            if max_score > 0:
                for asset_id in asset_scores:
                    asset_scores[asset_id] = min(asset_scores[asset_id] / max_score, 1.0)
        
        # Find root cause (highest score)
        root_cause_asset_id = None
        confidence = 0.0
        
        if asset_scores:
            root_cause_asset_id = max(asset_scores, key=asset_scores.get)
            confidence = asset_scores[root_cause_asset_id]
        
        return {
            "root_cause_asset_id": root_cause_asset_id,
            "confidence": confidence,
            "asset_scores": asset_scores,
            "correlated_events_count": len(related_events),
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
    
    def _has_spike(self, values: List[float]) -> bool:
        """
        Check if values show a spike pattern.
        
        Args:
            values: List of metric values
            
        Returns:
            True if spike detected
        """
        if len(values) < 3:
            return False
        
        arr = np.array(values)
        mean = np.mean(arr)
        std = np.std(arr)
        
        # Check if last value is > 2 standard deviations from mean
        if std > 0:
            last_z_score = abs((arr[-1] - mean) / std)
            return last_z_score > 2.0
        
        return False
    
    def calculate_business_impact(
        self,
        event: Dict[str, Any],
        asset_tier: int,
        related_events_count: int
    ) -> Dict[str, Any]:
        """
        Calculate business impact score for an event.
        
        Args:
            event: Event to analyze
            asset_tier: Tier of the affected asset (1=critical, 2=important, 3=standard)
            related_events_count: Number of correlated events
            
        Returns:
            Business impact analysis
        """
        severity = event.get('severity', 'info')
        
        # Base score from severity
        severity_scores = {
            'critical': 50,
            'warning': 30,
            'info': 10
        }
        base_score = severity_scores.get(severity, 10)
        
        # Asset tier multiplier
        tier_multipliers = {
            1: 2.0,   # Critical assets
            2: 1.5,   # Important assets
            3: 1.0    # Standard assets
        }
        tier_multiplier = tier_multipliers.get(asset_tier, 1.0)
        
        # Correlation multiplier (more related events = higher impact)
        correlation_multiplier = 1.0 + (related_events_count * 0.1)
        
        # Calculate final score (0-100 scale)
        impact_score = min(base_score * tier_multiplier * correlation_multiplier, 100)
        
        # Estimate affected users (simple model)
        affected_users = int(impact_score * 10)  # Scale to reasonable number
        
        # Estimate revenue at risk (simple model - $100 per user per hour)
        revenue_at_risk = affected_users * 100.0
        
        return {
            "business_impact_score": int(impact_score),
            "affected_users": affected_users,
            "revenue_at_risk": round(revenue_at_risk, 2),
            "impact_level": "high" if impact_score > 70 else "medium" if impact_score > 40 else "low"
        }