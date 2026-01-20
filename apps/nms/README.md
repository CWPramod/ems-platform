# NMS Module - Architecture-Aligned Version

## 🎯 What is This?

This is the **architecture-aligned** NMS (Network Management System) module that integrates seamlessly with your existing EMS Core platform following the design specified in **SYSTEM_DESIGN.md**.

### Key Features
✅ **No Database** - Uses EMS Core Assets API  
✅ **Event-Driven** - Creates Events in EMS Core, not standalone alerts  
✅ **Integrated Auth** - Uses EMS Core authentication  
✅ **Proper Port** - Runs on 3001 as per architecture  
✅ **SNMP Polling** - Monitors network devices (routers, switches, firewalls)  
✅ **Metric Collection** - CPU, memory, uptime tracking  
✅ **Threshold Monitoring** - Auto-creates events when thresholds exceeded  

---

## 📋 Quick Start

### Prerequisites
- EMS Core running on http://localhost:3100
- PostgreSQL with Assets and Events tables
- Node.js v18+
- Network devices with SNMP enabled

### Installation

```bash
# 1. Navigate to NMS directory
cd C:\Dev\ems-platform\apps\nms

# 2. Install dependencies
npm install

# 3. Configure environment
copy .env.example .env
# Edit .env: Set EMS_CORE_URL=http://localhost:3100

# 4. Start NMS
npm run start:dev
```

### Add Network Devices

```bash
# Add devices to EMS Core (not to NMS!)
curl -X POST http://localhost:3100/api/v1/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Core Router 1",
    "type": "network_device",
    "ipAddress": "192.168.1.1",
    "status": "active",
    "metadata": {
      "snmpCommunity": "public",
      "snmpVersion": "2c",
      "snmpPort": 161,
      "deviceType": "router"
    }
  }'
```

---

## 🏗️ Architecture

```
NMS Module (Port 3001)
    │
    ├─→ GET localhost:3100/api/v1/assets  (fetch devices)
    ├─→ SNMP poll devices
    ├─→ POST localhost:3100/api/v1/events (when issues found)
    └─→ POST localhost:3100/api/v1/metrics (send metrics)

EMS Core (Port 3100)
    │
    ├─→ Provides Assets to poll
    ├─→ Receives Events from NMS
    ├─→ Creates Alerts
    └─→ Publishes to Redis Stream → ML Service processes
```

---

## 🔄 How It Works

### Polling Cycle (Every 5 Minutes)
1. Fetch network devices from EMS Core Assets API
2. Poll each device via SNMP
3. If device unreachable → Create "Device Unreachable" event in EMS Core
4. If device reachable → Update asset metadata with device info

### Metric Collection (Every 1 Minute)
1. Collect metrics from reachable devices (CPU, memory, uptime)
2. Check thresholds:
   - CPU > 80% → Create warning event
   - Memory > 85% → Create warning event
3. Send all metrics to EMS Core

---

## 📊 API Endpoints

```
GET  /health            - Health check
GET  /nms/status        - NMS module status
POST /nms/discover      - Trigger manual discovery
GET  /nms/metrics       - Current metrics summary
```

---

## 🧪 Testing

```bash
# Check health
curl http://localhost:3001/health

# View status
curl http://localhost:3001/nms/status

# Trigger discovery
curl -X POST http://localhost:3001/nms/discover

# View events created by NMS
curl http://localhost:3100/api/v1/events?source=nms
```

---

## 📚 Documentation

- **NMS-INTEGRATED-GUIDE.md** - Complete integration guide
- **COMPARISON.md** - Standalone vs Integrated comparison
- **.env.example** - Configuration template

---

## 🔧 Configuration

Edit `.env`:
```bash
NMS_PORT=3001
EMS_CORE_URL=http://localhost:3100
DEFAULT_SNMP_COMMUNITY=public
DEFAULT_SNMP_VERSION=2c
POLL_INTERVAL_MINUTES=5
```

---

## 🐛 Troubleshooting

### "EMS Core is not reachable"
- Check if EMS Core is running: `curl http://localhost:3100/health`
- Verify EMS_CORE_URL in `.env`

### "No network assets found"
- Add network devices to EMS Core Assets (see Quick Start)
- Verify: `curl http://localhost:3100/api/v1/assets?type=network_device`

### SNMP timeout errors
- Verify device is reachable: `ping <device-ip>`
- Check SNMP is enabled on device
- Test manually: `snmpwalk -v2c -c public <device-ip> system`

---

## 🎯 Integration Points

### With EMS Core
- **Assets API** - Source of truth for devices
- **Events API** - Sends all detected issues
- **Metrics API** - Sends performance data
- **Authentication** - Uses Core's JWT tokens

### With ML Service
- Events flow through EMS Core → Redis → ML
- Root cause analysis applied to NMS events
- Business impact scoring calculated

### With ITSM Service
- Critical NMS events auto-create tickets
- SLA tracking for device outages

---

## ✅ Architecture Compliance

| Requirement | Status |
|------------|--------|
| Port 3001 | ✅ |
| No own database | ✅ |
| Uses EMS Core Assets | ✅ |
| Creates Events not Alerts | ✅ |
| Uses EMS Core Auth | ✅ |
| SNMP polling | ✅ |
| Metric collection | ✅ |

---

## 📦 What's Included

```
nms-integrated/
├── src/
│   ├── main.ts                     # Entry point
│   ├── nms.module.ts               # Module config
│   ├── ems-core/
│   │   └── ems-core.client.ts     # EMS Core API client
│   ├── snmp/
│   │   └── snmp-polling.service.ts # SNMP operations
│   └── nms/
│       ├── nms.controller.ts       # API endpoints
│       └── nms-orchestration.service.ts # Main logic
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
└── README.md (this file)
```

---

## 🚀 Production Deployment

```bash
# Build
npm run build

# Start production
npm run start:prod
```

For Docker deployment, see Docker configuration in project root.

---

## 📞 Support

For detailed integration instructions, see **NMS-INTEGRATED-GUIDE.md**.

For comparison with standalone version, see **COMPARISON.md**.

---

**Version**: 1.0.0  
**Architecture**: Integrated with EMS Core  
**Port**: 3001  
**Database**: None (uses EMS Core APIs)  

Happy Monitoring! 🌐
