#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Configure & Launch (Client Server)
# ═══════════════════════════════════════════════════════════════════════════════
#
# One-shot script to configure, start, and initiate discovery on a fresh deploy.
#
# Usage:
#   Interactive:
#     ./configure-and-launch.sh
#
#   Non-interactive (all arguments):
#     ./configure-and-launch.sh \
#       --community bankro \
#       --subnets "10.0.1.0/24,192.168.1.0/24" \
#       --server-ip 10.0.1.50
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Images loaded (via load-images.sh)
#   - docker-compose.prod.yml and .env.template in the current directory
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

# ─── Parse arguments ─────────────────────────────────────────────────────────

SNMP_COMMUNITY=""
DISCOVERY_SUBNETS=""
SERVER_IP=""
INVENTORY_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --community)     SNMP_COMMUNITY="$2"; shift 2 ;;
    --subnets)       DISCOVERY_SUBNETS="$2"; shift 2 ;;
    --server-ip)     SERVER_IP="$2"; shift 2 ;;
    --inventory)     INVENTORY_FILE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--community STRING] [--subnets CIDRS] [--server-ip IP] [--inventory PATH]"
      echo ""
      echo "Options:"
      echo "  --community    SNMP community string (default: public)"
      echo "  --subnets      Comma-separated CIDRs for auto-discovery"
      echo "  --server-ip    This server's IP for dashboard URL display"
      echo "  --inventory    Path to branch inventory JSON file for static IP deployment"
      echo "                 (assets are pre-registered; run discovery later when SNMP strings are available)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Pre-flight checks ───────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  EMS Platform — Configure & Launch${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  fail "Docker is not installed. Please install Docker first."
  exit 1
fi

if ! docker info &> /dev/null; then
  fail "Docker daemon is not running or current user lacks permissions."
  exit 1
fi

# Check Docker Compose (v2 plugin or standalone)
COMPOSE_CMD=""
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  fail "Docker Compose is not installed."
  exit 1
fi
ok "Docker Compose: ${COMPOSE_CMD}"

# Check compose file
if [ ! -f "docker-compose.prod.yml" ]; then
  fail "docker-compose.prod.yml not found in current directory."
  exit 1
fi

# ─── Create .env if it doesn't exist ─────────────────────────────────────────

if [ ! -f ".env" ]; then
  if [ -f ".env.template" ]; then
    info "Creating .env from template..."
    cp .env.template .env

    # Auto-generate secrets
    DB_PASS=$(openssl rand -base64 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 24)
    JWT_SEC=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48)
    LIC_SEC=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48)
    ITSM_KEY=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p | head -c 32)

    sed -i "s|^DATABASE_PASSWORD=.*|DATABASE_PASSWORD=${DB_PASS}|" .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SEC}|" .env
    sed -i "s|^LICENSE_SIGNING_SECRET=.*|LICENSE_SIGNING_SECRET=${LIC_SEC}|" .env
    sed -i "s|^ITSM_MODULE_API_KEY=.*|ITSM_MODULE_API_KEY=${ITSM_KEY}|" .env

    ok "Generated secure passwords and secrets"
  else
    fail ".env.template not found. Cannot create .env."
    exit 1
  fi
else
  ok "Using existing .env file"
fi

# ─── Prompt for configuration ────────────────────────────────────────────────

echo ""
info "Configuring deployment parameters..."
echo ""

# SNMP Community
if [ -z "$SNMP_COMMUNITY" ]; then
  CURRENT=$(grep '^SNMP_COMMUNITY=' .env 2>/dev/null | cut -d= -f2)
  read -rp "  SNMP community string [${CURRENT:-public}]: " SNMP_COMMUNITY
  SNMP_COMMUNITY="${SNMP_COMMUNITY:-${CURRENT:-public}}"
fi

# Discovery Subnets
if [ -z "$DISCOVERY_SUBNETS" ]; then
  CURRENT=$(grep '^DISCOVERY_SUBNETS=' .env 2>/dev/null | cut -d= -f2)
  echo "  Enter CIDR subnets for auto-discovery (comma-separated)"
  read -rp "  Example: 10.0.1.0/24,192.168.1.0/24 [${CURRENT:-none}]: " DISCOVERY_SUBNETS
  DISCOVERY_SUBNETS="${DISCOVERY_SUBNETS:-${CURRENT}}"
fi

# Server IP
if [ -z "$SERVER_IP" ]; then
  # Try to auto-detect
  DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  read -rp "  Server IP for dashboard URL [${DETECTED_IP:-localhost}]: " SERVER_IP
  SERVER_IP="${SERVER_IP:-${DETECTED_IP:-localhost}}"
