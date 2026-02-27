#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Trigger IP-Targeted Discovery
# ═══════════════════════════════════════════════════════════════════════════════
#
# Reads a branch inventory JSON file, extracts all IPs, and calls the NMS
# IP-targeted discovery endpoint. Used when SNMP community strings become
# available for pre-registered assets.
#
# Usage:
#   ./trigger-discovery.sh --inventory inventories/amc-branches.json --community <string>
#   ./trigger-discovery.sh --inventory inventories/amc-branches.json --community <string> --nms-url http://10.0.1.50:3001
#
# Prerequisites:
#   - jq installed
#   - NMS service running and accessible
#   - Assets already imported (via import-inventory.sh)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

# ─── Parse arguments ─────────────────────────────────────────────────────────

INVENTORY_FILE=""
COMMUNITY=""
NMS_URL="http://localhost:3001"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --inventory)  INVENTORY_FILE="$2"; shift 2 ;;
    --community)  COMMUNITY="$2"; shift 2 ;;
    --nms-url)    NMS_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --inventory <path> --community <string> [--nms-url <url>]"
      echo ""
      echo "Options:"
      echo "  --inventory    Path to branch inventory JSON file (required)"
      echo "  --community    SNMP community string (required)"
      echo "  --nms-url      NMS API base URL (default: http://localhost:3001)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$INVENTORY_FILE" ]; then
  fail "Missing required --inventory argument"
  echo "Usage: $0 --inventory <path> --community <string>"
  exit 1
fi

if [ -z "$COMMUNITY" ]; then
  fail "Missing required --community argument"
  echo "Usage: $0 --inventory <path> --community <string>"
  exit 1
fi

# ─── Pre-flight checks ───────────────────────────────────────────────────────

if ! command -v jq &> /dev/null; then
  fail "jq is required but not installed. Install with: apt-get install -y jq"
  exit 1
fi

if [ ! -f "$INVENTORY_FILE" ]; then
  fail "Inventory file not found: $INVENTORY_FILE"
  exit 1
fi

if ! jq empty "$INVENTORY_FILE" 2>/dev/null; then
  fail "Invalid JSON in inventory file: $INVENTORY_FILE"
  exit 1
fi

# Check NMS is reachable
if ! curl -sf --max-time 5 "${NMS_URL}/health" > /dev/null 2>&1; then
  fail "NMS service is not reachable at ${NMS_URL}"
  echo "  Ensure services are running and try again."
  exit 1
fi
ok "NMS service reachable at ${NMS_URL}"

# ─── Extract IPs ─────────────────────────────────────────────────────────────

CUSTOMER=$(jq -r '.customer' "$INVENTORY_FILE")
IPS_JSON=$(jq '[.branches[].links[].ip]' "$INVENTORY_FILE")
IP_COUNT=$(echo "$IPS_JSON" | jq 'length')

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  EMS Platform — Trigger IP Discovery${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "Customer:   ${CUSTOMER}"
info "Target IPs: ${IP_COUNT}"
info "Community:  ${COMMUNITY}"
info "NMS URL:    ${NMS_URL}"
echo ""

# ─── Call discovery endpoint ──────────────────────────────────────────────────

BODY=$(jq -n \
  --argjson ips "$IPS_JSON" \
  --arg community "$COMMUNITY" \
  '{ ips: $ips, community: $community }')

info "Sending discovery request..."

RESPONSE=$(curl -sf --max-time 15 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${NMS_URL}/api/v1/nms/discover/ips" 2>&1) || true

if [ -z "$RESPONSE" ]; then
  fail "No response from NMS discovery endpoint"
  echo "  Ensure NMS is running: curl -sf ${NMS_URL}/health"
  exit 1
fi

JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // empty')
TOTAL=$(echo "$RESPONSE" | jq -r '.totalIPs // 0')

if [ -n "$JOB_ID" ]; then
  echo ""
  ok "Discovery started successfully!"
  echo ""
  echo -e "  ${BOLD}Job ID:${NC}     ${JOB_ID}"
  echo -e "  ${BOLD}Target IPs:${NC} ${TOTAL}"
  echo ""
  echo "  Check progress:"
  echo "  curl -s ${NMS_URL}/api/v1/nms/discover/status?jobId=${JOB_ID} | jq ."
  echo ""
  echo "  Watch progress:"
  echo "  watch -n5 \"curl -s ${NMS_URL}/api/v1/nms/discover/status?jobId=${JOB_ID} | jq '{status,progress,devicesFound}'\""
  echo ""
else
  fail "Discovery request failed"
  echo "  Response: ${RESPONSE}"
  exit 1
fi
