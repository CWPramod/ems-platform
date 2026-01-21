# ML Service - Quick Setup Guide

## 🚀 Quick Start (15 minutes)

Follow these steps to get the ML Service running:

### Step 1: Navigate and Create Directory Structure

```powershell
# Navigate to apps directory
cd C:\Dev\ems-platform\apps

# Create ml-service directory
mkdir ml-service
cd ml-service

# Create directory structure
$directories = @(
    "app",
    "app\models",
    "app\services", 
    "app\api",
    "app\ml",
    "app\ml\models"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir
    Write-Host "✅ Created $dir"
}
```

### Step 2: Copy Files from Outputs

You need to copy these files from the outputs directory to your ml-service directory:

**File Mapping:**
```
Outputs                          →  ml-service/
├── main.py                      →  app/main.py
├── config.py                    →  app/config.py
├── database.py                  →  app/database.py
├── schemas.py                   →  app/models/schemas.py
├── database_models.py           →  app/models/database_models.py
├── anomaly_detection.py         →  app/services/anomaly_detection.py
├── data_processor.py            →  app/services/data_processor.py
├── ems_client.py                →  app/services/ems_client.py
├── routes.py                    →  app/api/routes.py
├── ml-service-requirements.txt  →  requirements.txt
├── ml-service-.env.example      →  .env.example
├── Dockerfile                   →  Dockerfile
└── README-ML-Service.md         →  README.md
```

**PowerShell commands to copy:**

```powershell
# Assuming you're in C:\Dev\ems-platform\apps\ml-service
# and outputs are in your downloads or a specific path

# Replace <OUTPUTS_PATH> with actual path to outputs folder
$outputsPath = "<OUTPUTS_PATH>"

# Copy main files
Copy-Item "$outputsPath\main.py" -Destination "app\main.py"
Copy-Item "$outputsPath\config.py" -Destination "app\config.py"
Copy-Item "$outputsPath\database.py" -Destination "app\database.py"

# Copy model files
Copy-Item "$outputsPath\schemas.py" -Destination "app\models\schemas.py"
Copy-Item "$outputsPath\database_models.py" -Destination "app\models\database_models.py"

# Copy service files
Copy-Item "$outputsPath\anomaly_detection.py" -Destination "app\services\anomaly_detection.py"
Copy-Item "$outputsPath\data_processor.py" -Destination "app\services\data_processor.py"
Copy-Item "$outputsPath\ems_client.py" -Destination "app\services\ems_client.py"

# Copy API files
Copy-Item "$outputsPath\routes.py" -Destination "app\api\routes.py"

# Copy root files
Copy-Item "$outputsPath\ml-service-requirements.txt" -Destination "requirements.txt"
Copy-Item "$outputsPath\ml-service-.env.example" -Destination ".env.example"
Copy-Item "$outputsPath\Dockerfile" -Destination "Dockerfile"
Copy-Item "$outputsPath\README-ML-Service.md" -Destination "README.md"

Write-Host "✅ All files copied!"
```

### Step 3: Create __init__.py Files

```powershell
# Create all __init__.py files
$initFiles = @(
    "app\__init__.py",
    "app\models\__init__.py",
    "app\services\__init__.py",
    "app\api\__init__.py",
    "app\ml\__init__.py"
)

foreach ($file in $initFiles) {
    New-Item -ItemType File -Force -Path $file
    Write-Host "✅ Created $file"
}

# Optional: Add content to __init__.py files
@"
"""
EMS ML Service - Machine Learning Module
"""
__version__ = "1.0.0"
"@ | Out-File -FilePath "app\__init__.py" -Encoding UTF8

Write-Host "✅ __init__.py files created!"
```

### Step 4: Setup Environment Configuration

```powershell
# Copy .env.example to .env
Copy-Item ".env.example" -Destination ".env"

# Open .env for editing
notepad .env

# Make sure to set these values:
# DATABASE_PASSWORD=your_actual_password
# EMS_CORE_URL=http://localhost:3100
```

**Required .env settings:**
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ems_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password  # ← Change this!

EMS_CORE_URL=http://localhost:3100
PORT=8000
DEBUG=true
```

### Step 5: Create Virtual Environment

```powershell
# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# You should see (venv) in your prompt
# Verify Python version
python --version  # Should show Python 3.11+

Write-Host "✅ Virtual environment activated!"
```

### Step 6: Install Dependencies

```powershell
# Upgrade pip first
python -m pip install --upgrade pip

# Install all requirements (this may take 2-3 minutes)
pip install -r requirements.txt

# Verify key packages
pip list | Select-String "fastapi|uvicorn|sklearn|pandas"

Write-Host "✅ Dependencies installed!"
```

### Step 7: Verify Installation

```powershell
# Check directory structure
Get-ChildItem -Recurse -File | Select-Object FullName

# Verify all Python files are present
$requiredFiles = @(
    "app\main.py",
    "app\config.py",
    "app\database.py",
    "app\models\schemas.py",
    "app\models\database_models.py",
    "app\services\anomaly_detection.py",
    "app\services\data_processor.py",
    "app\services\ems_client.py",
    "app\api\routes.py"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        $missing += $file
    }
}

