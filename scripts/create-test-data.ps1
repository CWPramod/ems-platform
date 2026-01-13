# EMS Platform - Comprehensive Test Data Creation Script (FIXED)
# Run this to populate the platform with realistic data for demo

Write-Host "Creating comprehensive test data for EMS Platform..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3100"

# ============================================================================
# STEP 1: Create Assets (CORRECTED FORMAT)
# ============================================================================

Write-Host "Creating 8 additional assets..." -ForegroundColor Yellow

$assets = @(
    @{
        name = "Core-Switch-01"
        type = "switch"
        ip = "192.168.1.10"
        location = "Data Center 1"
        tier = 1
        status = "online"
        owner = "network-team"
        vendor = "Cisco"
        model = "Nexus-9000"
        monitoringEnabled = $true
        tags = @("core", "critical")
        metadata = @{}
    },
    @{
        name = "App-Server-01"
        type = "server"
        ip = "192.168.2.100"
        location = "Data Center 2"
        tier = 1
        status = "online"
        owner = "app-team"
        vendor = "Dell"
        model = "PowerEdge R740"
        monitoringEnabled = $true
        tags = @("application", "production")
        metadata = @{ os = "Ubuntu 22.04"; ram = "64GB" }
    },
    @{
        name = "DB-Server-01"
        type = "server"
        ip = "192.168.2.101"
        location = "Data Center 2"
        tier = 1
        status = "online"
        owner = "database-team"
        vendor = "Dell"
        model = "PowerEdge R750"
        monitoringEnabled = $true
        tags = @("database", "critical")
        metadata = @{ os = "Ubuntu 22.04"; ram = "128GB"; db = "PostgreSQL 15" }
    },
    @{
        name = "Web-Server-01"
        type = "server"
        ip = "192.168.2.102"
        location = "Data Center 2"
        tier = 2
        status = "degraded"
        owner = "web-team"
        vendor = "HPE"
        model = "ProLiant DL380"
        monitoringEnabled = $true
        tags = @("web", "production")
        metadata = @{ os = "Ubuntu 22.04"; ram = "32GB" }
    },
    @{
        name = "Load-Balancer-01"
        type = "load_balancer"
        ip = "192.168.1.50"
        location = "Data Center 1"
        tier = 1
        status = "online"
        owner = "network-team"
        vendor = "F5"
        model = "BIG-IP"
        monitoringEnabled = $true
        tags = @("load-balancer", "critical")
        metadata = @{}
    },
    @{
        name = "Firewall-01"
        type = "firewall"
        ip = "192.168.1.254"
        location = "Data Center 1"
        tier = 1
        status = "online"
        owner = "security-team"
        vendor = "Palo Alto"
        model = "PA-5220"
        monitoringEnabled = $true
        tags = @("security", "critical")
        metadata = @{}
    },
    @{
        name = "Payment-API"
        type = "application"
        ip = "192.168.3.10"
        location = "Cloud - US-East"
        tier = 1
        status = "online"
        owner = "api-team"
        vendor = "Internal"
        model = $null
        monitoringEnabled = $true
        tags = @("api", "payment", "critical")
        metadata = @{ runtime = "Node.js"; version = "20.x" }
    },
    @{
        name = "User-Portal"
        type = "application"
        ip = "192.168.3.20"
        location = "Cloud - US-East"
        tier = 2
        status = "online"
        owner = "frontend-team"
        vendor = "Internal"
        model = $null
        monitoringEnabled = $true
        tags = @("frontend", "customer-facing")
        metadata = @{ runtime = "React"; version = "18.x" }
    }
)

$createdAssets = @()

foreach ($asset in $assets) {
    try {
        $body = $asset | ConvertTo-Json -Depth 10
        $result = Invoke-RestMethod -Uri "$baseUrl/assets" -Method POST -Body $body -ContentType "application/json"
        $createdAssets += $result
        Write-Host "  Created: $($asset.name)" -ForegroundColor Green
    } catch {
        Write-Host "  Failed: $($asset.name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Created $($createdAssets.Count) new assets" -ForegroundColor Green
Write-Host ""

# Get all assets
$allAssets = (Invoke-RestMethod -Uri "$baseUrl/assets").data

Write-Host "Total assets now: $($allAssets.Count)" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 2: Create Metrics
# ============================================================================

Write-Host "Creating metrics for all assets..." -ForegroundColor Yellow

$metricCount = 0
$now = Get-Date

foreach ($asset in $allAssets) {
    $assetType = $asset.type
    
    # Create 10 data points (last 10 hours)
    for ($i = 9; $i -ge 0; $i--) {
        $timestamp = $now.AddHours(-$i).ToString("o")
        
        # CPU Usage
        $cpuBase = if ($asset.status -eq "degraded") { 75 } else { 45 }
        $cpuValue = $cpuBase + (Get-Random -Minimum -5 -Maximum 10)
        
        if ($asset.name -eq "Web-Server-01" -and $i -eq 2) {
            $cpuValue = 95
        }
        
        $metric = @{
            assetId = $asset.id
            metricName = "cpu_usage"
            value = $cpuValue
            unit = "percent"
            source = "nms"
            timestamp = $timestamp
        } | ConvertTo-Json
        
        try {
            Invoke-RestMethod -Uri "$baseUrl/metrics" -Method POST -Body $metric -ContentType "application/json" | Out-Null
            $metricCount++
        } catch {}
        
        # Memory Usage
        $memBase = if ($assetType -eq "server") { 65 } else { 50 }
        $memValue = $memBase + (Get-Random -Minimum -3 -Maximum 8)
        
        $metric = @{
            assetId = $asset.id
            metricName = "memory_usage"
            value = $memValue
            unit = "percent"
            source = "nms"
            timestamp = $timestamp
        } | ConvertTo-Json
        
        try {
            Invoke-RestMethod -Uri "$baseUrl/metrics" -Method POST -Body $metric -ContentType "application/json" | Out-Null
            $metricCount++
        } catch {}
        
        # Network Latency
        if ($assetType -in @("router", "switch", "firewall", "load_balancer")) {
            $latencyValue = 12 + (Get-Random -Minimum -2 -Maximum 3) / 10
            
            $metric = @{
                assetId = $asset.id
                metricName = "network_latency"
                value = $latencyValue
                unit = "ms"
                source = "nms"
                timestamp = $timestamp
            } | ConvertTo-Json
            
            try {
                Invoke-RestMethod -Uri "$baseUrl/metrics" -Method POST -Body $metric -ContentType "application/json" | Out-Null
                $metricCount++
            } catch {}
        }
    }
    
    Write-Host "  Created metrics for: $($asset.name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Created $metricCount metrics" -ForegroundColor Green
Write-Host ""

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST DATA CREATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Assets:  $($allAssets.Count) total" -ForegroundColor White
Write-Host "  Metrics: $metricCount created" -ForegroundColor White
Write-Host "  Alerts:  9 total (from previous run)" -ForegroundColor White
Write-Host ""
Write-Host "Refresh your dashboard: http://localhost:5173/" -ForegroundColor Cyan
Write-Host ""