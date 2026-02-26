#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Export Docker Images for Client Transfer
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   1. Build all images first:
#        docker-compose -f docker-compose.prod.yml build
#   2. Run this script:
#        ./scripts/export-images.sh
#   3. Transfer the output file to the client server:
#        scp ems-platform-poc-1.0.tar.gz user@client-server:/path/to/deploy/
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

VERSION="poc-1.0"
OUTPUT_FILE="ems-platform-${VERSION}.tar.gz"

# All EMS application images
APP_IMAGES=(
  "canaris/ems-api:${VERSION}"
  "canaris/ems-nms:${VERSION}"
  "canaris/ems-itsm:${VERSION}"
  "canaris/ems-ml:${VERSION}"
  "canaris/ems-probe:${VERSION}"
  "canaris/ems-frontend:${VERSION}"
)

# Infrastructure images used by docker-compose.prod.yml
INFRA_IMAGES=(
  "postgres:15-alpine"
  "redis:7-alpine"
)

ALL_IMAGES=("${APP_IMAGES[@]}" "${INFRA_IMAGES[@]}")

# ─── Pre-flight checks ───────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════"
echo "  EMS Platform — Docker Image Export"
echo "═══════════════════════════════════════════════════════════════"
echo ""

MISSING=()
for img in "${ALL_IMAGES[@]}"; do
  if docker image inspect "$img" > /dev/null 2>&1; then
    SIZE=$(docker image inspect "$img" --format='{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')
    echo "  [OK]  $img  ($SIZE)"
  else
    echo "  [!!]  $img  — NOT FOUND"
    MISSING+=("$img")
  fi
done

echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: ${#MISSING[@]} image(s) not found locally."
  echo ""
  echo "Build them first with:"
  echo "  docker-compose -f docker-compose.prod.yml build"
  echo ""
  echo "For infrastructure images, pull them:"
  for img in "${MISSING[@]}"; do
    case "$img" in
      postgres:*|redis:*) echo "  docker pull $img" ;;
    esac
  done
  exit 1
fi

# ─── Export ───────────────────────────────────────────────────────────────────

echo "Saving ${#ALL_IMAGES[@]} images to ${OUTPUT_FILE}..."
echo "This may take a few minutes depending on image sizes."
echo ""

docker save "${ALL_IMAGES[@]}" | gzip -1 > "${OUTPUT_FILE}"

FILESIZE=$(ls -lh "${OUTPUT_FILE}" | awk '{print $5}')

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Export complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  File:   $(pwd)/${OUTPUT_FILE}"
echo "  Size:   ${FILESIZE}"
echo "  Images: ${#ALL_IMAGES[@]}"
echo ""
echo "  Transfer to client server:"
echo "    scp ${OUTPUT_FILE} user@client-server:/opt/ems/"
echo ""
echo "  Then on the client server:"
echo "    cd /opt/ems"
echo "    ./load-images.sh"
echo "    cp .env.template .env   # edit with production values"
echo "    docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "═══════════════════════════════════════════════════════════════"