if ($missing.Count -eq 0) {
    Write-Host "✅ All required files present!"
} else {
    Write-Host "❌ Missing files:"
    $missing | ForEach-Object { Write-Host "   - $_" }
}
```

### Step 8: Start the ML Service

```powershell
# Make sure EMS Core is running on port 3100
# Make sure PostgreSQL is running

# Start ML Service
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# You should see:
# ============================================================
# Starting ml-service
# ============================================================
# ...
# 🚀 ml-service is ready!
# 📍 Listening on 0.0.0.0:8000
# ============================================================
```

### Step 9: Test the Service

Open a **new** PowerShell terminal (keep the service running in the first one):

```powershell
# Test health endpoint
Invoke-RestMethod -Uri http://localhost:8000/api/v1/health

# Expected output:
# status    : healthy
# timestamp : 2026-01-21T10:30:00Z
# database  : True
# models    : @{anomaly_detection=False}

Write-Host "✅ ML Service is working!"
```

### Step 10: Train the Model (Optional but Recommended)

```powershell
# Train anomaly detection model
$trainRequest = @{
    modelType = "anomaly_detection"
    timeRange = 86400  # Last 24 hours
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri http://localhost:8000/api/v1/anomaly/train `
    -Method Post `
    -ContentType "application/json" `
    -Body $trainRequest

$result

# If successful, you'll see:
# success           : True
# message           : Model trained successfully
# modelType         : anomaly_detection
# trainingSamples   : 1234
# trainingDuration  : 2.5
```

### Step 11: Test Anomaly Detection

```powershell
# Detect anomalies
$detectRequest = @{
    timeRange = 3600  # Last hour
    threshold = 0.7
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri http://localhost:8000/api/v1/anomaly/detect `
    -Method Post `
    -ContentType "application/json" `
    -Body $detectRequest

$result

# Output shows detected anomalies
Write-Host "✅ Anomaly detection working!"
```

### Step 12: Access API Documentation

```powershell
# Open Swagger UI in browser
Start-Process "http://localhost:8000/docs"

# Or ReDoc
Start-Process "http://localhost:8000/redoc"
```

## 🎯 Quick Verification Checklist

Use this checklist to verify everything is working:

```powershell
# 1. Check if ML service is running
Test-NetConnection -ComputerName localhost -Port 8000

# 2. Health check
$health = Invoke-RestMethod -Uri http://localhost:8000/api/v1/health
Write-Host "Health Status: $($health.status)"
Write-Host "Database: $($health.database)"

# 3. Check if models are available
$models = Invoke-RestMethod -Uri http://localhost:8000/api/v1/models
Write-Host "Available Models: $($models.totalModels)"

# 4. Test with specific asset
$metrics = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/metrics/1?hours=1"
Write-Host "Metrics Retrieved: $($metrics.data.Count)"

Write-Host "`n✅ All checks passed! ML Service is fully operational!"
```

## ⚠️ Common Issues and Fixes

### Issue: Port 8000 already in use

```powershell
# Find and kill process using port 8000
$processId = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess
if ($processId) {
    Stop-Process -Id $processId -Force
    Write-Host "✅ Port 8000 freed"
}
```

### Issue: Virtual environment not activating

```powershell
# If you get execution policy error
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try again
.\venv\Scripts\Activate.ps1
```

### Issue: Database connection fails

```powershell
# Test PostgreSQL connection
Test-NetConnection -ComputerName localhost -Port 5432

# Check if EMS database exists
psql -U postgres -d ems_db -c "SELECT 1"

# Verify .env database settings
Get-Content .env | Select-String "DATABASE"
```

### Issue: EMS Core not reachable

```powershell
# Check if EMS Core is running
Test-NetConnection -ComputerName localhost -Port 3100

# Test EMS Core health
Invoke-RestMethod -Uri http://localhost:3100/health
```

### Issue: Import errors

```powershell
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Or specific packages
pip install fastapi uvicorn scikit-learn pandas numpy --force-reinstall
```

## 📊 Final Directory Structure

After setup, your structure should look like:

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
│       └── models/  (trained models will be saved here)
├── venv/  (virtual environment)
├── requirements.txt
├── .env
├── .env.example
├── Dockerfile
└── README.md
```

## 🎉 Success!

If all steps completed successfully, you should now have:

✅ ML Service running on port 8000  
✅ Database connection working  
✅ EMS Core integration active  
✅ API documentation accessible  
✅ Ready for anomaly detection  

## 🔄 Daily Usage

To start working on subsequent days:

```powershell
# 1. Navigate to ml-service
cd C:\Dev\ems-platform\apps\ml-service

# 2. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 3. Start service
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📚 Next Steps

1. ✅ Integrate with frontend dashboard
2. ✅ Add ML visualizations
3. ✅ Implement predictive maintenance
4. ✅ Add more ML features

---

**Need help?** Check the full README.md for detailed documentation!
