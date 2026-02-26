#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Deployment Validation
# ═══════════════════════════════════════════════════════════════════════════════
#
# Post-deployment health check that validates all services, data flow,
# and storage capacity.
#
# Usage:
#   ./validate-deployment.sh [--server-ip IP]
#
# Prerequisites:
#   - EMS Platform running via docker-compose.prod.yml
#   - curl and jq installed (jq is optional but recommended)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Counters ────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
WARN=0
CHECKS=()

pass() { echo -e "  ${GREEN}✓${NC} $*"; PASS=$((PASS + 1)); CHECKS+=("PASS|$*"); }
fail() { echo -e "  ${RED}✗${NC} $*"; FAIL=$((FAIL + 1)); CHECKS+=("FAIL|$*"); }
warn() { echo -e "  ${YELLOW}!${NC} $*"; WARN=$((WARN + 1)); CHECKS+=("WARN|$*"); }
info() { echo -e "  ${CYAN}ℹ${NC} $*"; }
section() { echo ""; echo -e "${BOLD}── $* ──${NC}"; echo ""; }

# ─── Parse arguments ─────────────────────────────────────────────────────────

SERVER_IP="localhost"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip) SERVER_IP="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--server-ip IP]"
      echo ""
      echo "Validates an EMS Platform deployment by checking containers,"
      echo "API endpoints, data flow, and storage capacity."
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Detect Compose command ──────────────────────────────────────────────────

COMPOSE_CMD=""
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}ERROR:${NC} Docker Compose is not installed."
  exit 1
fi

# Check jq availability
HAS_JQ=false
if command -v jq &> /dev/null; then
  HAS_JQ=true
fi

# Helper: extract JSON field without jq
json_field() {
  local json="$1" field="$2"
  if $HAS_JQ; then
    echo "$json" | jq -r "$field" 2>/dev/null
  else
    # Fallback: basic grep extraction for simple fields
    echo "$json" | grep -o "\"${field#.}\":[^,}]*" | head -1 | sed 's/.*://' | tr -d '"  '
  fi
}

# Helper: extract JSON number
json_number() {
  local json="$1" field="$2"
  if $HAS_JQ; then
    echo "$json" | jq -r "$field // 0" 2>/dev/null
  else
    echo "$json" | grep -o "\"${field#.}\":[0-9]*" | head -1 | sed 's/.*://'
  fi
}

# ─── Header ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  EMS Platform — Deployment Validation${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${DIM}Server: ${SERVER_IP}  |  $(date '+%Y-%m-%d %H:%M:%S')${NC}"

