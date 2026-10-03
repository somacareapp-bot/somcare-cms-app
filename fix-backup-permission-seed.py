#!/usr/bin/env python3
"""
Fixes TS2740/TS2322 in backend/src/database/seeds/add-backup-permission.ts.

Cause: `permissionRepo.create({...} as any)` makes TypeScript pick TypeORM's
array-returning create()/save() overload instead of the single-entity one,
so `permission` gets typed as Permission[] and later as Permission | null.

Fix: drop the `as any` cast (a plain object literal resolves the single-entity
overload correctly) and add an explicit non-null check after the found/create
branch so TypeScript narrows `permission` to `Permission` for the rest of the
function -- matching the runtime guarantee that it's set either way.

Run from the project root:
    cd "/Users/adminnopassword/Documents/Clinical MS/cms"
    python3 fix-backup-permission-seed.py
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "backend/src/database/seeds/add-backup-permission.ts"
STAMP = datetime.now().strftime("%Y%m%d%H%M%S")


def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + f".bak.{STAMP}")
    shutil.copy2(path, bak)
    print(f"  backed up -> {bak.relative_to(ROOT)}")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        print(f"  !! target for '{label}' matched {count} time(s), expected 1 -- skipping, check manually")
        return text
    return text.replace(old, new)


def main() -> None:
    if not TARGET.exists():
        sys.exit(f"Not found: {TARGET}")
    print(f"Patching {TARGET.relative_to(ROOT)}")
    backup(TARGET)
    text = TARGET.read_text()

    old_create_block = """  let permission = await permissionRepo.findOne({ where: { name: PERMISSION_NAME } });
  if (!permission) {
    permission = await permissionRepo.save(
      permissionRepo.create({
        name: PERMISSION_NAME,
        module: 'backup',
        action: 'manage',
        description: 'Create, download, and restore full database backups',
      } as any),
    );
    console.log(`created permission ${PERMISSION_NAME}`);
  } else {
    console.log(`permission ${PERMISSION_NAME} already exists`);
  }"""

    new_create_block = """  let permission = await permissionRepo.findOne({ where: { name: PERMISSION_NAME } });
  if (!permission) {
    const created = permissionRepo.create({
      name: PERMISSION_NAME,
      module: 'backup',
      action: 'manage',
      description: 'Create, download, and restore full database backups',
    });
    permission = await permissionRepo.save(created);
    console.log(`created permission ${PERMISSION_NAME}`);
  } else {
    console.log(`permission ${PERMISSION_NAME} already exists`);
  }

  if (!permission) {
    throw new Error('Failed to create or find the backup:manage permission');
  }"""

    text = replace_once(text, old_create_block, new_create_block, "permission find-or-create block")

    text = replace_once(
        text,
        "    const already = (manager.permissions ?? []).some((p) => p.id === permission!.id);",
        "    const already = (manager.permissions ?? []).some((p) => p.id === permission.id);",
        "already-has-permission check (drop ! now that permission is narrowed)",
    )
    TARGET.write_text(text)
    print("  done")
    print("\nRe-run: npx ts-node src/database/seeds/add-backup-permission.ts")


if __name__ == "__main__":
    main()
