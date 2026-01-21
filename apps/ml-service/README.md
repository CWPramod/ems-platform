# EMS ML Service - Machine Learning Module

## 📋 Overview

The ML Service is a FastAPI-based microservice that provides machine learning capabilities for the Enterprise Monitoring System (EMS). It currently implements anomaly detection for network metrics using Isolation Forest and statistical methods.

## 🎯 Features

### ✅ Implemented (Phase 1)
- **Anomaly Detection**: Detect unusual patterns in network metrics
  - Isolation Forest ML model
  - Statistical methods (Z-score, IQR, MAD)
  - Real-time anomaly scoring
  - Auto-event creation for anomalies
  - Feature engineering with rolling statistics

### 🔜 Roadmap
- Predictive Maintenance
- Root Cause Analysis
- Intelligent Alerting
- Traffic Forecasting
- Security Threat Detection

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              ML Service (Port 8000)             │
├─────────────────────────────────────────────────┤
│  FastAPI Application                            │
│  ├── /api/v1/health          - Health check     │
│  ├── /api/v1/anomaly/detect  - Detect anomalies │
│  ├── /api/v1/anomaly/train   - Train model      │
│  ├── /api/v1/metrics/:id     - Get metrics      │
│  ├── /api/v1/models          - List models      │
│  └── /api/v1/anomaly/scores/:id - Get scores    │
│                                                 │
│  Services                                       │
│  ├── Anomaly Detector (Isolation Forest)       │
│  ├── Data Processor (Feature Engineering)      │
│  └── EMS Core Client (API Integration)         │
│                                                 │
│  Storage                                        │
│  ├── PostgreSQL (Metrics, Scores, Models)      │
│  └── File System (Trained Models)              │
└─────────────────────────────────────────────────┘
```

## 📦 Installation

### Prerequisites
- Python 3.11+
- PostgreSQL database (same as EMS Core)
- EMS Core API running on port 3100
- Git

### Step 1: Navigate to ML Service Directory

```powershell
cd C:\Dev\ems-platform\apps
mkdir ml-service
cd ml-service
```

### Step 2: Create Directory Structure

```powershell
# Create all required directories
mkdir app, app\models, app\services, app\api, app\ml, app\ml\models
New-Item -ItemType Directory -Force -Path app, app\models, app\services, app\api, app\ml, app\ml\models
```

### Step 3: Copy Files

Copy all the files from the outputs directory to the ml-service directory:

```
ml-service/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py
│   │   └── database_models.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── anomaly_detection.py
│   │   ├── data_processor.py
│   │   └── ems_client.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py
│   └── ml/
│       ├── __init__.py
│       └── models/
├── requirements.txt
├── .env.example
├── Dockerfile
└── README.md
```

### Step 4: Create __init__.py Files

Create empty `__init__.py` files in all directories (or use content from `__init__-files.py`):

```powershell
# Create __init__.py files
New-Item -ItemType File -Force -Path app\__init__.py
New-Item -ItemType File -Force -Path app\models\__init__.py
New-Item -ItemType File -Force -Path app\services\__init__.py
New-Item -ItemType File -Force -Path app\api\__init__.py
New-Item -ItemType File -Force -Path app\ml\__init__.py
```

### Step 5: Configure Environment

```powershell
# Copy .env.example to .env
Copy-Item .env.example .env

# Edit .env with your settings
notepad .env
```

**Required .env settings:**
```env
# Database (same as EMS Core)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ems_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# EMS Core URL
EMS_CORE_URL=http://localhost:3100

# Service Settings
PORT=8000
DEBUG=true
LOG_LEVEL=INFO
```

### Step 6: Create Virtual Environment (Recommended)

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Verify activation
python --version
```

### Step 7: Install Dependencies

```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Verify installation
pip list
```

### Step 8: Initialize Database

The ML service will automatically create required tables on startup:
- `anomaly_scores` - Stores anomaly detection results
- `model_metadata` - Stores ML model information

Existing EMS tables used:
- `assets` - Asset information
- `metrics` - Metric data
- `events` - Event logs

## 🚀 Running the Service

### Development Mode

