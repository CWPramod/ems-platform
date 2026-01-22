"""
EMS Core API Client for ML Service
"""
import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from app.config import settings

logger = logging.getLogger(__name__)


class EMSCoreClient:
    """Client for communicating with EMS Core API"""
    
    def __init__(self):
        self.base_url = settings.EMS_CORE_URL
        self.timeout = settings.EMS_CORE_TIMEOUT
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"}
        )
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    # Asset Methods
    
    async def get_assets(self, asset_type: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all assets from EMS Core
        
        Args:
            asset_type: Filter by asset type (router, switch, server, etc.)
            status: Filter by status (online, offline)
        
        Returns:
            List of asset objects
        """
        try:
            params = {}
            if asset_type:
                params["type"] = asset_type
            if status:
                params["status"] = status
            
            response = await self.client.get("/assets", params=params)
            response.raise_for_status()
            
            data = response.json()
            assets = data if isinstance(data, list) else data.get("data", [])
            
            logger.info(f"Retrieved {len(assets)} assets from EMS Core")
            return assets
        
        except Exception as e:
            logger.error(f"Failed to get assets: {e}")
            return []
    
    async def get_asset_by_id(self, asset_id: int) -> Optional[Dict[str, Any]]:
        """Get specific asset by ID"""
        try:
            response = await self.client.get(f"/assets/{asset_id}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get asset {asset_id}: {e}")
            return None
    
    # Metrics Methods
    
    async def get_metrics(
        self,
        asset_id: Optional[int] = None,
        metric_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Get metrics from EMS Core
        
        Args:
            asset_id: Filter by asset ID
            metric_name: Filter by metric name
            start_time: Start timestamp
            end_time: End timestamp
            limit: Maximum number of records
        
        Returns:
            List of metric objects
        """
        try:
            params = {"limit": limit}
            
            if asset_id:
                params["assetId"] = asset_id
            if metric_name:
                params["metricName"] = metric_name
            if start_time:
                params["startTime"] = start_time.isoformat()
            if end_time:
                params["endTime"] = end_time.isoformat()
            
            response = await self.client.get("/metrics", params=params)
            response.raise_for_status()
            
            data = response.json()
            metrics = data if isinstance(data, list) else data.get("data", [])
            
            
            # Add assetId and metricName back to each metric record
            # since the API only returns timestamp and value
            enriched_metrics = []
            for metric in metrics:
                enriched_metric = {
                    "timestamp": metric.get("timestamp"),
                    "value": metric.get("value"),
                }
                # Add the query parameters back as fields
                if asset_id:
                    enriched_metric["assetId"] = asset_id
                if metric_name:
                    enriched_metric["metricName"] = metric_name
                enriched_metrics.append(enriched_metric)

            logger.info(f"Retrieved {len(enriched_metrics)} metrics from EMS Core")
            return enriched_metrics

        
        except Exception as e:
            logger.error(f"Failed to get metrics: {e}")
            return []
    
    async def create_metric(
        self,
        asset_id: int,
        metric_name: str,
        value: float,
        unit: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Create a new metric"""
        try:
            payload = {
                "assetId": asset_id,
                "metricName": metric_name,
                "value": value,
            }
            if unit:
                payload["unit"] = unit
            if metadata:
                payload["meta_data"] = metadata
            
            response = await self.client.post("/metrics", json=payload)
            response.raise_for_status()
            return response.json()
        
        except Exception as e:
            logger.error(f"Failed to create metric: {e}")
            return None
    
    async def create_metrics_batch(self, metrics: List[Dict[str, Any]]) -> bool:
        """Create multiple metrics at once"""
        try:
            response = await self.client.post("/metrics/batch", json={"metrics": metrics})
            response.raise_for_status()
            logger.info(f"Created {len(metrics)} metrics in batch")
            return True
        except Exception as e:
            logger.error(f"Failed to create metrics batch: {e}")
            return False
    
    # Event Methods
    
    async def get_events(
        self,
        asset_id: Optional[int] = None,
        severity: Optional[str] = None,
        source: Optional[str] = None,
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get events from EMS Core"""
        try:
            params = {"limit": limit}
            
            if asset_id:
                params["assetId"] = asset_id
            if severity:
                params["severity"] = severity
            if source:
                params["source"] = source
            if start_time:
                params["startTime"] = start_time.isoformat()
            
            response = await self.client.get("/events", params=params)
            response.raise_for_status()
            
            data = response.json()
            events = data if isinstance(data, list) else data.get("data", [])
            
            return events
        
        except Exception as e:
            logger.error(f"Failed to get events: {e}")
            return []
    
    async def create_event(
        self,
        asset_id: int,
        event_type: str,
        severity: str,
        message: str,
        source: str = "ml-service",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new event in EMS Core
        
        Args:
            asset_id: Asset ID
            event_type: Type of event (e.g., "anomaly_detected", "threshold_breach")
            severity: Severity level (low, medium, high, critical)
            message: Event message
            source: Event source (default: ml-service)
            metadata: Additional metadata
        
        Returns:
            Created event object or None
        """
        try:
            payload = {
                "assetId": asset_id,
                "eventType": event_type,
                "severity": severity,
                "message": message,
                "source": source,
            }
            if metadata:
                payload["meta_data"] = metadata
            
            response = await self.client.post("/events", json=payload)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Created event for asset {asset_id}: {event_type}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to create event: {e}")
            return None
    
    # Alert Methods
    
    async def create_alert(
        self,
        asset_id: int,
        alert_type: str,
        severity: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Create a new alert"""
        try:
            payload = {
                "assetId": asset_id,
                "alertType": alert_type,
                "severity": severity,
                "message": message,
            }
            if metadata:
                payload["meta_data"] = metadata
            
            response = await self.client.post("/alerts", json=payload)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Created alert for asset {asset_id}: {alert_type}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
            return None
    
    # Health Check
    
    async def health_check(self) -> bool:
        """Check if EMS Core is reachable"""
        try:
            response = await self.client.get("/")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"EMS Core health check failed: {e}")
            return False


# Global client instance
ems_client = EMSCoreClient()


