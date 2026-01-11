from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.ml_routes import router as ml_router

app = FastAPI(
    title="EMS ML Service",
    description="Machine Learning service for anomaly detection and root cause analysis",
    version="1.0.0"
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

@app.get("/")
async def root():
    return {
        "service": "EMS ML Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ml_endpoints": "/ml/*",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)