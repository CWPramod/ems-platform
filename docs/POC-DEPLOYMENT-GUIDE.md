PHASE 1: PRE-REQUISITES & PREPARATION
A. Client Infrastructure Requirements
Minimum Server Specs:

OS: Windows Server 2019+ or Ubuntu 20.04+
CPU: 4 cores
RAM: 8 GB
Disk: 50 GB SSD
Network: Static IP, ports 3100, 8000, 5173 open

Software Prerequisites:
✓ Node.js 18+ and npm
✓ Python 3.9+
✓ PostgreSQL 14+
✓ Git

B. Access Requirements from Client
1. Server Access:

RDP/SSH access to deployment server
Admin/sudo privileges
Firewall rules for required ports

2. Network Device Access:

SNMP community strings (v2c or v3 credentials)
IP addresses of all network devices
Read-only SNMP access

3. Server/Desktop Monitoring:

Windows: WMI access credentials
Linux: SSH access with key-based auth
Domain admin credentials (for AD environments)

4. Cloud Access (if applicable):

AWS: Access Key ID + Secret Access Key
Azure: Subscription ID + Credentials
GCP: Service Account JSON key

5. Application Monitoring:

Application endpoints/URLs
Health check endpoints
API access if available


PHASE 2: REMOTE SERVER SETUP
Step 1: Connect to Client Server
powershell# RDP to Windows Server
mstsc /v:CLIENT_SERVER_IP

# OR SSH to Linux Server
ssh admin@CLIENT_SERVER_IP

Step 2: Install Prerequisites
On Windows Server:
powershell# Install Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs-lts -y

# Install Python
choco install python --version=3.9.13 -y

# Install Git
choco install git -y

# Install PostgreSQL
choco install postgresql14 --params '/Password:YourSecurePassword123' -y

# Refresh environment
refreshenv
On Linux Server:
bash# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.9
sudo apt install -y python3.9 python3.9-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

Step 3: Configure PostgreSQL
sql-- Connect to PostgreSQL
psql -U postgres

-- Create database and user
CREATE DATABASE ems_platform;
CREATE USER ems_admin WITH ENCRYPTED PASSWORD 'ems_secure_password_2026';
GRANT ALL PRIVILEGES ON DATABASE ems_platform TO ems_admin;

-- Exit
\q
Configure PostgreSQL for remote access (if needed):
bash# Edit postgresql.conf
listen_addresses = 'localhost'  # Keep localhost for security

# Edit pg_hba.conf
# Add: local   all   ems_admin   md5

PHASE 3: DEPLOY EMS PLATFORM
Step 1: Transfer Code to Client Server
Option A: Git Clone (if you have private repo)
powershellcd C:\Applications  # or /opt/applications on Linux
git clone https://your-repo-url/ems-platform.git
cd ems-platform
Option B: File Transfer (Secure)
powershell# From your local machine, create deployment package
cd C:\Dev\ems-platform
git archive --format=zip --output=ems-platform-deployment.zip HEAD

# Transfer via SCP/SFTP/RDP
# Then extract on client server
Expand-Archive -Path ems-platform-deployment.zip -DestinationPath C:\Applications\ems-platform

Step 2: Configure Environment Variables
Create .env file in apps/api/:
bash# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=ems_admin
DATABASE_PASSWORD=ems_secure_password_2026
DATABASE_NAME=ems_platform

# Server
PORT=3100
NODE_ENV=production

# AWS (if using)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_CLIENT_KEY
AWS_SECRET_ACCESS_KEY=YOUR_CLIENT_SECRET

# Security (generate new secrets)
JWT_SECRET=generate-random-64-char-secret
API_KEY=generate-random-api-key

Step 3: Install Dependencies
powershell# Install API dependencies
cd C:\Applications\ems-platform\apps\api
npm install --production

# Install Web dependencies
cd C:\Applications\ems-platform\apps\web
npm install --production

# Install ML Service dependencies
cd C:\Applications\ems-platform\apps\ml-service
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate  # Linux
pip install -r requirements.txt

Step 4: Build Frontend
powershellcd C:\Applications\ems-platform\apps\web

# Update API URL in code if different
# Edit: src/services/api.ts
# Change: http://localhost:3100 → http://CLIENT_SERVER_IP:3100

# Build for production
npm run build

# This creates 'dist' folder with optimized files

Step 5: Start Services
Option A: Manual Start (for testing)
powershell# Window 1 - API
cd C:\Applications\ems-platform\apps\api
npm run start:prod

# Window 2 - ML Service
cd C:\Applications\ems-platform\apps\ml-service
.\venv\Scripts\Activate.ps1
python src\main.py

# Window 3 - Web (serve built files)
cd C:\Applications\ems-platform\apps\web
npx serve -s dist -l 5173
Option B: Production Deployment (recommended)
Use PM2 for Node.js process management:
powershell# Install PM2
npm install -g pm2

# Start API
cd C:\Applications\ems-platform\apps\api
pm2 start npm --name "ems-api" -- run start:prod