fi

WEB_PORT=$(grep '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2)
WEB_PORT="${WEB_PORT:-80}"

# ─── Update .env ──────────────────────────────────────────────────────────────

info "Writing configuration to .env..."

sed -i "s|^SNMP_COMMUNITY=.*|SNMP_COMMUNITY=${SNMP_COMMUNITY}|" .env
sed -i "s|^DISCOVERY_SUBNETS=.*|DISCOVERY_SUBNETS=${DISCOVERY_SUBNETS}|" .env

ok "SNMP_COMMUNITY=${SNMP_COMMUNITY}"
ok "DISCOVERY_SUBNETS=${DISCOVERY_SUBNETS:-<none>}"
ok "SERVER_IP=${SERVER_IP}"

# ─── Launch services ──────────────────────────────────────────────────────────

echo ""
info "Starting EMS Platform services..."
echo ""

${COMPOSE_CMD} -f docker-compose.prod.yml up -d

echo ""

# ─── Wait for services to be healthy ─────────────────────────────────────────

HEALTH_ENDPOINTS=(
  "http://localhost:3100/:API"
  "http://localhost:3001/health:NMS"
  "http://localhost:3005/:ITSM"
  "http://localhost:8000/api/v1/health:ML"
  "http://localhost:${WEB_PORT}/:Frontend"
)

TIMEOUT=120
INTERVAL=5
ELAPSED=0

info "Waiting for services to become healthy (timeout: ${TIMEOUT}s)..."
echo ""

all_healthy() {
  for entry in "${HEALTH_ENDPOINTS[@]}"; do
    URL="${entry%%:*}"
    if ! curl -sf --max-time 3 "$URL" > /dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

while [ $ELAPSED -lt $TIMEOUT ]; do
  HEALTHY_COUNT=0
  TOTAL=${#HEALTH_ENDPOINTS[@]}

  for entry in "${HEALTH_ENDPOINTS[@]}"; do
    URL="${entry%%:*}"
    NAME="${entry##*:}"
    if curl -sf --max-time 3 "$URL" > /dev/null 2>&1; then
      HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
    fi
  done

  printf "\r  Services healthy: ${HEALTHY_COUNT}/${TOTAL}  (${ELAPSED}s elapsed)"

  if [ "$HEALTHY_COUNT" -eq "$TOTAL" ]; then
    echo ""
    echo ""
    ok "All services are healthy!"
    break
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo ""
  echo ""
  warn "Timeout reached. Checking individual services..."
  echo ""
  for entry in "${HEALTH_ENDPOINTS[@]}"; do
    URL="${entry%%:*}"
    NAME="${entry##*:}"
    if curl -sf --max-time 3 "$URL" > /dev/null 2>&1; then
      ok "${NAME} — healthy"
    else
      fail "${NAME} — not responding (${URL})"
    fi
  done
  echo ""
  warn "Some services may still be starting. Check logs with:"
  echo "  ${COMPOSE_CMD} -f docker-compose.prod.yml logs -f"
  echo ""
fi

# ─── Import inventory (if provided) ──────────────────────────────────────────

INVENTORY_IMPORTED=false

if [ -n "$INVENTORY_FILE" ]; then
  echo ""
  info "Importing branch inventory from ${INVENTORY_FILE}..."

  # Resolve path relative to script directory if not absolute
  if [[ "$INVENTORY_FILE" != /* ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "${SCRIPT_DIR}/${INVENTORY_FILE}" ]; then
      INVENTORY_FILE="${SCRIPT_DIR}/${INVENTORY_FILE}"
    fi
  fi

  if [ ! -f "$INVENTORY_FILE" ]; then
    warn "Inventory file not found: ${INVENTORY_FILE}"
    echo "  Skipping inventory import."
  elif ! command -v jq &> /dev/null; then
    warn "jq is not installed — cannot import inventory."
    echo "  Install jq and run: ./import-inventory.sh --inventory ${INVENTORY_FILE}"
  else
    IMPORT_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/import-inventory.sh"
    if [ -f "$IMPORT_SCRIPT" ]; then
      bash "$IMPORT_SCRIPT" --inventory "$INVENTORY_FILE" --api-url "http://localhost:3100" && INVENTORY_IMPORTED=true || true
    else
      warn "import-inventory.sh not found. Run it manually after deployment."
    fi
  fi
fi

# ─── Auto-trigger SNMP discovery ──────────────────────────────────────────────

DISCOVERY_JOB_ID=""

# If inventory was imported and community string is not the default, trigger IP discovery
if [ "$INVENTORY_IMPORTED" = true ] && [ -n "$SNMP_COMMUNITY" ] && [ "$SNMP_COMMUNITY" != "public" ]; then
  echo ""
  info "Triggering IP-targeted discovery for inventory..."

  TRIGGER_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/trigger-discovery.sh"
  if [ -f "$TRIGGER_SCRIPT" ]; then
    bash "$TRIGGER_SCRIPT" \
      --inventory "$INVENTORY_FILE" \
      --community "$SNMP_COMMUNITY" \
      --nms-url "http://localhost:3001" || true
  fi
fi

if [ -n "$DISCOVERY_SUBNETS" ]; then
  echo ""
  info "Triggering SNMP auto-discovery..."

  # Convert comma-separated CIDRs to JSON array
  SUBNETS_JSON=$(echo "$DISCOVERY_SUBNETS" | awk -F',' '{
    printf "["
    for(i=1;i<=NF;i++) {
      gsub(/^ +| +$/,"",$i)
      if(i>1) printf ","
      printf "\"%s\"",$i
    }
    printf "]"
  }')

  DISCOVERY_BODY="{\"subnets\":${SUBNETS_JSON},\"community\":\"${SNMP_COMMUNITY}\"}"

  # Wait a moment for NMS to fully initialize
  sleep 3

  RESPONSE=$(curl -sf --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$DISCOVERY_BODY" \
    "http://localhost:3001/api/v1/nms/discover" 2>&1) || true

  if [ -n "$RESPONSE" ]; then
    DISCOVERY_JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4 || true)
    if [ -n "$DISCOVERY_JOB_ID" ]; then
      ok "Discovery started — Job ID: ${DISCOVERY_JOB_ID}"
      ok "Scanning subnets: ${DISCOVERY_SUBNETS}"
    else
      ok "Discovery request sent"
      echo "  Response: ${RESPONSE}"
    fi
  else
    warn "Could not trigger discovery. NMS may still be starting."
    echo "  Trigger manually:"
    echo "  curl -X POST http://localhost:3001/api/v1/nms/discover \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '${DISCOVERY_BODY}'"
  fi
else
  warn "No subnets configured — skipping auto-discovery."
  echo "  Trigger manually later:"
  echo "  curl -X POST http://localhost:3001/api/v1/nms/discover \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"subnets\":[\"10.0.1.0/24\"],\"community\":\"${SNMP_COMMUNITY}\"}'"
fi

# ─── Count running services ───────────────────────────────────────────────────

RUNNING_COUNT=$(${COMPOSE_CMD} -f docker-compose.prod.yml ps --format '{{.State}}' 2>/dev/null | grep -c "running" || \
                ${COMPOSE_CMD} -f docker-compose.prod.yml ps 2>/dev/null | grep -c "Up" || echo "?")

# ─── Final summary ───────────────────────────────────────────────────────────

DASHBOARD_URL="http://${SERVER_IP}"
if [ "$WEB_PORT" != "80" ]; then
  DASHBOARD_URL="http://${SERVER_IP}:${WEB_PORT}"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  EMS Platform — Deployment Complete${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}           ${GREEN}${DASHBOARD_URL}${NC}"
echo -e "  ${BOLD}Default Login:${NC}       admin / admin123"
echo -e "  ${BOLD}Services Running:${NC}    ${RUNNING_COUNT}"
echo ""
echo -e "  ${BOLD}API Endpoints:${NC}"
echo "    API Health:        http://${SERVER_IP}:3100/"
echo "    NMS Health:        http://${SERVER_IP}:3001/health"
echo "    NMS Status:        http://${SERVER_IP}:3001/api/v1/nms/status"
echo "    ITSM Health:       http://${SERVER_IP}:3005/"
echo "    ML Health:         http://${SERVER_IP}:8000/api/v1/health"
if [ -n "$DISCOVERY_JOB_ID" ]; then
echo ""
echo -e "  ${BOLD}Discovery Status:${NC}"
echo "    http://${SERVER_IP}:3001/api/v1/nms/discover/status?jobId=${DISCOVERY_JOB_ID}"
fi
echo ""
echo -e "  ${BOLD}Useful Commands:${NC}"
echo "    View logs:         ${COMPOSE_CMD} -f docker-compose.prod.yml logs -f"
echo "    Service status:    ${COMPOSE_CMD} -f docker-compose.prod.yml ps"
echo "    Stop platform:     ${COMPOSE_CMD} -f docker-compose.prod.yml down"
echo "    Restart service:   ${COMPOSE_CMD} -f docker-compose.prod.yml restart <name>"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
