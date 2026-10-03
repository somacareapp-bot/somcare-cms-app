import re
from pathlib import Path

path = Path("backend/src/reports/reports.module.ts")
src = path.read_text()
original = src

# 1) Ensure imports for Medicine and Invoice entities exist
medicine_import = "import { Medicine } from '../pharmacy/entities/medicine.entity';\n"
invoice_import = "import { Invoice } from '../billing/entities/invoice.entity';\n"

to_add = ""
if "pharmacy/entities/medicine.entity" not in src:
    to_add += medicine_import
if "billing/entities/invoice.entity" not in src:
    to_add += invoice_import

if to_add:
    import_lines = list(re.finditer(r'^import .*;\s*$', src, flags=re.MULTILINE))
    if import_lines:
        insert_pos = import_lines[-1].end()
        src = src[:insert_pos] + "\n" + to_add.rstrip("\n") + src[insert_pos:]
    else:
        src = to_add + src
    print("OK — reports.module.ts: added missing entity imports")
else:
    print("SKIP — Medicine/Invoice imports already present")

# 2) Add Medicine/Invoice to the TypeOrmModule.forFeature([...]) array
match = re.search(r'TypeOrmModule\.forFeature\(\[([^\]]*)\]\)', src)
if match:
    entities = [e.strip() for e in match.group(1).split(',') if e.strip()]
    changed = False
    if 'Medicine' not in entities:
        entities.append('Medicine')
        changed = True
    if 'Invoice' not in entities:
        entities.append('Invoice')
        changed = True
    if changed:
        new_str = f"TypeOrmModule.forFeature([{', '.join(entities)}])"
        src = src[:match.start()] + new_str + src[match.end():]
        print(f"OK — reports.module.ts: forFeature array updated -> {new_str}")
    else:
        print("SKIP — Medicine and Invoice already registered in forFeature")
else:
    print("MANUAL STEP NEEDED — couldn't find a TypeOrmModule.forFeature([...]) call.")
    print("Add this yourself to the module's `imports` array:")
    print("  TypeOrmModule.forFeature([Medicine, Invoice])")
    print("(alongside whatever entities are already registered there)")

if src != original:
    path.write_text(src)
    print("\nreports.module.ts saved.")
else:
    print("\nNo changes were needed.")
