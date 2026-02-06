# EMS Platform Deployment Guide

## Enterprise Deployment for 2000+ Devices

This guide covers deploying the EMS Platform in a production client environment to monitor approximately 2000 network devices.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Hardware Requirements](#3-hardware-requirements)
4. [Software Requirements](#4-software-requirements)
5. [Network Requirements](#5-network-requirements)
6. [Installation Steps](#6-installation-steps)
7. [Configuration](#7-configuration)
8. [Database Setup](#8-database-setup)
9. [SSL/TLS Configuration](#9-ssltls-configuration)
10. [Scaling Considerations](#10-scaling-considerations)
11. [Monitoring & Maintenance](#11-monitoring--maintenance)
12. [Backup & Recovery](#12-backup--recovery)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

### 1.1 Client Environment Checklist

Before deployment, ensure the following:

- [ ] Dedicated server(s) or VM(s) provisioned
- [ ] Network connectivity to all monitored devices
- [ ] SNMP access configured on target devices
- [ ] Firewall rules configured
- [ ] DNS entries created
- [ ] SSL certificates obtained
- [ ] License key obtained from CANARIS

### 1.2 Access Requirements

| Access Type | Purpose |
|-------------|---------|
| SSH/RDP to servers | Installation and maintenance |
| SNMP (UDP 161) | Device monitoring |
| PostgreSQL (TCP 5432/5433) | Database access |
| HTTPS (TCP 443) | Web interface |
| API (TCP 3100) | Backend API |

---

## 2. Architecture Overview

### 2.1 Recommended Production Architecture (2000 devices)

```
                                    ┌─────────────────┐
                                    │   Load Balancer │
                                    │   (nginx/HAProxy)│
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
             ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
             │  Web Server │          │  Web Server │          │  Web Server │
             │  (nginx)    │          │  (nginx)    │          │  (nginx)    │
             └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
             ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
             │  API Server │          │  API Server │          │  API Server │
             │  (NestJS)   │          │  (NestJS)   │          │  (NestJS)   │
             └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │                             │
                       ┌──────▼──────┐              ┌───────▼───────┐
                       │  PostgreSQL │              │   PostgreSQL  │
                       │   Primary   │◄────────────►│    Replica    │
                       └─────────────┘   Streaming  └───────────────┘
                                         Replication
```

### 2.2 Component Overview

| Component | Purpose | Instances |
|-----------|---------|-----------|
| Load Balancer | Traffic distribution, SSL termination | 1-2 (HA) |
| Web Servers | Serve React frontend | 2-3 |
| API Servers | NestJS backend, SNMP polling | 2-3 |
| PostgreSQL | Primary database | 1 Primary + 1 Replica |

---

## 3. Hardware Requirements

### 3.1 Minimum Requirements (2000 devices)

#### API Server (x2-3 instances)
| Resource | Specification |
|----------|---------------|
| CPU | 8 cores (Intel Xeon or AMD EPYC) |
| RAM | 16 GB |
| Storage | 100 GB SSD |
| Network | 1 Gbps NIC |

#### Database Server
| Resource | Specification |
|----------|---------------|
| CPU | 8 cores |
| RAM | 32 GB |
| Storage | 500 GB SSD (NVMe recommended) |
| Network | 1 Gbps NIC |

#### Web Server (x2-3 instances)
| Resource | Specification |
|----------|---------------|
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 50 GB SSD |
| Network | 1 Gbps NIC |

### 3.2 Recommended Requirements (2000+ devices with growth)

#### API Server (x3 instances)
| Resource | Specification |
|----------|---------------|
| CPU | 16 cores |
| RAM | 32 GB |
| Storage | 200 GB NVMe SSD |
| Network | 10 Gbps NIC |

#### Database Server (Primary)
| Resource | Specification |
|----------|---------------|
| CPU | 16 cores |
| RAM | 64 GB |
| Storage | 1 TB NVMe SSD (RAID 10) |
| Network | 10 Gbps NIC |

### 3.3 Storage Estimation

| Data Type | Size per Device/Day | 2000 Devices/Month |
|-----------|---------------------|---------------------|
| Metrics | ~5 MB | ~300 GB |
| Traffic Flows | ~2 MB | ~120 GB |
| Events/Alerts | ~500 KB | ~30 GB |
| Logs | ~1 MB | ~60 GB |
| **Total** | | **~510 GB/month** |

**Recommendation:** Plan for 2 TB storage with 12-month retention.

---

## 4. Software Requirements

### 4.1 Operating System

| OS | Version | Notes |
|----|---------|-------|
| Ubuntu Server | 22.04 LTS | Recommended |
| RHEL/CentOS | 8.x or 9.x | Enterprise support |
| Debian | 11 or 12 | Alternative |

### 4.2 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24.x+ | Container runtime |
| Docker Compose | 2.20+ | Container orchestration |
| Node.js | 20.x LTS | Runtime (if not using Docker) |
| PostgreSQL | 15.x | Database |
| nginx | 1.24+ | Reverse proxy / Load balancer |
| Git | 2.x | Deployment |

### 4.3 Installation Commands (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installations
docker --version
docker compose version
```

---

## 5. Network Requirements

### 5.1 Firewall Rules

#### Inbound Rules (EMS Servers)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 443 | TCP | Users | HTTPS Web Access |
| 80 | TCP | Users | HTTP (redirect to HTTPS) |
| 22 | TCP | Admin IPs | SSH Management |
| 5432 | TCP | API Servers | PostgreSQL (internal) |

#### Outbound Rules (EMS Servers)

| Port | Protocol | Destination | Purpose |
|------|----------|-------------|---------|
| 161 | UDP | Monitored Devices | SNMP Polling |
| 162 | UDP | EMS Server | SNMP Traps |
| 443 | TCP | Internet | License validation, updates |
| 53 | UDP/TCP | DNS Servers | Name resolution |

### 5.2 SNMP Configuration on Devices

Ensure all monitored devices have SNMP configured:

```
# Cisco IOS Example
snmp-server community <community-string> RO
snmp-server host <ems-server-ip> version 2c <community-string>

# Linux (net-snmp)
# /etc/snmp/snmpd.conf
rocommunity <community-string> <ems-server-ip>
```

### 5.3 Network Bandwidth Estimation

| Activity | Bandwidth per Device | 2000 Devices |
|----------|---------------------|--------------|
| SNMP Polling (30s interval) | ~2 Kbps | ~4 Mbps |
| SNMP Traps | ~0.5 Kbps | ~1 Mbps |
| **Total Network Load** | | **~5 Mbps** |

---

## 6. Installation Steps

### 6.1 Clone Repository

```bash
# On deployment server
cd /opt
sudo git clone https://github.com/CWPramod/ems-platform.git
cd ems-platform
```

### 6.2 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 6.3 Environment Variables

```bash
# .env file
NODE_ENV=production
API_PORT=3100
WEB_PORT=80

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=ems_platform
DATABASE_USER=ems_admin
DATABASE_PASSWORD=<strong-password-here>

# Security (REQUIRED - use strong random values!)
JWT_SECRET=<64-character-random-string>
LICENSE_SIGNING_SECRET=<64-character-random-string>

# SNMP - controls how device metrics are collected
# 'simulation' = generate simulated SNMP data (for testing)
# 'production' = collect real SNMP data from devices
SNMP_MODE=production

# Data Mode - controls simulation services (security events, alerts)
# 'demo' = generate fake events/alerts for demos
# 'production' = only real data, no simulated security events
DATA_MODE=production

# CORS (production domains)
CORS_ORIGINS=https://ems.yourdomain.com

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

Generate secure secrets:
```bash
# Generate JWT_SECRET
openssl rand -base64 48

# Generate LICENSE_SIGNING_SECRET
openssl rand -base64 48
```

### 6.4 Deploy with Docker Compose

```bash
# Build and start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps

# View logs
docker compose logs -f api
```

### 6.5 Initialize Database

```bash
# Run migrations
docker compose exec api npm run migration:run

# Seed initial data (optional - for testing)
docker compose exec api npm run seed
```

### 6.6 Verify Deployment

```bash
# Check API health
curl -k https://localhost/api/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## 7. Configuration

### 7.1 License Activation

1. Log in to EMS Platform as admin
2. Navigate to **License** menu
3. Enter your license key: `CANARIS-SUB-EMS-XXXXXXXX-XXXXXX-XXXX`
4. Click **Activate**

License tiers:
| Tier | Max Devices | Features |
|------|-------------|----------|
| EMS_BASIC | 500 | Core monitoring |
| EMS_STANDARD | 1000 | + Reports, Alerts |
| EMS_FULL | 2500 | + Security, APM, Cloud |
| EMS_ENTERPRISE | Unlimited | + Custom features |

### 7.2 Add Devices

#### Option A: Bulk Import (Recommended for 2000 devices)

1. Prepare CSV file:
```csv
name,type,ip,location,tier,vendor,model
core-rtr-01,router,10.0.0.1,DC1-Rack-A1,1,Cisco,ISR 4451
dist-sw-01,switch,10.0.1.1,DC1-Rack-B1,2,Cisco,C9300
```

2. Navigate to **Masters > Devices**
3. Click **Bulk Upload**
4. Upload CSV file

#### Option B: Network Discovery

1. Navigate to **Masters > Devices**
2. Click **Scan Network**
3. Enter IP range: `10.0.0.1 - 10.0.255.254`
4. Configure SNMP community string
5. Start scan
6. Select discovered devices and import

### 7.3 Configure Thresholds

Navigate to **Masters > Thresholds** to customize alerting:

| KPI | Warning | Critical |
|-----|---------|----------|
| CPU Usage | 80% | 95% |
| Memory Usage | 85% | 95% |
| Bandwidth Utilization | 80% | 95% |
| Packet Loss | 1% | 5% |
| Latency | 50ms | 100ms |

### 7.4 Data Mode Configuration (Demo vs Production)

The EMS Platform supports two data modes controlled by the `DATA_MODE` environment variable:

#### Mode Comparison

| Mode | `DATA_MODE` | `SNMP_MODE` | Use Case |
|------|-------------|-------------|----------|
| **Demo** | `demo` | `simulation` | Client demos, testing, development |
| **Production** | `production` | `production` | Real network monitoring |

#### What Each Mode Controls

| Service | Demo Mode (`DATA_MODE=demo`) | Production Mode (`DATA_MODE=production`) |
|---------|------------------------------|------------------------------------------|
| **Security Simulator** | Generates fake IOC matches, signature alerts, DDoS events every 2-5 minutes | **Disabled** - No simulated security events |
| **Traffic Flow Generator** | Generates simulated traffic flows for Top Talkers | Only aggregates real SNMP bandwidth data |
| **Alert Generator** | Runs (monitors simulated health data) | Runs (monitors real SNMP health data) |
| **SNMP Monitor** | Generates simulated device metrics | Collects real SNMP data from devices |

#### Switching Modes

**For Client Demos:**
```bash
# .env file
DATA_MODE=demo
SNMP_MODE=simulation
```
This generates realistic-looking demo data across all modules:
- Dashboard shows active devices with varying health
- Security page shows IOC matches, signature alerts, DDoS events
- Top Talkers shows traffic between simulated devices
- Alerts are generated based on threshold violations

**For Production Deployment:**
```bash
# .env file
DATA_MODE=production
SNMP_MODE=production
```
This ensures:
- Only real SNMP data is collected from actual network devices
- No fake security events are generated
- Alerts are based on actual device health metrics
- Traffic data is aggregated from real SNMP bandwidth counters

#### Services Behavior Matrix

```
┌─────────────────────────┬────────────────────────────┬────────────────────────────┐
│ Service                 │ DATA_MODE=demo             │ DATA_MODE=production       │
├─────────────────────────┼────────────────────────────┼────────────────────────────┤
│ SecuritySimulatorService│                            │                            │
│  - simulateIocMatches() │ Runs every 3 min           │ SKIPPED                    │
│  - simulateSignatureAl..│ Runs every 30 sec          │ SKIPPED                    │
│  - simulateDdosEvents() │ Runs every 2 min           │ SKIPPED                    │
│  - updateSslCertificat..│ Runs every 5 min           │ Runs every 5 min           │
├─────────────────────────┼────────────────────────────┼────────────────────────────┤
│ TrafficFlowGeneratorSer.│                            │                            │
│  - generateTrafficFlows │ Generates simulated flows  │ Aggregates real traffic    │
├─────────────────────────┼────────────────────────────┼────────────────────────────┤
│ AlertGeneratorService   │                            │                            │
│  - checkForAlerts()     │ Monitors health data       │ Monitors health data       │
├─────────────────────────┼────────────────────────────┼────────────────────────────┤
│ SnmpMonitorService      │                            │                            │
│  - pollDevices()        │ Controlled by SNMP_MODE    │ Controlled by SNMP_MODE    │
└─────────────────────────┴────────────────────────────┴────────────────────────────┘
```

#### Verifying Current Mode

Check the API logs on startup:
```bash
docker compose logs api | grep "initialized"

# Expected output:
# Security Simulator initialized in DEMO mode
# Traffic Flow Generator initialized - SNMP_MODE: SIMULATION, DATA_MODE: DEMO
# Alert Generator initialized in DEMO mode
# SNMP Monitor initialized in SIMULATION mode
```

---

## 8. Database Setup

### 8.1 PostgreSQL Tuning (32GB RAM)

Edit `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Memory
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 64MB
maintenance_work_mem = 2GB

# Connections
max_connections = 200

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200
```

### 8.2 Connection Pooling (PgBouncer)

For high-load environments, add PgBouncer:

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
ems_platform = host=localhost port=5432 dbname=ems_platform

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
```

### 8.3 Database Maintenance

```bash
# Add to crontab
# Daily vacuum at 2 AM
0 2 * * * docker compose exec -T postgres vacuumdb -U ems_admin -d ems_platform -z

# Weekly full vacuum on Sunday at 3 AM
0 3 * * 0 docker compose exec -T postgres vacuumdb -U ems_admin -d ems_platform -f
```

---

## 9. SSL/TLS Configuration

### 9.1 Obtain SSL Certificate

#### Option A: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d ems.yourdomain.com

# Certificates saved to:
# /etc/letsencrypt/live/ems.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/ems.yourdomain.com/privkey.pem
```

#### Option B: Commercial Certificate
Place certificate files in `/opt/ems-platform/nginx/ssl/`:
- `certificate.crt`
- `private.key`
- `ca-bundle.crt`

### 9.2 Nginx SSL Configuration

Create `/opt/ems-platform/nginx/nginx.conf`:

```nginx
upstream api_servers {
    least_conn;
    server api:3100;
    # Add more API servers for load balancing
    # server api2:3100;
    # server api3:3100;
}

upstream web_servers {
    least_conn;
    server web:80;
}

server {
    listen 80;
    server_name ems.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ems.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://api_servers/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://web_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 10. Scaling Considerations

### 10.1 Horizontal Scaling

| Devices | API Instances | DB Config |
|---------|---------------|-----------|
| 500 | 1 | Single node |
| 1000 | 2 | Single node |
| 2000 | 3 | Primary + Replica |
| 5000 | 5 | Primary + 2 Replicas |
| 10000+ | 8+ | Clustered (Patroni) |

### 10.2 SNMP Polling Optimization

For 2000 devices with 30-second polling interval:

```
Polls per second = 2000 devices / 30 seconds = ~67 polls/second
```

Distribute across API instances:
- 3 API instances = ~22 polls/second each (comfortable)

### 10.3 Metrics Retention Policy

Configure data retention in `apps/api/src/config`:

```typescript
// Retention periods
const RETENTION = {
  raw_metrics: '7 days',      // Full resolution
  hourly_aggregates: '30 days',
  daily_aggregates: '1 year',
  monthly_aggregates: '5 years',
};
```

---

## 11. Monitoring & Maintenance

### 11.1 Health Checks

```bash
# API health
curl -s https://ems.yourdomain.com/api/ | jq

# Database connections
docker compose exec postgres psql -U ems_admin -c "SELECT count(*) FROM pg_stat_activity;"

# Container status
docker compose ps
```

### 11.2 Log Management

```bash
# View API logs
docker compose logs -f api --tail=100

# Log rotation (add to /etc/logrotate.d/ems)
/var/log/ems/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

### 11.3 Performance Monitoring

Monitor these key metrics:
- API response time (< 200ms)
- Database query time (< 100ms)
- SNMP poll success rate (> 99%)
- Memory usage (< 80%)
- CPU usage (< 70%)

---

## 12. Backup & Recovery

### 12.1 Database Backup

```bash
#!/bin/bash
# /opt/ems-platform/scripts/backup.sh

BACKUP_DIR=/backup/ems
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
docker compose exec -T postgres pg_dump -U ems_admin -Fc ems_platform > $BACKUP_DIR/ems_$DATE.dump

# Keep last 7 days
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete

echo "Backup completed: ems_$DATE.dump"
```

Add to crontab:
```bash
# Daily backup at 1 AM
0 1 * * * /opt/ems-platform/scripts/backup.sh >> /var/log/ems-backup.log 2>&1
```

### 12.2 Restore Procedure

```bash
# Stop services
docker compose stop api web

# Restore database
docker compose exec -T postgres pg_restore -U ems_admin -d ems_platform -c < backup_file.dump

# Start services
docker compose start api web
```

### 12.3 Disaster Recovery

| RPO | RTO | Strategy |
|-----|-----|----------|
| 1 hour | 4 hours | Daily backups + streaming replication |
| 15 min | 1 hour | Continuous archiving (WAL) |
| Near-zero | 15 min | Synchronous replication + auto-failover |

---

## 13. Troubleshooting

### 13.1 Common Issues

#### API Not Starting
```bash
# Check logs
docker compose logs api

# Common causes:
# - Database connection failed
# - Missing environment variables
# - Port already in use
```

#### SNMP Polling Failures
```bash
# Test SNMP connectivity
snmpwalk -v2c -c <community> <device-ip> sysDescr

# Check firewall
sudo ufw status
sudo iptables -L -n | grep 161
```

#### High Memory Usage
```bash
# Check container memory
docker stats

# Increase Node.js heap size
# In docker-compose.yml:
environment:
  NODE_OPTIONS: "--max-old-space-size=4096"
```

#### Slow Dashboard
```bash
# Check slow queries
docker compose exec postgres psql -U ems_admin -c "
  SELECT query, calls, mean_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;"

# Add missing indexes
docker compose exec api npm run migration:run
```

### 13.2 Support Contacts

| Issue Type | Contact |
|------------|---------|
| License Issues | license@canaris.io |
| Technical Support | support@canaris.io |
| Security Issues | security@canaris.io |

---

## Appendix A: Quick Reference Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f [service]

# Restart a service
docker compose restart api

# Scale API servers
docker compose up -d --scale api=3

# Run migrations
docker compose exec api npm run migration:run

# Access database
docker compose exec postgres psql -U ems_admin -d ems_platform

# Backup database
docker compose exec -T postgres pg_dump -U ems_admin -Fc ems_platform > backup.dump
```

---

## Appendix B: Checklist

### Pre-Deployment
- [ ] Hardware provisioned per requirements
- [ ] Operating system installed and updated
- [ ] Docker and Docker Compose installed
- [ ] Network connectivity verified
- [ ] Firewall rules configured
- [ ] SSL certificates obtained
- [ ] DNS configured
- [ ] License key obtained

### Deployment
- [ ] Repository cloned
- [ ] Environment configured
- [ ] Docker images built
- [ ] Services started
- [ ] Database initialized
- [ ] License activated
- [ ] Admin password changed
- [ ] Devices imported

### Post-Deployment
- [ ] All devices showing in dashboard
- [ ] SNMP polling working
- [ ] Alerts configured
- [ ] Backups scheduled
- [ ] Monitoring configured
- [ ] Documentation provided to client

---

*Document Version: 1.0*
*Last Updated: February 2026*
*CANARIS Networks Pvt. Ltd.*
