#!/bin/bash
set -uo pipefail
echo "📁 Working directory: $(pwd)"
BACKEND_DIR="./backend"

echo "── Real backend/src/billing module ────────────────────────────────────────"
for f in $(find "$BACKEND_DIR/src/billing" -maxdepth 3 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── backend/src/common (base entity, decorators, guards, filters) ──────────"
for f in $(find "$BACKEND_DIR/src/common" -maxdepth 3 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── Auth guards / permissions guard ─────────────────────────────────────────"
for f in $(find "$BACKEND_DIR/src/auth/guards" -maxdepth 1 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── Auth decorators (e.g. @Roles / @Permissions) ────────────────────────────"
for f in $(find "$BACKEND_DIR/src/auth/decorators" -maxdepth 1 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── Roles module (how roles/permissions are structured) ─────────────────────"
for f in $(find "$BACKEND_DIR/src/roles" -maxdepth 2 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── Users entity (role/permission fields) ────────────────────────────────────"
for f in $(find "$BACKEND_DIR/src/users/entities" -maxdepth 1 -type f -name "*.ts" ! -name "*.bak" | sort); do
  echo "----- FILE: $f -----"
  cat -n "$f"
  echo
done

echo "── Frontend api.ts (service pattern) ─────────────────────────────────────────"
API_FILE=$(find . -path "*/frontend/src/services/api.ts" | head -1)
if [ -n "$API_FILE" ]; then
  echo "Found: $API_FILE"
  cat -n "$API_FILE"
else
  echo "Not found at expected path — searching..."
  find . -iname "api.ts" ! -path "*/node_modules/*"
fi

echo
echo "🎉 Done. Paste this whole output back."