# Start ML Service (create run script)
pm2 start "python src/main.py" --name "ems-ml" --interpreter python --cwd C:\Applications\ems-platform\apps\ml-service

# Serve frontend
pm2 start "npx serve -s dist -l 5173" --name "ems-web" --cwd C:\Applications\ems-platform\apps\web

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## **PHASE 4: ONBOARD CLIENT DEVICES**

### **A. Network Devices (Routers, Switches, Firewalls)**

**1. Enable SNMP on Network Devices**

**Cisco Example:**
```
enable
configure terminal
snmp-server community PUBLIC_STRING ro
snmp-server host EMS_SERVER_IP version 2c PUBLIC_STRING
exit
write memory
2. Test SNMP Connectivity
powershell# Install SNMP tools
# Windows: snmpwalk from SNMP Tools
# Linux: sudo apt install snmp

# Test SNMP
snmpwalk -v2c -c PUBLIC_STRING DEVICE_IP system
3. Add Device to EMS via API
powershellcurl -X POST http://CLIENT_SERVER_IP:3100/assets `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Core-Switch-01",
    "type": "switch",
    "ip": "192.168.1.10",
    "location": "Data Center 1",
    "vendor": "Cisco",
    "model": "Catalyst 9300",
    "monitoringEnabled": true,
    "metadata": {
      "snmpCommunity": "PUBLIC_STRING",
      "snmpVersion": "2c",
      "interfaces": ["GigabitEthernet0/1", "GigabitEthernet0/2"]
    }
  }'

B. Windows Servers
1. Enable WMI Remote Access
On each Windows server to monitor:
powershell# Enable WMI through firewall
netsh advfirewall firewall set rule group="Windows Management Instrumentation (WMI)" new enable=yes

# Or specific rule
New-NetFirewallRule -DisplayName "WMI-In" -Direction Inbound -Protocol TCP -LocalPort 135 -Action Allow
2. Create Monitoring User
powershell# Create service account
net user emsmonitor SecurePass123! /add
net localgroup "Performance Monitor Users" emsmonitor /add
net localgroup "Distributed COM Users" emsmonitor /add
3. Test WMI Access
powershell# From EMS server
Get-WmiObject -Class Win32_OperatingSystem -ComputerName TARGET_SERVER -Credential (Get-Credential)
4. Add to EMS
powershellcurl -X POST http://CLIENT_SERVER_IP:3100/assets `
  -H "Content-Type: application/json" `
  -d '{
    "name": "App-Server-01",
    "type": "server",
    "ip": "192.168.1.50",
    "location": "Data Center 1",
    "vendor": "Microsoft",
    "model": "Windows Server 2019",
    "monitoringEnabled": true,
    "metadata": {
      "os": "Windows Server 2019",
      "monitoringProtocol": "WMI",
      "credentials": "encrypted_credential_id"
    }
  }'

C. Linux Servers
1. Setup SSH Key-Based Authentication
On EMS server:
bash# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ems_monitoring_key

# Copy to target servers
ssh-copy-id -i ~/.ssh/ems_monitoring_key.pub user@TARGET_SERVER
2. Create Monitoring User (on target)
bashsudo adduser emsmonitor
sudo usermod -aG sudo emsmonitor  # If elevated access needed
3. Test SSH Access
bashssh -i ~/.ssh/ems_monitoring_key emsmonitor@TARGET_SERVER "uptime"
4. Add to EMS
powershellcurl -X POST http://CLIENT_SERVER_IP:3100/assets `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Web-Server-01",
    "type": "server",
    "ip": "192.168.1.60",
    "location": "Data Center 1",
    "vendor": "Ubuntu",
    "model": "Ubuntu 20.04 LTS",
    "monitoringEnabled": true,
    "metadata": {
      "os": "Ubuntu 20.04",
      "monitoringProtocol": "SSH",
      "sshKeyPath": "/path/to/ems_monitoring_key"
    }
  }'

D. Cloud Instances (AWS/Azure)
1. AWS Setup
Create IAM user with read-only permissions:
json{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}
```

**2. Configure in EMS**

Update `.env`:
```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
3. Discover Cloud Resources
powershell# API automatically discovers EC2/RDS
curl http://CLIENT_SERVER_IP:3100/cloud/discover/all

E. Desktop Monitoring
For Windows Desktops:
Option 1: Agent-based (Recommended)

Deploy lightweight agent via Group Policy
Agent sends metrics to EMS API

Option 2: Agentless

Use WMI (same as Windows servers)
Requires firewall rules on each desktop

For Mac/Linux Desktops:

SSH-based monitoring
Or deploy custom agent


