"""
ML Service - FastAPI Application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.config import settings
from app.database import init_db, check_db_connection
from app.api import routes
from app.services.ems_client import ems_client

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("=" * 60)
    logger.info(f"Starting {settings.SERVICE_NAME}")
    logger.info("=" * 60)
    
    # Initialize database
    try:
        logger.info("Initializing database...")
        init_db()
        
        if check_db_connection():
            logger.info("✅ Database connection successful")
        else:
            logger.error("❌ Database connection failed")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
    
    # Check EMS Core connection
    try:
        logger.info("Checking EMS Core connection...")
        if await ems_client.health_check():
            logger.info("✅ EMS Core connection successful")
        else:
            logger.warning("⚠️  EMS Core connection failed - will retry on demand")
    except Exception as e:
        logger.warning(f"⚠️  EMS Core health check failed: {e}")
    
    # Load ML models
    try:
        from app.services.anomaly_detection import anomaly_detector
        
        if anomaly_detector.is_trained:
            logger.info("✅ Anomaly detection model loaded")
        else:
            logger.info("ℹ️  No pre-trained anomaly detection model found")
            logger.info("   Model will be trained on first use or via /anomaly/train endpoint")
    except Exception as e:
        logger.error(f"❌ Failed to load ML models: {e}")
    
    logger.info("=" * 60)
    logger.info(f"🚀 {settings.SERVICE_NAME} is ready!")
    logger.info(f"📍 Listening on {settings.HOST}:{settings.PORT}")
    logger.info(f"📊 EMS Core: {settings.EMS_CORE_URL}")
    logger.info(f"🗄️  Database: {settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.DATABASE_NAME}")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service...")
    
    # Close EMS client
    try:
        await ems_client.close()
        logger.info("✅ EMS client closed")
    except Exception as e:
        logger.error(f"❌ Error closing EMS client: {e}")
    
    logger.info("👋 ML Service stopped")


# Create FastAPI app
app = FastAPI(
    title="EMS ML Service",
    description="Machine Learning Service for Enterprise Monitoring System",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes.router, prefix="/api/v1", tags=["ML"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.SERVICE_NAME,
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "health": "/api/v1/health",
            "anomaly_detection": "/api/v1/anomaly/detect",
            "train_model": "/api/v1/anomaly/train",
            "metrics": "/api/v1/metrics/{asset_id}",
            "models": "/api/v1/models",
            "anomaly_scores": "/api/v1/anomaly/scores/{asset_id}",
            "docs": "/docs",
            "openapi": "/openapi.json"
        }
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    start_time = datetime.utcnow()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = (datetime.utcnow() - start_time).total_seconds()
    
    # Log request
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration:.3f}s"
    )
    
    return response


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower()
    )
