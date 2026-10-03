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

python3 patch_fix_somcare_spelling.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
grep -n "SOMCARE" "$SIDEBAR" || true
echo ""
echo "🎉 Done. Refresh the dev server to see it."
