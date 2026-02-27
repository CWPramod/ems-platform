#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Import Branch Inventory
# ═══════════════════════════════════════════════════════════════════════════════
#
# Reads a branch inventory JSON file and bulk-creates assets via the EMS API.
# Each branch link becomes an asset with status "unknown" and tag "pending-snmp",
# ready to be activated once SNMP discovery runs.
#
# Usage:
#   ./import-inventory.sh --inventory inventories/amc-branches.json
#   ./import-inventory.sh --inventory inventories/amc-branches.json --api-url http://10.0.1.50:3100
#
# Prerequisites:
#   - jq installed
#   - EMS API running and accessible
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
API_URL="http://localhost:3100"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --inventory)  INVENTORY_FILE="$2"; shift 2 ;;
    --api-url)    API_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --inventory <path> [--api-url <url>]"
      echo ""
      echo "Options:"
      echo "  --inventory    Path to branch inventory JSON file (required)"
      echo "  --api-url      EMS API base URL (default: http://localhost:3100)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$INVENTORY_FILE" ]; then
  fail "Missing required --inventory argument"
  echo "Usage: $0 --inventory <path>"
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

# Validate JSON
if ! jq empty "$INVENTORY_FILE" 2>/dev/null; then
  fail "Invalid JSON in inventory file: $INVENTORY_FILE"
  exit 1
fi

# Check API is reachable
if ! curl -sf --max-time 5 "${API_URL}/assets" > /dev/null 2>&1; then
  fail "EMS API is not reachable at ${API_URL}"
  echo "  Ensure services are running and try again."
  exit 1
fi
ok "EMS API reachable at ${API_URL}"

# ─── Read inventory ──────────────────────────────────────────────────────────

CUSTOMER=$(jq -r '.customer' "$INVENTORY_FILE")
TOTAL_BRANCHES=$(jq -r '.branches | length' "$INVENTORY_FILE")
TOTAL_IPS=$(jq -r '[.branches[].links[]] | length' "$INVENTORY_FILE")

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  EMS Platform — Import Branch Inventory${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "Customer:  ${CUSTOMER}"
info "Branches:  ${TOTAL_BRANCHES}"
info "Total IPs: ${TOTAL_IPS}"
echo ""

# ─── Check for existing assets (dedup) ───────────────────────────────────────

info "Checking for existing assets..."

EXISTING_IPS=$(curl -sf "${API_URL}/assets" 2>/dev/null | jq -r '
  if type == "array" then .[].ip
  elif .data then .data[].ip
  elif .assets then .assets[].ip
  else empty
  end // empty
' 2>/dev/null || echo "")

SKIPPED=0
ASSETS_JSON="[]"

# Build the assets array, skipping any IPs that already exist
while IFS= read -r branch_json; do
  BRANCH_NAME=$(echo "$branch_json" | jq -r '.name')
  BRANCH_LOCATION=$(echo "$branch_json" | jq -r '.location')
  BRANCH_ADDRESS=$(echo "$branch_json" | jq -r '.address')

  while IFS= read -r link_json; do
    IP=$(echo "$link_json" | jq -r '.ip')
    LINK_TYPE=$(echo "$link_json" | jq -r '.type')

    # Skip if IP already exists
    if echo "$EXISTING_IPS" | grep -qxF "$IP" 2>/dev/null; then
      warn "Skipping ${IP} (${BRANCH_NAME} ${LINK_TYPE}) — asset already exists"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi

    # Sanitize branch name for asset naming (replace spaces/special chars with hyphens)
    SAFE_NAME=$(echo "$BRANCH_NAME" | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

    ASSET=$(jq -n \
      --arg name "AMC-${SAFE_NAME}-${LINK_TYPE}" \
      --arg type "router" \
      --arg ip "$IP" \
      --arg status "unknown" \
      --arg location "$BRANCH_LOCATION" \
      --arg tier "2" \
      --arg owner "amc-deployment" \
      --arg vendor "Unknown" \
      --arg branchName "$BRANCH_NAME" \
      --arg branchAddress "$BRANCH_ADDRESS" \
      --arg linkType "$LINK_TYPE" \
      '{
        name: $name,
        type: $type,
        ip: $ip,
        status: $status,
        monitoringEnabled: false,
        location: $location,
        tier: $tier,
        owner: $owner,
        vendor: $vendor,
        tags: ["amc", "branch-wan", $linkType, "pending-snmp"],
        metadata: {
          branchName: $branchName,
          branchAddress: $branchAddress,
          linkType: $linkType,
          customer: "AMC Cooperative Bank",
          snmpPending: true
        }
      }')

    ASSETS_JSON=$(echo "$ASSETS_JSON" | jq --argjson asset "$ASSET" '. + [$asset]')
  done < <(echo "$branch_json" | jq -c '.links[]')
done < <(jq -c '.branches[]' "$INVENTORY_FILE")

ASSET_COUNT=$(echo "$ASSETS_JSON" | jq 'length')

if [ "$ASSET_COUNT" -eq 0 ]; then
  echo ""
  if [ "$SKIPPED" -gt 0 ]; then
    ok "All ${SKIPPED} assets already exist. Nothing to import."
  else
    warn "No assets to import."
  fi
  exit 0
fi

# ─── Bulk create assets ──────────────────────────────────────────────────────

info "Creating ${ASSET_COUNT} assets via bulk API..."

BODY=$(jq -n --argjson assets "$ASSETS_JSON" '{ assets: $assets }')

RESPONSE=$(curl -sf --max-time 30 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${API_URL}/assets/bulk" 2>&1) || true

if [ -z "$RESPONSE" ]; then
  fail "No response from bulk create API"
  exit 1
fi

CREATED=$(echo "$RESPONSE" | jq -r '.created // 0')
FAILED=$(echo "$RESPONSE" | jq -r '.failed // 0')
ERRORS=$(echo "$RESPONSE" | jq -r '.errors // [] | .[]' 2>/dev/null || true)

echo ""
echo -e "${BOLD}─── Import Results ─────────────────────────────────────────────${NC}"
ok "Created:  ${CREATED} assets"
if [ "$SKIPPED" -gt 0 ]; then
  warn "Skipped:  ${SKIPPED} (already existed)"
fi
if [ "$FAILED" -gt 0 ]; then
  fail "Failed:   ${FAILED}"
  if [ -n "$ERRORS" ]; then
    echo "$ERRORS" | while read -r err; do
      echo "    - $err"
    done
  fi
fi

echo ""
ok "Import complete. Assets are in 'unknown' status with 'pending-snmp' tag."
echo "  Run SNMP discovery to activate monitoring:"
echo "  ./trigger-discovery.sh --inventory ${INVENTORY_FILE} --community <string>"
echo ""
