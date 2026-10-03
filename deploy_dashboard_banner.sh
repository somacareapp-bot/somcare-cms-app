#!/bin/bash
set -e

cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

DASHBOARD="frontend/src/pages/DashboardPage.tsx"
BACKUP_DIR="frontend/src/pages/.backups"
ASSETS_DIR="frontend/src/assets"
TS=$(date +%Y%m%d_%H%M%S)

if [ ! -f "$DASHBOARD" ]; then
  echo "❌ Could not find $DASHBOARD — run this from the cms project root."
  exit 1
fi

if [ ! -f "dashboard-doctor.jpeg" ]; then
  echo "❌ Could not find dashboard-doctor.jpeg next to this script — download it and place it here first."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$DASHBOARD" "$BACKUP_DIR/DashboardPage.tsx.$TS.bak"
echo "✅ Backup saved → $BACKUP_DIR/DashboardPage.tsx.$TS.bak"

mkdir -p "$ASSETS_DIR"
cp "dashboard-doctor.jpeg" "$ASSETS_DIR/dashboard-doctor.jpeg"
echo "✅ dashboard-doctor.jpeg → $ASSETS_DIR/"

if [ ! -f "$ASSETS_DIR/somacare-logo.png" ]; then
  echo "⚠️  $ASSETS_DIR/somacare-logo.png not found — the banner logo import will fail to resolve."
  echo "    (It should already be there from the earlier sidebar-logo patch.)"
fi

python3 patch_dashboard_banner.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -la "$DASHBOARD" "$ASSETS_DIR/dashboard-doctor.jpeg"
echo ""
echo "🎉 Done. Start the dev server to preview:"
echo "   cd frontend && npm run dev"
