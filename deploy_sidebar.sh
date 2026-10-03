#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Somcare CMS — deploy reorganized sidebar
# Run from project root: /Users/adminnopassword/Documents/Clinical\ MS/cms
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_ROOT="/Users/adminnopassword/Documents/Clinical MS/cms"
DOWNLOADS="$HOME/Downloads"
TARGET="frontend/src/components/layout/Sidebar.tsx"
BACKUP_DIR="frontend/src/components/layout/.backups"

cd "$PROJECT_ROOT"
echo "📁 Working directory: $(pwd)"
echo ""

# ── 1. Backup existing sidebar ────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
cp "$TARGET" "$BACKUP_DIR/Sidebar.tsx.$TIMESTAMP.bak"
echo "✅ Backup saved → $BACKUP_DIR/Sidebar.tsx.$TIMESTAMP.bak"

# ── 2. Copy new sidebar ───────────────────────────────────────────────────────
cp "$DOWNLOADS/Sidebar.tsx" "$TARGET"
echo "✅ Sidebar.tsx → $TARGET"

# ── 3. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -lh "$TARGET"

echo ""
echo "🎉 Done! Sections are now: Dashboard · Patient Flow · Clinical · Finance · Operations"
echo ""
echo "Start the dev server to preview:"
echo "   cd frontend && npm run dev"
