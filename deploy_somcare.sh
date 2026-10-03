#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Somcare CMS — deploy diagnosis codes update
# Run from the project root: /Users/adminnopassword/Documents/Clinical\ MS/cms
# ─────────────────────────────────────────────────────────────────────────────

set -e  # stop on any error

PROJECT_ROOT="/Users/adminnopassword/Documents/Clinical MS/cms"
DOWNLOADS="$HOME/Downloads"

# Make sure we're in the right place
cd "$PROJECT_ROOT"
echo "📁 Working directory: $(pwd)"
echo ""

# ── 1. Back up the original ConsultationPage before overwriting ───────────────
BACKUP_DIR="$PROJECT_ROOT/frontend/src/modules/clinical/.backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
cp \
  frontend/src/modules/clinical/ConsultationPage.tsx \
  "$BACKUP_DIR/ConsultationPage.tsx.$TIMESTAMP.bak"
echo "✅ Backup saved → .backups/ConsultationPage.tsx.$TIMESTAMP.bak"

# ── 2. Copy new ConsultationPage into the frontend ────────────────────────────
cp \
  "$DOWNLOADS/ConsultationPage.tsx" \
  frontend/src/modules/clinical/ConsultationPage.tsx
echo "✅ ConsultationPage.tsx → frontend/src/modules/clinical/"

# ── 3. Copy backend change notes into the project docs ───────────────────────
mkdir -p docs
cp \
  "$DOWNLOADS/BACKEND_CHANGES.md" \
  docs/BACKEND_CHANGES_diagnosis_codes.md
echo "✅ BACKEND_CHANGES.md  → docs/BACKEND_CHANGES_diagnosis_codes.md"

# ── 4. Confirm both files landed correctly ────────────────────────────────────
echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -lh frontend/src/modules/clinical/ConsultationPage.tsx
ls -lh docs/BACKEND_CHANGES_diagnosis_codes.md

echo ""
echo "🎉 Done. Run the frontend dev server to test:"
echo "   cd frontend && npm run dev"
echo ""
echo "Then apply the backend migration (see docs/BACKEND_CHANGES_diagnosis_codes.md)."
