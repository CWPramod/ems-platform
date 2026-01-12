from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import os
from api.persistence_routes import router as persistence_router
from api.multi_metric_routes import router as multi_metric_router

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.ml_routes import router as ml_router
from api.enhanced_ml_routes import router as enhanced_ml_router
from api.correlation_routes import router as correlation_router

app = FastAPI(
    title="EMS ML Service",
    description="Machine Learning service for anomaly detection and root cause analysis",
    version="2.3.0"
)

# Enable CORS for NestJS API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ML routes
app.include_router(ml_router)
app.include_router(enhanced_ml_router)
app.include_router(correlation_router)
app.include_router(persistence_router)
app.include_router(multi_metric_router)

@app.get("/")
async def root():
    return {
        "service": "EMS ML Service",
        "version": "2.3.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ml_basic": "/ml/*",
            "ml_enhanced": "/ml/enhanced/*",
            "ml_correlation": "/ml/correlation/*",
            "ml_models": "/ml/models/*",
            "ml_multi_metric": "/ml/multi-metric/*",
	    "docs": "/docs"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)