#!/bin/bash
set -uo pipefail
echo "📁 Working directory: $(pwd)"

BACKEND_DIR=$(find . -maxdepth 2 -type d -iname "backend" | head -1)
if [ -z "$BACKEND_DIR" ]; then
  echo "ERROR: could not find a 'backend' directory under $(pwd)"
  exit 1
fi
echo "Found backend at: $BACKEND_DIR"
echo

echo "── backend/src top-level structure ──────────────────────────────────────"
find "$BACKEND_DIR/src" -maxdepth 2 -type d | sort
echo

echo "── app.module.ts ────────────────────────────────────────────────────────"
APP_MODULE=$(find "$BACKEND_DIR/src" -maxdepth 1 -iname "app.module.ts" | head -1)
if [ -n "$APP_MODULE" ]; then
  cat -n "$APP_MODULE"
else
  echo "Not found at src/app.module.ts — searching deeper..."
  find "$BACKEND_DIR/src" -iname "app.module.ts" -exec cat -n {} \;
fi
echo

echo "── Looking for an existing similar module (invoices/payments/billing) ───"
for name in invoices invoice payments payment billing; do
  DIR=$(find "$BACKEND_DIR/src" -maxdepth 3 -type d -iname "*${name}*" | head -1)
  if [ -n "$DIR" ]; then
    echo "### Found module dir: $DIR"
    find "$DIR" -type f -name "*.ts" | sort
    echo
  fi
done

echo "── Picking one full module to dump in detail ────────────────────────────"
PICK=$(find "$BACKEND_DIR/src" -maxdepth 3 -type d -iname "*invoice*" | head -1)
if [ -z "$PICK" ]; then
  PICK=$(find "$BACKEND_DIR/src" -maxdepth 3 -type d -iname "*payment*" | head -1)
fi
if [ -z "$PICK" ]; then
  PICK=$(find "$BACKEND_DIR/src" -maxdepth 3 -type d -iname "*billing*" | head -1)
fi

if [ -n "$PICK" ]; then
  echo "Dumping full contents of: $PICK"
  echo
  for f in $(find "$PICK" -type f -name "*.ts" | sort); do
    echo "----- FILE: $f -----"
    cat -n "$f"
    echo
  done
else
  echo "No invoice/payment/billing module found — please tell me which existing module to model this on."
fi

echo "── ORM / DB clues (package.json deps) ────────────────────────────────────"
if [ -f "$BACKEND_DIR/package.json" ]; then
  grep -E '"(typeorm|prisma|@prisma/client|mongoose|sequelize|pg|mysql2|sqlite3)"' "$BACKEND_DIR/package.json" || echo "No obvious ORM/DB deps matched — check package.json manually."
fi
echo

echo "── Prisma schema (if present) ─────────────────────────────────────────────"
SCHEMA=$(find "$BACKEND_DIR" -iname "schema.prisma" | head -1)
if [ -n "$SCHEMA" ]; then
  echo "Found: $SCHEMA"
  cat -n "$SCHEMA"
else
  echo "No schema.prisma found (likely TypeORM entities instead, shown above if module found)."
fi

echo
echo "── Auth guard / decorator used in existing controllers ────────────────────"
grep -rn "UseGuards\|@Roles(" "$BACKEND_DIR/src" | grep -v node_modules | head -20

echo
echo "🎉 Done. Paste this whole output back."