# Read .env for port config
WEB_PORT=$(grep '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2)
WEB_PORT="${WEB_PORT:-80}"

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 1: Docker Container Health
# ═════════════════════════════════════════════════════════════════════════════

section "1. Docker Container Health"

EXPECTED_SERVICES=("ems-postgres" "ems-redis" "ems-api" "ems-nms" "ems-itsm" "ems-ml" "ems-probe" "ems-frontend")

RUNNING_CONTAINERS=$(docker ps --format '{{.Names}}|{{.Status}}' 2>/dev/null)

for svc in "${EXPECTED_SERVICES[@]}"; do
  CONTAINER_LINE=$(echo "$RUNNING_CONTAINERS" | grep "^${svc}|" || true)

  if [ -z "$CONTAINER_LINE" ]; then
    fail "${svc} — not running"
  else
    STATUS="${CONTAINER_LINE#*|}"
    if echo "$STATUS" | grep -qi "healthy"; then
      pass "${svc} — running (healthy)"
    elif echo "$STATUS" | grep -qi "unhealthy"; then
      fail "${svc} — running but unhealthy"
    elif echo "$STATUS" | grep -qi "starting\|health:"; then
      warn "${svc} — running (health check pending)"
    elif echo "$STATUS" | grep -qi "Up"; then
      pass "${svc} — running"
    else
      warn "${svc} — status: ${STATUS}"
    fi
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 2: Service Health Endpoints
# ═════════════════════════════════════════════════════════════════════════════

section "2. Service Health Endpoints"

declare -A HEALTH_ENDPOINTS=(
  ["API"]="http://${SERVER_IP}:3100/"
  ["NMS"]="http://${SERVER_IP}:3001/health"
  ["ITSM"]="http://${SERVER_IP}:3005/"
  ["ML"]="http://${SERVER_IP}:8000/api/v1/health"
  ["Probe"]="http://${SERVER_IP}:3006/health"
  ["Frontend"]="http://${SERVER_IP}:${WEB_PORT}/"
)

for svc in API NMS ITSM ML Probe Frontend; do
  URL="${HEALTH_ENDPOINTS[$svc]}"
  RESPONSE=$(curl -sf --max-time 5 "$URL" 2>&1) && RC=0 || RC=$?
  if [ $RC -eq 0 ]; then
    # Try to extract status from JSON response
    SVC_STATUS=$(json_field "$RESPONSE" ".status" 2>/dev/null)
    if [ -n "$SVC_STATUS" ] && [ "$SVC_STATUS" != "null" ]; then
      if [ "$SVC_STATUS" = "healthy" ]; then
        pass "${svc} health endpoint — ${SVC_STATUS}"
      else
        warn "${svc} health endpoint — ${SVC_STATUS}"
      fi
    else
      pass "${svc} health endpoint — responding"
    fi
  else
    fail "${svc} health endpoint — not responding (${URL})"
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 3: Discovered Assets
# ═════════════════════════════════════════════════════════════════════════════

section "3. Discovered Assets (GET /assets)"

ASSETS_RESPONSE=$(curl -sf --max-time 10 "http://${SERVER_IP}:3100/assets" 2>&1) && RC=0 || RC=$?

if [ $RC -eq 0 ] && [ -n "$ASSETS_RESPONSE" ]; then
  TOTAL_ASSETS=$(json_number "$ASSETS_RESPONSE" ".total")

  if [ -n "$TOTAL_ASSETS" ] && [ "$TOTAL_ASSETS" -gt 0 ] 2>/dev/null; then
    pass "Asset inventory — ${TOTAL_ASSETS} device(s) discovered"

    # Breakdown by type if jq available
    if $HAS_JQ; then
      TYPE_BREAKDOWN=$(echo "$ASSETS_RESPONSE" | jq -r '
        [.data[]? // .[]] | group_by(.type) |
        map("\(.[-1].type // "unknown"): \(length)") |
        join(", ")' 2>/dev/null)
      if [ -n "$TYPE_BREAKDOWN" ]; then
        info "By type: ${TYPE_BREAKDOWN}"
      fi
    fi
  elif [ "$TOTAL_ASSETS" = "0" ] 2>/dev/null; then
    warn "Asset inventory — 0 devices (discovery may not have run yet)"
  else
    # Maybe the response is a direct array
    if $HAS_JQ; then
      ARRAY_COUNT=$(echo "$ASSETS_RESPONSE" | jq 'if type == "array" then length else .total // 0 end' 2>/dev/null)
      if [ -n "$ARRAY_COUNT" ] && [ "$ARRAY_COUNT" -gt 0 ] 2>/dev/null; then
        pass "Asset inventory — ${ARRAY_COUNT} device(s) discovered"
      else
        warn "Asset inventory — 0 devices (discovery may not have run yet)"
      fi
    else
      pass "Asset endpoint responding (install jq for detailed counts)"
    fi
  fi
else
  fail "Cannot reach asset endpoint (http://${SERVER_IP}:3100/assets)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 4: Discovery Status
# ═════════════════════════════════════════════════════════════════════════════

section "4. SNMP Discovery Status (GET /api/v1/nms/discover/status)"

DISC_RESPONSE=$(curl -sf --max-time 10 "http://${SERVER_IP}:3001/api/v1/nms/discover/status" 2>&1) && RC=0 || RC=$?

if [ $RC -eq 0 ] && [ -n "$DISC_RESPONSE" ]; then
  DISC_STATUS=$(json_field "$DISC_RESPONSE" ".status")
  DISC_PROGRESS=$(json_number "$DISC_RESPONSE" ".progress")
  DISC_TOTAL=$(json_number "$DISC_RESPONSE" ".totalIPs")
  DISC_SCANNED=$(json_number "$DISC_RESPONSE" ".scannedIPs")
  DISC_FOUND=$(json_number "$DISC_RESPONSE" ".devicesFound")

  case "$DISC_STATUS" in
    completed)
      pass "Discovery completed — ${DISC_FOUND} device(s) found (scanned ${DISC_SCANNED}/${DISC_TOTAL} IPs)"
      ;;
    in_progress)
      warn "Discovery in progress — ${DISC_PROGRESS}% (${DISC_SCANNED}/${DISC_TOTAL} IPs, ${DISC_FOUND} found so far)"
      ;;
    failed)
      DISC_ERROR=$(json_field "$DISC_RESPONSE" ".error")
      fail "Discovery failed — ${DISC_ERROR:-unknown error}"
      ;;
    not_started|""|null)
      warn "No discovery job found — discovery has not been triggered"
      ;;
    *)
      warn "Discovery status: ${DISC_STATUS}"
      ;;
  esac
