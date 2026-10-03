#!/bin/bash
set -e

cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

SIDEBAR="frontend/src/components/layout/Sidebar.tsx"
BACKUP_DIR="frontend/src/components/layout/.backups"
ASSETS_DIR="frontend/src/assets"
TS=$(date +%Y%m%d_%H%M%S)

if [ ! -f "$SIDEBAR" ]; then
  echo "❌ Could not find $SIDEBAR — run this from the cms project root."
  exit 1
fi

if [ ! -f "somacare-logo.png" ]; then
  echo "❌ Could not find somacare-logo.png next to this script — download it and place it here first."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$SIDEBAR" "$BACKUP_DIR/Sidebar.tsx.$TS.bak"
echo "✅ Backup saved → $BACKUP_DIR/Sidebar.tsx.$TS.bak"

mkdir -p "$ASSETS_DIR"
cp "somacare-logo.png" "$ASSETS_DIR/somacare-logo.png"
echo "✅ somacare-logo.png → $ASSETS_DIR/"

python3 patch_sidebar_logo.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -la "$SIDEBAR" "$ASSETS_DIR/somacare-logo.png"
echo ""
echo "🎉 Done. Start the dev server to preview:"
echo "   cd frontend && npm run dev"
