# EMS POC Quick Start Guide

## Pre-POC Client Checklist
- [ ] Server access (RDP/SSH with admin privileges)
- [ ] PostgreSQL 14+ available
- [ ] Node.js 18+ available
- [ ] Python 3.9+ available
- [ ] Network device SNMP strings
- [ ] Server credentials (WMI for Windows / SSH for Linux)
- [ ] Cloud API keys (AWS/Azure/GCP if needed)
- [ ] Firewall ports open: 3100, 8000, 5173

---

## Quick Deploy Steps

### 1. Install Prerequisites
**Windows Server:**
```powershell
choco install nodejs-lts python git postgresql14 -y
```

**Linux Server:**
```bash
sudo apt update
sudo apt install -y nodejs npm python3.9 python3-pip git postgresql
```

### 2. Deploy EMS Code
```powershell
cd C:\Applications  # or /opt/applications on Linux
git clone <your-repo> ems-platform
cd ems-platform
```

### 3. Configure Environment
```powershell
# Create apps/api/.env file with:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=ems_admin
DATABASE_PASSWORD=ems_secure_password_2026
DATABASE_NAME=ems_platform
PORT=3100
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<client-key>
AWS_SECRET_ACCESS_KEY=<client-secret>
```

### 4. Install Dependencies
```powershell
# API
cd apps/api
npm install --production

# Web
cd ../web
npm install --production
npm run build

# ML Service
cd ../ml-service
python -m venv venv
.\venv\Scripts\Activate.ps1  # or source venv/bin/activate on Linux
pip install -r requirements.txt
```

### 5. Start Services (Production)
```powershell
# Install PM2
npm install -g pm2

# Start API
cd apps/api
pm2 start npm --name "ems-api" -- run start:prod

# Start ML Service
pm2 start "python src/main.py" --name "ems-ml" --interpreter python --cwd apps/ml-service

# Serve Frontend
pm2 start "npx serve -s dist -l 5173" --name "ems-web" --cwd apps/web

# Save & auto-start
pm2 save
pm2 startup
```

---

## Device Onboarding Quick Reference

### Network Device (SNMP)
```powershell
curl -X POST http://SERVER:3100/assets -H "Content-Type: application/json" -d '{
  "name": "Core-Switch-01",
  "type": "switch",
  "ip": "192.168.1.10",
  "location": "Data Center 1",
  "vendor": "Cisco",
  "model": "Catalyst 9300",
  "monitoringEnabled": true,
  "metadata": {
    "snmpCommunity": "public",
    "snmpVersion": "2c"
  }
}'
```

### Windows Server (WMI)
**Enable WMI on target server:**
```powershell
netsh advfirewall firewall set rule group="Windows Management Instrumentation (WMI)" new enable=yes
```

**Add to EMS:**
```powershell
curl -X POST http://SERVER:3100/assets -H "Content-Type: application/json" -d '{
  "name": "App-Server-01",
  "type": "server",
  "ip": "192.168.1.50",
  "vendor": "Microsoft",
  "model": "Windows Server 2019",
  "monitoringEnabled": true,
  "metadata": {
    "os": "Windows Server 2019",
    "monitoringProtocol": "WMI"
  }
}'
```

### Linux Server (SSH)
**Setup SSH key:**
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ems_key
ssh-copy-id -i ~/.ssh/ems_key.pub user@TARGET_SERVER
```

**Add to EMS:**
```powershell
curl -X POST http://SERVER:3100/assets -H "Content-Type: application/json" -d '{
  "name": "Web-Server-01",
  "type": "server",
  "ip": "192.168.1.60",
  "vendor": "Ubuntu",
  "model": "Ubuntu 20.04 LTS",
  "monitoringEnabled": true,
  "metadata": {
    "os": "Ubuntu 20.04",
    "monitoringProtocol": "SSH"
  }
}'
```

### Cloud Resources (AWS)
**Add credentials to .env:**
```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

**Auto-discover:**
```powershell
curl http://SERVER:3100/cloud/discover/all
```

### Application Monitoring (APM)
```powershell
# Health check monitoring
curl http://SERVER:3100/apm/applications
```

---

## Access URLs

- **Dashboard:** http://SERVER_IP:5173
- **API:** http://SERVER_IP:3100
- **ML Service:** http://SERVER_IP:8000

---

## Quick Troubleshooting

### Services Not Starting
```powershell
# Check PM2 status
pm2 list
pm2 logs ems-api
pm2 restart ems-api
```

### SNMP Not Working
```powershell
# Test connectivity
ping DEVICE_IP
telnet DEVICE_IP 161

# Test SNMP
snmpwalk -v2c -c public DEVICE_IP system
```

### Database Connection Failed
```powershell
# Test PostgreSQL
psql -U ems_admin -d ems_platform -h localhost

# Check if running
# Windows: services.msc (look for PostgreSQL)
# Linux: sudo systemctl status postgresql
```

### Firewall Issues
```powershell
# Windows: Open ports
New-NetFirewallRule -DisplayName "EMS-API" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow
New-NetFirewallRule -DisplayName "EMS-ML" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
New-NetFirewallRule -DisplayName "EMS-Web" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow

# Linux: Open ports
sudo ufw allow 3100/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 5173/tcp
```

### Backend Health Check
```powershell
# Test APIs
curl http://localhost:3100/assets
curl http://localhost:8000/health
```

---

## POC Timeline

**Day 1 (4 hours):**
- ✓ Server setup & prerequisites
- ✓ Deploy EMS platform
- ✓ Configure database
- ✓ Start services

**Day 2 (4 hours):**
- ✓ Onboard 5-10 network devices
- ✓ Onboard 3-5 servers
- ✓ Configure SNMP/WMI/SSH

**Day 3 (4 hours):**
- ✓ Setup cloud monitoring
- ✓ Configure application monitoring
- ✓ Test & validate all features

**Day 4 (2 hours):**
- ✓ Client training
- ✓ Documentation handoff
- ✓ Support transition

---

## Support Contacts

**During POC:**
- Technical Lead: [Your Name]
- Email: [Your Email]
- Phone: [Your Phone]

**For Detailed Info:**
- See: docs/POC-DEPLOYMENT-GUIDE.md

---

## Post-POC Checklist

- [ ] All devices onboarded and monitored
- [ ] Dashboard accessible to client
- [ ] Alerts configured and tested
- [ ] Client trained on basic operations
- [ ] Documentation provided
- [ ] Support handoff completed
- [ ] Backup procedures documented
- [ ] Client credentials changed from defaults