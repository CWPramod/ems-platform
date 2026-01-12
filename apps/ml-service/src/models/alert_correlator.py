from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
from collections import defaultdict
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AlertCorrelator:
    """
    Analyzes and correlates alerts to reduce noise and identify patterns.
    """
    
    def __init__(self):
        self.correlation_cache = {}
        
    def find_correlated_alerts(
        self,
        alerts: List[Dict[str, Any]],
        time_window_minutes: int = 30
    ) -> Dict[str, Any]:
        """
        Find correlated alerts within a time window.
        
        Args:
            alerts: List of alert dictionaries
            time_window_minutes: Time window for correlation
            
        Returns:
            Correlation analysis results
        """
        logger.info(f"Starting correlation analysis for {len(alerts)} alerts")
        
        if not alerts:
            return {
                "total_alerts": 0,
                "correlation_groups": [],
                "alert_storm_detected": False
            }
        
        # Group by fingerprint (if events have fingerprints)
        fingerprint_groups = defaultdict(list)
        asset_groups = defaultdict(list)
        time_clusters = []
        
        for alert in alerts:
            # Group by event fingerprint
            event = alert.get('event', {})
            fingerprint = event.get('fingerprint')
            if fingerprint:
                fingerprint_groups[fingerprint].append(alert)
            
            # Group by asset
            asset_id = alert.get('rootCauseAssetId') or event.get('assetId')
            if asset_id:
                asset_groups[asset_id].append(alert)
        
        logger.info(f"Found {len(fingerprint_groups)} fingerprint groups")
        logger.info(f"Found {len(asset_groups)} asset groups")
        
        # Find time clusters
        sorted_alerts = sorted(
            alerts, 
            key=lambda a: a.get('createdAt', datetime.utcnow().isoformat())
        )
        
        current_cluster = []
        time_window = timedelta(minutes=time_window_minutes)
        
        for alert in sorted_alerts:
            created_at_str = alert.get('createdAt', datetime.utcnow().isoformat())
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except:
                created_at = datetime.utcnow()
            
            if not current_cluster:
                current_cluster.append(alert)
            else:
                last_alert_time_str = current_cluster[-1].get('createdAt', datetime.utcnow().isoformat())
                try:
                    last_alert_time = datetime.fromisoformat(last_alert_time_str.replace('Z', '+00:00'))
                except:
                    last_alert_time = datetime.utcnow()
                
                if created_at - last_alert_time <= time_window:
                    current_cluster.append(alert)
                else:
                    if len(current_cluster) > 1:
                        time_clusters.append(current_cluster)
                    current_cluster = [alert]
        
        if len(current_cluster) > 1:
            time_clusters.append(current_cluster)
        
        logger.info(f"Found {len(time_clusters)} time clusters")
        
        # Build correlation groups
        correlation_groups = []
        
        # Add fingerprint-based groups
        for fingerprint, group_alerts in fingerprint_groups.items():
            if len(group_alerts) > 1:
                correlation_groups.append({
                    "type": "fingerprint",
                    "key": fingerprint,
                    "alert_count": len(group_alerts),
                    "alert_ids": [a.get('id') for a in group_alerts],
                    "correlation_score": 0.9,
                    "reason": "Same event fingerprint - likely same root cause"
                })
        
        # Add asset-based groups
        for asset_id, group_alerts in asset_groups.items():
            if len(group_alerts) > 1:
                correlation_groups.append({
                    "type": "asset",
                    "key": asset_id,
                    "alert_count": len(group_alerts),
                    "alert_ids": [a.get('id') for a in group_alerts],
                    "correlation_score": 0.7,
                    "reason": "Same asset affected - related infrastructure issue"
                })
        
        # Add time-based clusters
        for cluster in time_clusters:
            correlation_groups.append({
                "type": "time_cluster",
                "key": f"cluster_{len(correlation_groups)}",
                "alert_count": len(cluster),
                "alert_ids": [a.get('id') for a in cluster],
                "correlation_score": 0.6,
                "reason": f"Alerts within {time_window_minutes} minutes - possible cascading failure"
            })
        
        # Detect alert storm
        alert_storm_detected = any(
            group['alert_count'] > 5 and group['type'] == 'time_cluster'
            for group in correlation_groups
        )
        
        logger.info(f"Built {len(correlation_groups)} correlation groups")
        
        return {
            "total_alerts": len(alerts),
            "correlation_groups": correlation_groups,
            "alert_storm_detected": alert_storm_detected,
            "unique_fingerprints": len(fingerprint_groups),
            "unique_assets": len(asset_groups),
            "time_clusters": len(time_clusters)
        }
    
    def suggest_suppression(
        self,
        alerts: List[Dict[str, Any]],
        correlation_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Suggest which alerts to suppress based on correlation.
        
        Args:
            alerts: List of all alerts
            correlation_result: Result from find_correlated_alerts
            
        Returns:
            Suppression suggestions
        """
        suggestions = []
        
        for group in correlation_result.get('correlation_groups', []):
            if group['alert_count'] > 2 and group['correlation_score'] > 0.7:
                # Suggest keeping the first alert, suppressing others
                alert_ids = group['alert_ids']
                
                suggestions.append({
                    "group_type": group['type'],
                    "keep_alert_id": alert_ids[0],
                    "suppress_alert_ids": alert_ids[1:],
                    "reason": f"High correlation ({group['correlation_score']}) - {group['reason']}",
                    "alerts_to_suppress": len(alert_ids) - 1
                })
        
        total_suppressible = sum(s['alerts_to_suppress'] for s in suggestions)
        noise_reduction_percent = (total_suppressible / len(alerts) * 100) if alerts else 0
        
        return {
            "suppression_suggestions": suggestions,
            "total_alerts": len(alerts),
            "suppressible_alerts": total_suppressible,
            "noise_reduction_percent": round(noise_reduction_percent, 2)
        }
    
    def identify_root_cause_alert(
        self,
        alerts: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Identify which alert is likely the root cause.
        
        Args:
            alerts: List of correlated alerts
            
        Returns:
            Root cause alert or None
        """
        if not alerts:
            return None
        
        # Sort by multiple criteria:
        # 1. Earliest timestamp (root cause usually happens first)
        # 2. Highest business impact score
        # 3. Critical severity
        
        scored_alerts = []
        
        for alert in alerts:
            score = 0
            
            # Earlier = higher score (inversely proportional)
            created_at_str = alert.get('createdAt', datetime.utcnow().isoformat())
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                # Earlier alerts get higher score
                time_score = 100 / (1 + (datetime.utcnow() - created_at).total_seconds() / 3600)
                score += time_score
            except:
                pass
            
            # Business impact
            impact = alert.get('businessImpactScore', 0)
            score += impact * 0.5
            
            # Severity (from event)
            event = alert.get('event', {})
            severity = event.get('severity', 'info')
            if severity == 'critical':
                score += 50
            elif severity == 'warning':
                score += 25
            
            scored_alerts.append({
                "alert": alert,
                "root_cause_score": score
            })
        
        # Get highest scoring alert
        root_cause = max(scored_alerts, key=lambda x: x['root_cause_score'])
        
        return {
            "root_cause_alert_id": root_cause['alert']['id'],
            "confidence": min(root_cause['root_cause_score'] / 200, 1.0),  # Normalize to 0-1
            "reason": "Earliest occurrence with highest business impact"
        }