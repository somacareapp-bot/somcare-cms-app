#!/bin/bash
set -e

cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

DASHBOARD="frontend/src/pages/DashboardPage.tsx"
BACKUP_DIR="frontend/src/pages/.backups"
TS=$(date +%Y%m%d_%H%M%S)

if [ ! -f "$DASHBOARD" ]; then
  echo "❌ Could not find $DASHBOARD — run this from the cms project root."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$DASHBOARD" "$BACKUP_DIR/DashboardPage.tsx.$TS.bak"
echo "✅ Backup saved → $BACKUP_DIR/DashboardPage.tsx.$TS.bak"

python3 patch_dashboard_banner_everywhere.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -la "$DASHBOARD"
echo ""
echo "🎉 Done. Start the dev server to preview:"
echo "   cd frontend && npm run dev"
echo "Check the dashboard while logged in as different roles (admin, nurse, pharmacist, etc.) — the banner should show on all of them."
