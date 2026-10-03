#!/usr/bin/env python3
"""
Part 1 of facility-settings wiring:
  - Registers FacilitySettingsModule in app.module.ts
  - Adds static file serving for /uploads in main.ts
  - Adds facilityApi to frontend/src/services/api.ts
  - Rewrites the SettingsPage.tsx FacilityInformation() component to use
    the real backend (facilityApi) instead of the local-only draft store,
    and adds a working logo upload button.

Run from your project root (the "cms" folder).
"""
from pathlib import Path
import sys

ROOT = Path(".")

def die(msg):
    print(f"FAILED — {msg}")
    sys.exit(1)

def patch(path: Path, old: str, new: str, label: str):
    if not path.exists():
        die(f"{path} not found")
    text = path.read_text()
    if old not in text:
        die(f"{label}: anchor text not found in {path} (file may have changed — paste me its current content)")
    count = text.count(old)
    if count != 1:
        die(f"{label}: anchor text appears {count} times in {path}, expected exactly 1")
    path.write_text(text.replace(old, new, 1))
    print(f"OK — {label}")

# ── 1. app.module.ts ─────────────────────────────────────────────────────
app_module = ROOT / "backend/src/app.module.ts"
patch(
    app_module,
    "import { LabTestCatalogModule } from './settings/laboratory/lab-test-catalog.module';",
    "import { LabTestCatalogModule } from './settings/laboratory/lab-test-catalog.module';\n"
    "import { FacilitySettingsModule } from './settings/facility/facility-settings.module';",
    "app.module.ts: import added",
)
patch(
    app_module,
    "    RolesModule,\n    LabTestCatalogModule,\n  ],\n})",
    "    RolesModule,\n    LabTestCatalogModule,\n    FacilitySettingsModule,\n  ],\n})",
    "app.module.ts: FacilitySettingsModule registered",
)

# ── 2. main.ts ────────────────────────────────────────────────────────────
main_ts = ROOT / "backend/src/main.ts"
patch(
    main_ts,
    "import { NestFactory } from '@nestjs/core';\n"
    "import { ValidationPipe } from '@nestjs/common';\n"
    "import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';\n"
    "import { ConfigService } from '@nestjs/config';\n"
    "import helmet from 'helmet';\n"
    "import * as compression from 'compression';\n"
    "import { AppModule } from './app.module';\n"
    "\n"
    "async function bootstrap() {\n"
    "  const app = await NestFactory.create(AppModule);",
    "import { NestFactory } from '@nestjs/core';\n"
    "import { NestExpressApplication } from '@nestjs/platform-express';\n"
    "import { ValidationPipe } from '@nestjs/common';\n"
    "import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';\n"
    "import { ConfigService } from '@nestjs/config';\n"
    "import { join } from 'path';\n"
    "import helmet from 'helmet';\n"
    "import * as compression from 'compression';\n"
    "import { AppModule } from './app.module';\n"
    "\n"
    "async function bootstrap() {\n"
    "  const app = await NestFactory.create<NestExpressApplication>(AppModule);",
    "main.ts: switched to NestExpressApplication",
)
patch(
    main_ts,
    "  // Global prefix\n  app.setGlobalPrefix('api');\n",
    "  // Global prefix\n  app.setGlobalPrefix('api');\n\n"
    "  // Serve uploaded files (facility logo, etc.) — NOT under the /api prefix\n"
    "  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });\n",
    "main.ts: static /uploads serving added",
)

# ── 3. frontend/src/services/api.ts ──────────────────────────────────────
api_ts = ROOT / "frontend/src/services/api.ts"
if not api_ts.exists():
    die(f"{api_ts} not found")
current = api_ts.read_text()
if "facilityApi" in current:
    print("SKIP — facilityApi already present in api.ts")
