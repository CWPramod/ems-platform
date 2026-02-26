#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMS Platform — Load Docker Images on Client Server
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   1. Transfer the tar.gz and this script to the client server
#   2. Run:  ./load-images.sh
#   3. Then: cp .env.template .env && vim .env
#   4. Then: docker-compose -f docker-compose.prod.yml up -d
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

VERSION="poc-1.0"
TAR_FILE="ems-platform-${VERSION}.tar.gz"

# Allow overriding the tar file path via argument
if [ $# -ge 1 ]; then
  TAR_FILE="$1"
fi

# ─── Pre-flight checks ───────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════"
echo "  EMS Platform — Docker Image Loader"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ ! -f "$TAR_FILE" ]; then
  echo "ERROR: ${TAR_FILE} not found."
  echo ""
  echo "Usage: $0 [path-to-tar-file]"
  echo ""
  echo "Example:"
  echo "  $0 ems-platform-poc-1.0.tar.gz"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "ERROR: docker is not installed or not in PATH."
  exit 1
fi

FILESIZE=$(ls -lh "${TAR_FILE}" | awk '{print $5}')
echo "  Source:  ${TAR_FILE} (${FILESIZE})"
echo ""
echo "Loading images into Docker..."
echo "This may take a few minutes."
echo ""

# ─── Load images ──────────────────────────────────────────────────────────────

gunzip -c "${TAR_FILE}" | docker load

echo ""

# ─── Verify loaded images ────────────────────────────────────────────────────

EXPECTED_IMAGES=(
  "canaris/ems-api:${VERSION}"
  "canaris/ems-nms:${VERSION}"
  "canaris/ems-itsm:${VERSION}"
  "canaris/ems-ml:${VERSION}"
  "canaris/ems-probe:${VERSION}"
  "canaris/ems-frontend:${VERSION}"
  "postgres:15-alpine"
  "redis:7-alpine"
)

echo "Verifying loaded images:"
echo ""

ALL_OK=true
for img in "${EXPECTED_IMAGES[@]}"; do
  if docker image inspect "$img" > /dev/null 2>&1; then
    SIZE=$(docker image inspect "$img" --format='{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')
    echo "  [OK]  $img  ($SIZE)"
  else
    echo "  [!!]  $img  — MISSING"
    ALL_OK=false
  fi
done

echo ""

if [ "$ALL_OK" = true ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  All images loaded successfully!"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "  Next steps:"
  echo ""
  echo "    1. Configure environment:"
  echo "       cp .env.template .env"
  echo "       vim .env    # set DATABASE_PASSWORD, JWT_SECRET, etc."
  echo ""
  echo "    2. Start the platform:"
  echo "       docker-compose -f docker-compose.prod.yml up -d"
  echo ""
  echo "    3. Check service health:"
  echo "       docker-compose -f docker-compose.prod.yml ps"
  echo ""
  echo "    4. Access the dashboard:"
  echo "       http://<server-ip>"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "WARNING: Some images failed to load. Check the output above."
  exit 1
fi