```powershell
# Activate virtual environment (if not already active)
.\venv\Scripts\Activate.ps1

# Run with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Using Python Directly

```powershell
python app/main.py
```

## 🧪 Testing the Service

### 1. Health Check

```powershell
# Test health endpoint
Invoke-RestMethod -Uri http://localhost:8000/api/v1/health -Method Get
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-21T10:30:00Z",
  "database": true,
  "redis": null,
  "models": {
    "anomaly_detection": false
  }
}
```

### 2. Train Anomaly Detection Model

```powershell
# Train model with default settings
$trainBody = @{
    modelType = "anomaly_detection"
    timeRange = 86400
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8000/api/v1/anomaly/train `
    -Method Post `
    -ContentType "application/json" `
    -Body $trainBody
```

### 3. Detect Anomalies

```powershell
# Detect anomalies for all assets
$detectBody = @{
    timeRange = 3600
    threshold = 0.7
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8000/api/v1/anomaly/detect `
    -Method Post `
    -ContentType "application/json" `
    -Body $detectBody
```

### 4. Detect Anomalies for Specific Asset

```powershell
# Detect for specific asset
$detectBody = @{
    assetId = 1
    metricNames = @("cpu_usage", "memory_usage")
    timeRange = 3600
    threshold = 0.7
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8000/api/v1/anomaly/detect `
    -Method Post `
    -ContentType "application/json" `
    -Body $detectBody
```

### 5. Get Asset Metrics with Statistics

```powershell
# Get metrics for asset
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/metrics/1?hours=24" -Method Get
```

### 6. List Available Models

```powershell
# List models
Invoke-RestMethod -Uri http://localhost:8000/api/v1/models -Method Get
```

### 7. Get Anomaly Scores History

```powershell
# Get historical scores
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/anomaly/scores/1?hours=24" -Method Get
```

## 📊 API Documentation

Once the service is running, access interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | Service port |
| `HOST` | 0.0.0.0 | Service host |
| `DEBUG` | true | Debug mode |
| `LOG_LEVEL` | INFO | Logging level |
| `DATABASE_HOST` | localhost | Database host |
| `DATABASE_PORT` | 5432 | Database port |
| `DATABASE_NAME` | ems_db | Database name |
| `EMS_CORE_URL` | http://localhost:3100 | EMS Core API URL |
| `ANOMALY_THRESHOLD` | 0.7 | Anomaly detection threshold |
| `ANOMALY_CONTAMINATION` | 0.1 | Expected outlier proportion |
| `AUTO_CREATE_ALERTS` | true | Auto-create events for anomalies |
| `MIN_TRAINING_SAMPLES` | 100 | Minimum samples for training |

### Anomaly Detection Parameters

- **Threshold (0-1)**: Higher values = fewer anomalies detected
  - 0.5: Very sensitive (many anomalies)
  - 0.7: Balanced (recommended)
  - 0.9: Very specific (few anomalies)

- **Contamination (0-1)**: Expected proportion of outliers
  - 0.05: 5% of data expected to be anomalous
  - 0.1: 10% (recommended)
  - 0.2: 20% (high noise environment)

## 🔍 How It Works

### Anomaly Detection Flow

1. **Data Collection**: Fetch historical metrics from EMS Core
2. **Feature Engineering**: Create rolling statistics, lag features
3. **Model Training**: Train Isolation Forest on historical data
4. **Prediction**: Score new metrics for anomalies
5. **Alerting**: Auto-create events for detected anomalies
6. **Storage**: Store scores in database for analysis

### Feature Engineering

For each metric value, the following features are created:
- Raw value
- Rolling mean (5-point window)
- Rolling std (5-point window)
- Rolling min (5-point window)
- Rolling max (5-point window)
- Lag-1 value

### Anomaly Scoring

- **ML Method**: Isolation Forest scores (0-1 scale)
  - 0.0 = Normal
  - 1.0 = Highly anomalous
  
- **Statistical Method**: Z-score based
  - Uses mean and standard deviation
  - Threshold typically at 3 standard deviations

## 🐛 Troubleshooting

### Issue: Service won't start

```powershell
# Check Python version
python --version  # Should be 3.11+

# Check if port is in use
netstat -ano | findstr :8000

# Check dependencies
pip list | Select-String "fastapi|uvicorn|sklearn"
```

### Issue: Database connection failed

```powershell
# Test PostgreSQL connection
Test-NetConnection -ComputerName localhost -Port 5432

# Verify database exists
psql -U postgres -d ems_db -c "SELECT 1"

# Check .env file
Get-Content .env | Select-String "DATABASE"
```

### Issue: EMS Core not reachable

```powershell
# Test EMS Core
Invoke-RestMethod -Uri http://localhost:3100/health

# Check if EMS Core is running
netstat -ano | findstr :3100
```

### Issue: Model training fails

Common causes:
- **Insufficient data**: Need at least 100 samples
- **No metrics**: Check if metrics exist in database
- **Bad data**: Check for NaN or infinite values

```powershell
# Check metrics in database
psql -U postgres -d ems_db -c "SELECT COUNT(*) FROM metrics"
```

## 📈 Performance Optimization

### For Large Datasets

1. **Adjust time range**: Use shorter ranges for training
2. **Batch size**: Process metrics in batches
3. **Caching**: Enable Redis for feature caching
4. **Model updates**: Retrain periodically, not on every request

### Scaling

- **Horizontal**: Run multiple instances behind load balancer
- **Vertical**: Increase workers in production mode
- **Database**: Add indexes on frequently queried columns

## 🔒 Security Considerations

- Change default database password
- Use environment variables for secrets
- Enable HTTPS in production
- Implement authentication (future enhancement)
- Rate limiting on API endpoints

## 📝 Logging

Logs are written to stdout with format:
```
2026-01-21 10:30:00 - app.main - INFO - Starting ml-service
```

Log levels:
- `DEBUG`: Detailed information
- `INFO`: General information
- `WARNING`: Warning messages
- `ERROR`: Error messages
- `CRITICAL`: Critical issues

Change log level in `.env`:
```env
LOG_LEVEL=DEBUG
```

## 🧪 Development

### Adding New ML Features

1. Create new service in `app/services/`
2. Add schemas in `app/models/schemas.py`
3. Add routes in `app/api/routes.py`
4. Update documentation

### Running Tests

```powershell
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/ -v
```

## 📚 Next Steps

After ML Service is running:

1. ✅ **Frontend Integration**: Add ML dashboard components
2. ✅ **Predictive Maintenance**: Implement health scoring
3. ✅ **Root Cause Analysis**: Add correlation analysis
4. ✅ **Intelligent Alerting**: Implement smart prioritization
5. ✅ **Traffic Forecasting**: Add time-series prediction
6. ✅ **Security Detection**: Implement threat detection

## 🤝 Integration with Frontend

To integrate with the React frontend, add to `api.ts`:

```typescript
// ML Service endpoints
export const mlApi = {
  // Health check
  health: () => axios.get(`${ML_API_BASE_URL}/api/v1/health`),
  
  // Anomaly detection
  detectAnomalies: (params: AnomalyDetectionRequest) =>
    axios.post(`${ML_API_BASE_URL}/api/v1/anomaly/detect`, params),
  
  // Train model
  trainModel: (params: TrainModelRequest) =>
    axios.post(`${ML_API_BASE_URL}/api/v1/anomaly/train`, params),
  
  // Get metrics
  getMetrics: (assetId: number, hours: number = 24) =>
    axios.get(`${ML_API_BASE_URL}/api/v1/metrics/${assetId}?hours=${hours}`),
  
  // Get anomaly scores
  getAnomalyScores: (assetId: number, hours: number = 24) =>
    axios.get(`${ML_API_BASE_URL}/api/v1/anomaly/scores/${assetId}?hours=${hours}`),
  
  // List models
  listModels: () => axios.get(`${ML_API_BASE_URL}/api/v1/models`),
};
```

## 📞 Support

For issues or questions:
1. Check this README
2. Review logs in terminal
3. Check API docs at http://localhost:8000/docs
4. Verify all services are running

## 🎉 Success Criteria

ML Service is working correctly when:

✅ Health check returns "healthy" status  
✅ Database connection is successful  
✅ EMS Core connection is working  
✅ Model can be trained with historical data  
✅ Anomalies are detected in metrics  
✅ Events are created for anomalies  
✅ Scores are stored in database  

## 📄 License

Part of the EMS Platform project.

---

**Ready to start? Follow the installation steps above!** 🚀
