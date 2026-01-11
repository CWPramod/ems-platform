import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any, Optional
import logging
import os
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseService:
    """
    Service to connect to PostgreSQL and fetch EMS data.
    """
    
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        """Connect to PostgreSQL database."""
        try:
            self.connection = psycopg2.connect(
                host=os.getenv('DATABASE_HOST', 'localhost'),
                port=os.getenv('DATABASE_PORT', '5433'),
                user=os.getenv('DATABASE_USER', 'ems_admin'),
                password=os.getenv('DATABASE_PASSWORD', 'ems_secure_password_2026'),
                database=os.getenv('DATABASE_NAME', 'ems_platform')
            )
            logger.info("Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            self.connection = None
    
    def is_connected(self) -> bool:
        """Check if database connection is active."""
        return self.connection is not None and not self.connection.closed
    
    def get_metrics_by_asset(
        self,
        asset_id: str,
        metric_name: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetch metrics for a specific asset.
        
        Args:
            asset_id: UUID of the asset
            metric_name: Optional metric name filter
            limit: Maximum number of records
            
        Returns:
            List of metric records
        """
        if not self.is_connected():
            logger.warning("Database not connected")
            return []
        
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            
            if metric_name:
                query = """
                    SELECT * FROM metrics 
                    WHERE "assetId" = %s AND "metricName" = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                """
                cursor.execute(query, (asset_id, metric_name, limit))
            else:
                query = """
                    SELECT * FROM metrics 
                    WHERE "assetId" = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                """
                cursor.execute(query, (asset_id, limit))
            
            results = cursor.fetchall()
            cursor.close()
            
            # Convert to list of dicts
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error fetching metrics: {e}")
            return []
    
    def get_all_metrics(
        self,
        metric_name: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Fetch all metrics, optionally filtered by metric name.
        
        Args:
            metric_name: Optional metric name filter
            limit: Maximum number of records
            
        Returns:
            List of metric records
        """
        if not self.is_connected():
            logger.warning("Database not connected")
            return []
        
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            
            if metric_name:
                query = """
                    SELECT * FROM metrics 
                    WHERE "metricName" = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                """
                cursor.execute(query, (metric_name, limit))
            else:
                query = """
                    SELECT * FROM metrics 
                    ORDER BY timestamp DESC
                    LIMIT %s
                """
                cursor.execute(query, (limit,))
            
            results = cursor.fetchall()
            cursor.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error fetching all metrics: {e}")
            return []
    
    def get_events_by_asset(
        self,
        asset_id: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetch events for a specific asset.
        
        Args:
            asset_id: UUID of the asset
            limit: Maximum number of records
            
        Returns:
            List of event records
        """
        if not self.is_connected():
            logger.warning("Database not connected")
            return []
        
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT * FROM events 
                WHERE "assetId" = %s
                ORDER BY timestamp DESC
                LIMIT %s
            """
            cursor.execute(query, (asset_id, limit))
            
            results = cursor.fetchall()
            cursor.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error fetching events: {e}")
            return []
    
    def get_correlated_events(
        self,
        fingerprint: str,
        time_window_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Find events with the same fingerprint within a time window.
        
        Args:
            fingerprint: Event fingerprint
            time_window_minutes: Time window in minutes
            
        Returns:
            List of correlated event records
        """
        if not self.is_connected():
            logger.warning("Database not connected")
            return []
        
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT * FROM events 
                WHERE fingerprint = %s
                AND timestamp >= NOW() - INTERVAL '%s minutes'
                ORDER BY timestamp DESC
            """
            cursor.execute(query, (fingerprint, time_window_minutes))
            
            results = cursor.fetchall()
            cursor.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error fetching correlated events: {e}")
            return []
    
    def close(self):
        """Close database connection."""
        if self.connection and not self.connection.closed:
            self.connection.close()
            logger.info("Database connection closed")

# Global database service instance
db_service = DatabaseService()