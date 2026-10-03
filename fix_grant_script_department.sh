#!/bin/bash
set -e

python3 << 'PYEOF'
import sys

path = "backend/src/database/seeds/grant-accountant-permissions.ts"

OLD_IMPORT = "import { Patient } from '../../patients/entities/patient.entity';\n"
NEW_IMPORT = (
    "import { Patient } from '../../patients/entities/patient.entity';\n"
    "import { Department } from '../../departments/entities/department.entity';\n"
)

OLD_ENTITIES = "entities: [User, Role, Permission, AuditLog, Patient],\n"
NEW_ENTITIES = "entities: [User, Role, Permission, AuditLog, Patient, Department],\n"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

for old, new, label in [(OLD_IMPORT, NEW_IMPORT, 'import'), (OLD_ENTITIES, NEW_ENTITIES, 'entities array')]:
    count = content.count(old)
    if count != 1:
        print(f"FAILED [{label}]: expected 1 match, found {count}")
        sys.exit(1)
    content = content.replace(old, new, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Patched: {path}")
PYEOF
