#!/bin/bash
set -e

echo "📁 Working directory: $(pwd)"

if [ ! -d "frontend/src" ]; then
  echo "❌ Run this from the project root (the folder containing 'backend' and 'frontend')."
  exit 1
fi

echo ""
echo "── Files with 'expense' in the name ────────────────────────────────────"
find frontend/src -iname "*expense*" -type f | grep -v node_modules || echo "(none found by filename)"

echo ""
echo "── Files that mention 'expense' (case-insensitive) inside them ─────────"
grep -ril "expense" frontend/src --include="*.tsx" --include="*.ts" | grep -v node_modules || echo "(none found by content)"

echo ""
echo "── Dumping each matching file in full ────────────────────────────────────"
FILES=$( { find frontend/src -iname "*expense*" -type f; grep -ril "expense" frontend/src --include="*.tsx" --include="*.ts"; } | grep -v node_modules | sort -u)

if [ -z "$FILES" ]; then
  echo "⚠️  No expense-related files found under frontend/src."
else
  for f in $FILES; do
    echo ""
    echo "----- FILE: $f -----"
    cat -n "$f"
  done
fi

echo ""
echo "🎉 Done. Paste this whole output back."
