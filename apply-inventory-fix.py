#!/usr/bin/env python3
"""
Fixes 3 TS compile errors in backend/src/inventory/inventory.service.ts:
  1. LabSupplyStockLogReferenceType not imported
  2. roundMoney not defined (adds local helper, matching the pattern used
     in laboratory.service.ts / radiology.service.ts)
  3. dto.unitCost doesn't exist on RestockLabSupplyDto -> adds an optional
     `unitCost` override field to the DTO (falls back to supply.costPrice
     when omitted, same behavior the original code was already trying to do)

Run from the project root:
    cd "/Users/adminnopassword/Documents/Clinical MS/cms"
    python3 apply-inventory-fix.py
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
SERVICE = ROOT / "backend/src/inventory/inventory.service.ts"
DTO = ROOT / "backend/src/inventory/dto/restock-lab-supply.dto.ts"
STAMP = datetime.now().strftime("%Y%m%d%H%M%S")


def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + f".bak.{STAMP}")
    shutil.copy2(path, bak)
    print(f"  backed up -> {bak.relative_to(ROOT)}")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        print(f"  !! could not find target for: {label} -- skipping this edit, check manually")
        return text
    if count > 1 and "TODO: confirm" not in label:
        print(f"  !! target for '{label}' is not unique ({count} matches) -- skipping, check manually")
        return text
    return text.replace(old, new)


def patch_service() -> None:
    if not SERVICE.exists():
        sys.exit(f"Not found: {SERVICE}")
    print(f"Patching {SERVICE.relative_to(ROOT)}")
    backup(SERVICE)
    text = SERVICE.read_text()

    # 1. import the missing enum
    text = replace_once(
        text,
        "import { LabSupplyStockLog, LabSupplyStockLogType } from './entities/lab-supply-stock-log.entity';",
        "import { LabSupplyStockLog, LabSupplyStockLogType, LabSupplyStockLogReferenceType } from './entities/lab-supply-stock-log.entity';",
        "stock-log entity import",
    )

    # 2. add a local roundMoney helper, same pattern as laboratory.service.ts
    text = replace_once(
        text,
        "import { ApprovalRoutingService } from '../approvals/approval-routing.service';",
        "import { ApprovalRoutingService } from '../approvals/approval-routing.service';\n\n"
        "function roundMoney(value: number): number {\n"
        "  return Math.round((value + Number.EPSILON) * 100) / 100;\n"
        "}",
        "ApprovalRoutingService import (anchor for roundMoney helper)",
    )

    # 3. drop the now-resolved TODO comments (appears twice, same fix both times)
    text = replace_once(
        text,
        " // TODO: confirm this enum member exists",
        "",
        "TODO: confirm this enum member exists (both occurrences)",
    )

    SERVICE.write_text(text)
    print("  done")


def patch_dto() -> None:
    if not DTO.exists():
        sys.exit(f"Not found: {DTO}")
    print(f"Patching {DTO.relative_to(ROOT)}")
    backup(DTO)
    text = DTO.read_text()

    text = replace_once(
        text,
        "  @IsOptional() @IsString()\n  reason?: string;\n}",
        "  @IsOptional() @IsString()\n  reason?: string;\n\n"
        "  @IsOptional() @IsNumber() @Min(0)\n  unitCost?: number;\n}",
        "reason field (anchor for unitCost field)",
    )

    DTO.write_text(text)
    print("  done")


if __name__ == "__main__":
    patch_service()
    patch_dto()
    print("\nDone. Run `npm run start:dev` (or your usual watch command) in backend/ to confirm the 5 errors are gone.")
