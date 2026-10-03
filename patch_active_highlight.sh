#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/components/layout/Sidebar.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Run this from your project root (Clinical MS/cms)."
  exit 1
fi

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"
echo "Backed up $FILE"

python3 - "$FILE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()

old_block = """function isActivePath(pathname: string, path: string) {
  if (path === '/pharmacy' && pathname === '/pharmacy') return true;
  if (path === '/pharmacy') return false;
  return path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(path);
}

function containsActive(item: NavItem, pathname: string): boolean {
  if (isActivePath(pathname, item.path)) return true;
  return !!item.children?.some((c) => containsActive(c, pathname));
}"""

new_block = """function collectAllPaths(items: NavItem[]): string[] {
  const paths: string[] = [];
  for (const item of items) {
    paths.push(item.path);
    if (item.children) paths.push(...collectAllPaths(item.children));
  }
  return paths;
}

const ALL_NAV_PATHS = NAV.flatMap((section) => collectAllPaths(section.items));

// Picks the single most specific (longest) matching path in the whole menu,
// so sibling routes that share a text prefix (e.g. /inventory/lab-supplies
// and /inventory/lab-supplies/purchases) never both light up at once.
function findBestMatch(pathname: string): string | null {
  let best: string | null = null;
  for (const p of ALL_NAV_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) {
      if (!best || p.length > best.length) best = p;
    }
  }
  return best;
}

function isActivePath(pathname: string, path: string): boolean {
  return path === findBestMatch(pathname);
}

function containsActive(item: NavItem, pathname: string): boolean {
  if (isActivePath(pathname, item.path)) return true;
  return !!item.children?.some((c) => containsActive(c, pathname));
}"""

if old_block not in content:
    print("ERROR: could not find the active-path logic to replace. Aborting — no changes made.")
    sys.exit(1)

content = content.replace(old_block, new_block)

with open(path, "w") as f:
    f.write(content)

print("Patched:", path)
PYEOF

echo "Done. Diff below:"
echo "---------------------------------------------"
git diff -- "$FILE" || true
