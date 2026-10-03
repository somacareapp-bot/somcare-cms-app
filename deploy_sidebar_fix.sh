#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Somcare CMS — deploy reorganized sidebar (fixed)
# The Sidebar.tsx is already in the project root (it was mv'd there).
# Run from project root: /Users/adminnopassword/Documents/Clinical\ MS/cms
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_ROOT="/Users/adminnopassword/Documents/Clinical MS/cms"
TARGET="frontend/src/components/layout/Sidebar.tsx"
BACKUP_DIR="frontend/src/components/layout/.backups"

cd "$PROJECT_ROOT"
echo "📁 Working directory: $(pwd)"
echo ""

# ── Check the source file is here in the project root ────────────────────────
if [ ! -f "Sidebar.tsx" ]; then
  echo "❌ Sidebar.tsx not found in project root."
  echo "   Please download it from the chat and place it in:"
  echo "   $PROJECT_ROOT/"
  exit 1
fi

# ── 1. Backup existing sidebar ────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
cp "$TARGET" "$BACKUP_DIR/Sidebar.tsx.$TIMESTAMP.bak"
echo "✅ Backup saved → $BACKUP_DIR/Sidebar.tsx.$TIMESTAMP.bak"

# ── 2. Copy from project root into the layout folder ─────────────────────────
cp "Sidebar.tsx" "$TARGET"
echo "✅ Sidebar.tsx → $TARGET"

# ── 3. Clean up the file from project root ────────────────────────────────────
rm "Sidebar.tsx"
echo "🗑  Removed Sidebar.tsx from project root"

# ── 4. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -lh "$TARGET"

echo ""
echo "🎉 Done! Sections are now: Dashboard · Patient Flow · Clinical · Finance · Operations"
echo ""
echo "Start the dev server to preview:"
echo "   cd frontend && npm run dev"
