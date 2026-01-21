"""
Application configuration settings
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Service Configuration
    SERVICE_NAME: str = "ml-service"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # Database Configuration
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "ems_db"
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "your_password"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    @property
    def DATABASE_URL(self) -> str:
        """Construct database URL"""
        return (
            f"postgresql+psycopg://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )
    
    # EMS Core API
    EMS_CORE_URL: str = "http://localhost:3100"
    EMS_CORE_TIMEOUT: int = 30
    
    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_CACHE_TTL: int = 300
    
    @property
    def REDIS_URL(self) -> str:
        """Construct Redis URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # ML Model Configuration
    ANOMALY_DETECTION_ENABLED: bool = True
    ANOMALY_THRESHOLD: float = 0.7
    ANOMALY_CONTAMINATION: float = 0.1
    MODEL_RETRAIN_INTERVAL: int = 3600
    MIN_TRAINING_SAMPLES: int = 100
    
    # Time-series Configuration
    FORECAST_HORIZON_DAYS: int = 7
    SEASONALITY_MODE: str = "multiplicative"
    
    # Feature Engineering
    FEATURE_WINDOW_SIZE: int = 60
    FEATURE_AGGREGATION_PERIOD: int = 300
    
    # Alert Configuration
    AUTO_CREATE_ALERTS: bool = True
    ANOMALY_ALERT_SEVERITY: str = "high"
    ANOMALY_ALERT_SOURCE: str = "ml-service"
    
    # Performance
    WORKERS: int = 4
    MAX_REQUESTS: int = 1000
    TIMEOUT: int = 60
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    CORS_ALLOW_CREDENTIALS: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export settings instance
settings = get_settings()
