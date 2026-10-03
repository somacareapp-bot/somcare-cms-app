#!/bin/bash
set -e

cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

SIDEBAR="frontend/src/components/layout/Sidebar.tsx"
BACKUP_DIR="frontend/src/components/layout/.backups"
TS=$(date +%Y%m%d_%H%M%S)

if [ ! -f "$SIDEBAR" ]; then
  echo "❌ Could not find $SIDEBAR — run this from the cms project root."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$SIDEBAR" "$BACKUP_DIR/Sidebar.tsx.$TS.bak"
echo "✅ Backup saved → $BACKUP_DIR/Sidebar.tsx.$TS.bak"

python3 patch_sidebar_add_bloodbank.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
grep -n "Blood Bank" "$SIDEBAR" || true
echo ""
echo "🎉 Done. Start the dev server to preview:"
echo "   cd frontend && npm run dev"