else
  fail "Cannot reach discovery status endpoint"
fi

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 5: Metric Data Flow
# ═════════════════════════════════════════════════════════════════════════════

section "5. Metric Data Flow (GET /metrics?limit=10)"

METRICS_RESPONSE=$(curl -sf --max-time 10 "http://${SERVER_IP}:3100/metrics?limit=10" 2>&1) && RC=0 || RC=$?

if [ $RC -eq 0 ] && [ -n "$METRICS_RESPONSE" ]; then
  if $HAS_JQ; then
    METRIC_COUNT=$(echo "$METRICS_RESPONSE" | jq '
      if type == "object" then (.data | if type == "array" then length else 0 end)
      elif type == "array" then length
      else 0 end' 2>/dev/null)
  else
    # Count data entries by looking for timestamp or value fields
    METRIC_COUNT=$(echo "$METRICS_RESPONSE" | grep -o '"timestamp"' | wc -l)
  fi

  if [ -n "$METRIC_COUNT" ] && [ "$METRIC_COUNT" -gt 0 ] 2>/dev/null; then
    pass "Metrics flowing — ${METRIC_COUNT} recent data point(s)"

    if $HAS_JQ; then
      METRIC_NAMES=$(echo "$METRICS_RESPONSE" | jq -r '
        [(.data[]? // .[]).metricName? // empty] | unique | join(", ")' 2>/dev/null)
      if [ -n "$METRIC_NAMES" ]; then
        info "Metric types: ${METRIC_NAMES}"
      fi
    fi
  else
    warn "Metrics endpoint responding but no data points yet"
    info "Metrics will appear after polling cycles complete"
  fi
else
  fail "Cannot reach metrics endpoint (http://${SERVER_IP}:3100/metrics)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 6: Active Alerts
# ═════════════════════════════════════════════════════════════════════════════

section "6. Active Alerts (GET /alerts?limit=5)"

ALERTS_RESPONSE=$(curl -sf --max-time 10 "http://${SERVER_IP}:3100/alerts?status=open&limit=5" 2>&1) && RC=0 || RC=$?

if [ $RC -eq 0 ] && [ -n "$ALERTS_RESPONSE" ]; then
  if $HAS_JQ; then
    ALERT_TOTAL=$(echo "$ALERTS_RESPONSE" | jq '
      if type == "object" then (.total // (.data | length))
      elif type == "array" then length
      else 0 end' 2>/dev/null)
    ALERT_DATA_COUNT=$(echo "$ALERTS_RESPONSE" | jq '
      if type == "object" then (.data | if type == "array" then length else 0 end)
      elif type == "array" then length
      else 0 end' 2>/dev/null)
  else
    ALERT_TOTAL=$(json_number "$ALERTS_RESPONSE" ".total")
    ALERT_DATA_COUNT=$(echo "$ALERTS_RESPONSE" | grep -o '"severity"' | wc -l)
  fi

  if [ -n "$ALERT_TOTAL" ] && [ "$ALERT_TOTAL" -gt 0 ] 2>/dev/null; then
    warn "${ALERT_TOTAL} active alert(s)"

    # Show top alerts
    if $HAS_JQ; then
      echo "$ALERTS_RESPONSE" | jq -r '
        (.data // .)[:5][] |
        "    \(.severity // "info" | ascii_upcase) | \(.event.title // .title // "Alert") | \(.asset.name // .assetId // "unknown")"
      ' 2>/dev/null | while IFS= read -r line; do
        if echo "$line" | grep -qi "critical"; then
          echo -e "    ${RED}${line}${NC}"
        elif echo "$line" | grep -qi "warning\|major"; then
          echo -e "    ${YELLOW}${line}${NC}"
        else
          echo -e "    ${DIM}${line}${NC}"
        fi
      done
    fi
  elif [ "$ALERT_DATA_COUNT" = "0" ] 2>/dev/null || [ "$ALERT_TOTAL" = "0" ] 2>/dev/null; then
    pass "No active alerts"
  else
    pass "Alert endpoint responding — no open alerts"
  fi
else
  fail "Cannot reach alerts endpoint (http://${SERVER_IP}:3100/alerts)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# CHECK 7: PostgreSQL Storage
# ═════════════════════════════════════════════════════════════════════════════

section "7. PostgreSQL Storage"

# Get DB credentials from .env
DB_NAME=$(grep '^DATABASE_NAME=' .env 2>/dev/null | cut -d= -f2)
DB_USER=$(grep '^DATABASE_USER=' .env 2>/dev/null | cut -d= -f2)
DB_NAME="${DB_NAME:-ems_platform}"
DB_USER="${DB_USER:-ems_admin}"

# Check if postgres container is running
PG_CONTAINER=$(docker ps --filter "name=ems-postgres" --format '{{.Names}}' 2>/dev/null | head -1)

if [ -n "$PG_CONTAINER" ]; then
  # Get database size
  DB_SIZE=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null | xargs)

  DB_SIZE_BYTES=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT pg_database_size('${DB_NAME}');" 2>/dev/null | xargs)

  if [ -n "$DB_SIZE" ]; then
    pass "Database size: ${DB_SIZE}"
  else
    warn "Could not query database size"
  fi

  # Get table breakdown
  if $HAS_JQ; then
    TABLE_SIZES=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
      SELECT json_agg(t) FROM (
        SELECT tablename AS name,
               pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5
      ) t;" 2>/dev/null | xargs)

    if [ -n "$TABLE_SIZES" ] && [ "$TABLE_SIZES" != "null" ]; then
      info "Largest tables:"
      echo "$TABLE_SIZES" | jq -r '.[] | "      \(.name): \(.size)"' 2>/dev/null
    fi
  else
    TABLE_SIZES=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
      SELECT tablename || ': ' || pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 5;" 2>/dev/null)

    if [ -n "$TABLE_SIZES" ]; then
      info "Largest tables:"
      echo "$TABLE_SIZES" | while IFS= read -r line; do
        line=$(echo "$line" | xargs)
        [ -n "$line" ] && echo "      ${line}"
      done
    fi
  fi

  # Estimate storage capacity
  # Get Docker volume disk usage
  PG_VOLUME=$(docker inspect "$PG_CONTAINER" --format='{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)

  if [ -n "$PG_VOLUME" ]; then
    DISK_AVAIL_KB=$(df -k "$PG_VOLUME" 2>/dev/null | tail -1 | awk '{print $4}')
    DISK_TOTAL_KB=$(df -k "$PG_VOLUME" 2>/dev/null | tail -1 | awk '{print $2}')
    DISK_USED_PCT=$(df "$PG_VOLUME" 2>/dev/null | tail -1 | awk '{print $5}')
  else
    # Fall back to root filesystem
    DISK_AVAIL_KB=$(df -k / 2>/dev/null | tail -1 | awk '{print $4}')
    DISK_TOTAL_KB=$(df -k / 2>/dev/null | tail -1 | awk '{print $2}')
    DISK_USED_PCT=$(df / 2>/dev/null | tail -1 | awk '{print $5}')
  fi

  if [ -n "$DISK_AVAIL_KB" ] && [ -n "$DB_SIZE_BYTES" ]; then
    DISK_AVAIL_MB=$((DISK_AVAIL_KB / 1024))
    DISK_TOTAL_MB=$((DISK_TOTAL_KB / 1024))
    DB_SIZE_MB=$((DB_SIZE_BYTES / 1024 / 1024))

    # Estimate daily growth — assume DB was created when containers started
    CONTAINER_UPTIME_SECS=$(docker inspect "$PG_CONTAINER" --format='{{.State.StartedAt}}' 2>/dev/null | \
      xargs -I{} bash -c 'echo $(( $(date +%s) - $(date -d "{}" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "{}" +%s 2>/dev/null || echo 0) ))' 2>/dev/null)

    if [ -n "$CONTAINER_UPTIME_SECS" ] && [ "$CONTAINER_UPTIME_SECS" -gt 3600 ] && [ "$DB_SIZE_MB" -gt 0 ] 2>/dev/null; then
      UPTIME_DAYS=$(echo "$CONTAINER_UPTIME_SECS" | awk '{printf "%.1f", $1/86400}')
      DAILY_GROWTH_MB=$(echo "$DB_SIZE_MB $CONTAINER_UPTIME_SECS" | awk '{printf "%.1f", ($1 / ($2/86400))}')
      if [ "$(echo "$DAILY_GROWTH_MB" | awk '{print ($1 > 0)}')" = "1" ]; then
        DAYS_REMAINING=$(echo "$DISK_AVAIL_MB $DAILY_GROWTH_MB" | awk '{printf "%.0f", $1/$2}')
        pass "Disk available: ${DISK_AVAIL_MB} MB / ${DISK_TOTAL_MB} MB (${DISK_USED_PCT} used)"
        info "DB uptime: ${UPTIME_DAYS} days, growth rate: ~${DAILY_GROWTH_MB} MB/day"
        if [ "$DAYS_REMAINING" -lt 30 ] 2>/dev/null; then
          warn "Estimated storage remaining: ~${DAYS_REMAINING} days"
        else
          pass "Estimated storage remaining: ~${DAYS_REMAINING} days"
        fi
      else
        pass "Disk available: ${DISK_AVAIL_MB} MB / ${DISK_TOTAL_MB} MB (${DISK_USED_PCT} used)"
        info "Insufficient uptime to estimate growth rate"
      fi
    else
      pass "Disk available: ${DISK_AVAIL_MB} MB / ${DISK_TOTAL_MB} MB (${DISK_USED_PCT} used)"
      info "Container recently started — growth rate not yet available"
    fi
  fi

  # Check connection count
  CONN_COUNT=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}';" 2>/dev/null | xargs)
  MAX_CONN=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SHOW max_connections;" 2>/dev/null | xargs)

  if [ -n "$CONN_COUNT" ] && [ -n "$MAX_CONN" ]; then
    info "Active connections: ${CONN_COUNT}/${MAX_CONN}"
    CONN_PCT=$((CONN_COUNT * 100 / MAX_CONN))
    if [ "$CONN_PCT" -gt 80 ] 2>/dev/null; then
      warn "Connection pool is ${CONN_PCT}% utilized"
    fi
  fi
else
  fail "PostgreSQL container (ems-postgres) is not running"
fi

# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Deployment Health Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASS + FAIL + WARN))

echo -e "  ${GREEN}Passed:${NC}   ${PASS}/${TOTAL}"
echo -e "  ${RED}Failed:${NC}   ${FAIL}/${TOTAL}"
echo -e "  ${YELLOW}Warnings:${NC} ${WARN}/${TOTAL}"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}STATUS: ALL CHECKS PASSED${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}STATUS: OPERATIONAL (with warnings)${NC}"
else
  echo -e "  ${RED}${BOLD}STATUS: ISSUES DETECTED${NC}"
fi

# ═════════════════════════════════════════════════════════════════════════════
# TROUBLESHOOTING (only if failures)
# ═════════════════════════════════════════════════════════════════════════════

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${BOLD}── Troubleshooting ──${NC}"
  echo ""

  for check in "${CHECKS[@]}"; do
    RESULT="${check%%|*}"
    MESSAGE="${check#*|}"

    if [ "$RESULT" = "FAIL" ]; then
      echo -e "  ${RED}✗ ${MESSAGE}${NC}"

      case "$MESSAGE" in
        *"not running"*)
          SVC_NAME=$(echo "$MESSAGE" | awk '{print $1}')
          echo "    → Check container logs:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml logs ${SVC_NAME#ems-}"
          echo "    → Try restarting:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml restart ${SVC_NAME#ems-}"
          ;;
        *"unhealthy"*)
          SVC_NAME=$(echo "$MESSAGE" | awk '{print $1}')
          echo "    → Inspect health check:"
          echo "      docker inspect --format='{{json .State.Health}}' ${SVC_NAME}"
          echo "    → Check container logs:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml logs --tail=50 ${SVC_NAME#ems-}"
          ;;
        *"health endpoint"*|*"not responding"*)
          echo "    → The service may still be starting. Wait 30s and retry."
          echo "    → Check service logs for startup errors:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml logs --tail=100"
          ;;
        *"asset endpoint"*|*"assets"*)
          echo "    → Verify API service is running:"
          echo "      curl -sf http://${SERVER_IP}:3100/"
          echo "    → Check API logs:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml logs api"
          ;;
        *"discovery"*|*"Discovery"*)
          echo "    → Verify NMS service is running:"
          echo "      curl -sf http://${SERVER_IP}:3001/health"
          echo "    → Trigger discovery manually:"
          echo "      curl -X POST http://${SERVER_IP}:3001/api/v1/nms/discover \\"
          echo "        -H 'Content-Type: application/json' \\"
          echo "        -d '{\"subnets\":[\"10.0.1.0/24\"],\"community\":\"public\"}'"
          ;;
        *"metrics"*|*"Metrics"*)
          echo "    → Metrics require polling to be active and devices discovered."
          echo "    → Check NMS polling status:"
          echo "      curl -sf http://${SERVER_IP}:3001/api/v1/nms/status"
          ;;
        *"alerts"*|*"Alerts"*)
          echo "    → Verify API service is healthy:"
          echo "      curl -sf http://${SERVER_IP}:3100/"
          ;;
        *"PostgreSQL"*|*"postgres"*)
          echo "    → Check PostgreSQL container:"
          echo "      docker logs ems-postgres --tail=50"
          echo "    → Verify database credentials in .env"
          echo "    → Try restarting:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml restart postgres"
          ;;
        *)
          echo "    → Check logs:"
          echo "      ${COMPOSE_CMD} -f docker-compose.prod.yml logs --tail=50"
          ;;
      esac
      echo ""
    fi
  done

  echo -e "  ${BOLD}General commands:${NC}"
  echo "    View all logs:     ${COMPOSE_CMD} -f docker-compose.prod.yml logs -f"
  echo "    Service status:    ${COMPOSE_CMD} -f docker-compose.prod.yml ps"
  echo "    Restart all:       ${COMPOSE_CMD} -f docker-compose.prod.yml restart"
  echo "    Full redeploy:     ${COMPOSE_CMD} -f docker-compose.prod.yml down && \\"
  echo "                       ${COMPOSE_CMD} -f docker-compose.prod.yml up -d"
fi

if [ "$WARN" -gt 0 ] && [ "$FAIL" -eq 0 ]; then
  echo ""
  echo -e "  ${DIM}Warnings are informational — no action required unless persistent.${NC}"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Exit with appropriate code
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