else:
    addition = (
        "\n// Facility settings endpoints\n"
        "export const facilityApi = {\n"
        "  get: () => api.get('/api/settings/facility'),\n"
        "  update: (data: any) => api.patch('/api/settings/facility', data),\n"
        "  uploadLogo: (file: File) => {\n"
        "    const formData = new FormData();\n"
        "    formData.append('logo', file);\n"
        "    return api.post('/api/settings/facility/logo', formData, {\n"
        "      headers: { 'Content-Type': 'multipart/form-data' },\n"
        "    });\n"
        "  },\n"
        "};\n"
    )
    api_ts.write_text(current.rstrip("\n") + "\n" + addition)
    print("OK — facilityApi appended to api.ts")

# ── 4. SettingsPage.tsx ───────────────────────────────────────────────────
settings_page = ROOT / "frontend/src/modules/settings/SettingsPage.tsx"

patch(
    settings_page,
    "import { useState } from 'react';",
    "import { useState, useRef } from 'react';\nimport { Loader2, Upload } from 'lucide-react';",
    "SettingsPage.tsx: imports (useRef, lucide icons) added",
)
patch(
    settings_page,
    "import { rolesApi, permissionsApi, usersApi } from '../../services/api';",
    "import { rolesApi, permissionsApi, usersApi, facilityApi } from '../../services/api';",
    "SettingsPage.tsx: facilityApi import added",
)

OLD_COMPONENT = '''function FacilityInformation() {
  const { draft, patch, save, reset } = useDraft(D.facilityInfoStore);
  return (
    <PanelShell title="Facility Information" description="Name, logo, address, and contact details" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Facility Name"><TextInput value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Registration Number"><TextInput value={draft.regNumber} onChange={(e) => patch({ regNumber: e.target.value })} /></Field>
        <Field label="Address" full><TextInput value={draft.address} onChange={(e) => patch({ address: e.target.value })} /></Field>
        <Field label="City"><TextInput value={draft.city} onChange={(e) => patch({ city: e.target.value })} /></Field>
        <Field label="Country">
          <SelectInput options={['Somaliland', 'Somalia', 'Ethiopia', 'Kenya']} value={draft.country} onChange={(e) => patch({ country: e.target.value })} />
        </Field>
        <Field label="Phone"><TextInput value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} /></Field>
        <Field label="Email"><TextInput type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} /></Field>
        <Field label="Website"><TextInput value={draft.website} onChange={(e) => patch({ website: e.target.value })} /></Field>
      </FieldGrid>
    </PanelShell>
  );
}'''

NEW_COMPONENT = '''function FacilityInformation() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'facility'],
    queryFn: () => facilityApi.get().then((res) => res.data),
  });

  if (settings && !initialized) {
    setForm({
      name: settings.name ?? '',
      tagline: settings.tagline ?? '',
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => facilityApi.update(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => facilityApi.uploadLogo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  if (isLoading) {
    return <div className="text-sm text-clinical-400 py-6">Loading facility settings…</div>;
  }

  const resetForm = () => settings && setForm({
    name: settings.name ?? '',
    tagline: settings.tagline ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
  });

  return (
    <PanelShell
      title="Facility Information"
      description="Name, logo, address, and contact details"
      onSave={() => saveMutation.mutate()}
      onReset={resetForm}
    >
      <div className="border border-clinical-100 rounded-xl p-4 flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-lg border border-clinical-100 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Facility logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-clinical-400 text-center px-1">No logo</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={logoMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-clinical-200 hover:bg-gray-50 transition-colors"
          >
            {logoMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {logoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
          </button>
          <p className="text-[11px] text-clinical-400 mt-1.5">PNG, JPG, SVG or WEBP — up to 5MB.</p>
        </div>
      </div>
      <FieldGrid>
        <Field label="Facility Name"><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tagline"><TextInput value={form.tagline ?? ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
        <Field label="Address" full><TextInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Phone"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><TextInput type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      </FieldGrid>
    </PanelShell>
  );
}'''

patch(settings_page, OLD_COMPONENT, NEW_COMPONENT, "SettingsPage.tsx: FacilityInformation() rewired to backend + logo upload")

print("\nALL PART 1 PATCHES APPLIED SUCCESSFULLY.")
print("NOTE: Registration Number, City, Country, Website fields were dropped —")
print("the backend facility_settings table only has name/tagline/address/phone/email.")
print("Tell me if you want those columns added back; I can extend the entity + DTO + migration.")