F. Application Monitoring
1. HTTP/HTTPS Endpoints
Add application for monitoring:
powershellcurl -X POST http://CLIENT_SERVER_IP:3100/apm/applications `
  -H "Content-Type: application/json" `
  -d '{
    "applicationName": "client-web-app",
    "healthEndpoint": "https://client-app.com/health",
    "monitoringInterval": 60
  }'
2. Custom Application with APM Agent
For Node.js apps:
javascript// Install agent
npm install ems-apm-agent

// In application code
const emsAPM = require('ems-apm-agent');
emsAPM.start({
  serviceName: 'client-web-app',
  serverUrl: 'http://EMS_SERVER:3100',
  apiKey: 'YOUR_API_KEY'
});
3. Database Monitoring
Connect to databases:
powershellcurl -X POST http://CLIENT_SERVER_IP:3100/assets `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Production-DB",
    "type": "database",
    "ip": "192.168.1.100",
    "vendor": "PostgreSQL",
    "monitoringEnabled": true,
    "metadata": {
      "port": 5432,
      "database": "production",
      "username": "monitoring_user",
      "monitorQueries": true
    }
  }'

PHASE 5: METRICS & TELEMETRY COLLECTION
A. Automatic Metric Collection
EMS automatically collects:
Network Devices (SNMP):

Interface statistics (bandwidth, errors, drops)
CPU/Memory utilization
Device uptime
Temperature sensors

Servers (WMI/SSH):

CPU usage
Memory usage
Disk I/O
Network traffic
Process list
Service status

Cloud (AWS APIs):

EC2 instance metrics
RDS database metrics
CloudWatch custom metrics

Applications (APM):

Response times
Error rates
Throughput
Transaction traces


B. Custom Metric Collection
Create Custom Collector Script:
python# custom_collector.py
import requests
import psutil
import time

EMS_API = "http://CLIENT_SERVER_IP:3100"
ASSET_ID = "your-asset-id"

while True:
    # Collect custom metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    
    # Send to EMS
    metrics = {
        "assetId": ASSET_ID,
        "timestamp": time.time(),
        "metrics": {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "custom_metric": your_custom_value
        }
    }
    
    requests.post(f"{EMS_API}/metrics", json=metrics)
    time.sleep(60)  # Collect every 60 seconds

C. Configure Data Collection Intervals
Edit in database or via API:
sql-- Set collection interval for asset
UPDATE assets 
SET metadata = jsonb_set(
  metadata, 
  '{collectionInterval}', 
  '60'::jsonb
)
WHERE id = 'asset-id';
```

---

## **PHASE 6: TESTING & VALIDATION**

### **Checklist:**
```
□ Access EMS dashboard: http://CLIENT_SERVER_IP:5173
□ Verify backend health indicators (green dots)
□ Check Dashboard shows all onboarded devices
□ Navigate to Assets page - see all devices
□ Navigate to Alerts page - verify alerts system
□ Navigate to Cloud page - see cloud resources
□ Navigate to APM page - see monitored applications
□ Test device metrics updating in real-time
□ Generate test alert (simulate device down)
□ Verify ML anomaly detection working
□ Check Cloud discovery refreshing
□ Test APM transaction tracking

PHASE 7: TROUBLESHOOTING
Common Issues:
1. Device Not Responding
powershell# Test connectivity
ping DEVICE_IP
telnet DEVICE_IP 161  # SNMP

# Check SNMP
snmpwalk -v2c -c COMMUNITY DEVICE_IP system
2. Metrics Not Updating
bash# Check logs
tail -f /var/log/ems/collector.log

# Verify database connection
psql -U ems_admin -d ems_platform -c "SELECT COUNT(*) FROM metrics;"
3. High CPU/Memory Usage
powershell# Check PM2 processes
pm2 list
pm2 logs ems-api

# Restart if needed
pm2 restart ems-api
```

---

## **PHASE 8: CLIENT HANDOFF**

### **Documentation to Provide:**

1. **Access Credentials**
   - Dashboard URL
   - Admin username/password
   - API keys

2. **Architecture Diagram**
   - Show monitored devices
   - Data flow
   - Network topology

3. **User Guide**
   - How to add new devices
   - How to configure alerts
   - How to generate reports

4. **Maintenance Guide**
   - Backup procedures
   - Update procedures
   - Troubleshooting steps

---

## **🎯 QUICK REFERENCE: POC TIMELINE**
```
Day 1 (4 hours):
  ✓ Server setup & prerequisites
  ✓ Deploy EMS platform
  ✓ Configure database

Day 2 (4 hours):
  ✓ Onboard 5-10 network devices
  ✓ Onboard 3-5 servers
  ✓ Configure SNMP/WMI

Day 3 (4 hours):
  ✓ Setup cloud monitoring
  ✓ Configure application monitoring
  ✓ Test & validate

Day 4 (2 hours):
  ✓ Client training
  ✓ Documentation
  ✓ Handoff
```

---

## **📋 PRE-POC CHECKLIST TO SEND CLIENT**
```
□ Server ready (specs, OS, admin access)
□ PostgreSQL installed or available
□ Network device IPs & SNMP strings
□ Server credentials (WMI/SSH)
□ Cloud API credentials (if applicable)
□ Application endpoints list
□ Firewall rules approved
□ Remote access credentials (RDP/SSH)
□ Point of contact for technical issues