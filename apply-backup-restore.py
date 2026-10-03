#!/usr/bin/env python3
"""
Adds full Postgres backup & restore to Settings > System.

New files:
  backend/src/backup/backup.module.ts
  backend/src/backup/backup.controller.ts
  backend/src/backup/backup.service.ts
  backend/src/database/seeds/add-backup-permission.ts
  frontend/src/modules/settings/BackupRestorePage.tsx

Edited (backed up first):
  backend/src/app.module.ts               -> registers BackupModule
  frontend/src/services/api.ts             -> adds backupApi
  frontend/src/modules/settings/SettingsPage.tsx -> adds "System" category / tab

After running:
  1. cd backend && npx ts-node src/database/seeds/add-backup-permission.ts
     (grants backup:manage to Manager; Administrator already bypasses all
     permission checks in PermissionsGuard, so it needs nothing extra)
  2. Restart backend (npm run start:dev) and frontend if needed
  3. Settings > System > Backup & Restore
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
STAMP = datetime.now().strftime("%Y%m%d%H%M%S")


def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + f".bak.{STAMP}")
    shutil.copy2(path, bak)
    print(f"  backed up -> {bak.relative_to(ROOT)}")


def write_new(path: Path, content: str) -> None:
    if path.exists():
        sys.exit(f"Refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  created {path.relative_to(ROOT)}")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        print(f"  !! target for '{label}' matched {count} time(s), expected 1 -- skipping, check manually")
        return text
    return text.replace(old, new)


# --------------------------------------------------------------------
# New backend files
# --------------------------------------------------------------------

BACKUP_SERVICE = """import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;
  private readonly dbHost: string;
  private readonly dbPort: string;
  private readonly dbName: string;
  private readonly dbUser: string | undefined;
  private readonly dbPassword: string | undefined;
  private readonly pgBinDir: string;

  constructor(private readonly config: ConfigService) {
    const configuredDir = this.config.get<string>('BACKUP_DIR', '../backups');
    this.backupDir = path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(process.cwd(), configuredDir);
    fs.mkdirSync(this.backupDir, { recursive: true });

    this.dbHost = this.config.get<string>('DB_HOST', 'localhost');
    this.dbPort = String(this.config.get<number>('DB_PORT', 5432));
    this.dbName = this.config.get<string>('DB_NAME')!;
    this.dbUser = this.config.get<string>('DB_USERNAME') || undefined;
    this.dbPassword = this.config.get<string>('DB_PASSWORD') || undefined;
    // Optional: set PG_BIN_DIR in .env if pg_dump/pg_restore aren't on PATH
    // (e.g. /Applications/Postgres.app/Contents/Versions/latest/bin)
    this.pgBinDir = this.config.get<string>('PG_BIN_DIR', '');
  }

  private bin(name: string): string {
    return this.pgBinDir ? path.join(this.pgBinDir, name) : name;
  }

  private pgEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    if (this.dbPassword) env.PGPASSWORD = this.dbPassword;
    return env;
  }

  private baseArgs(): string[] {
    const args = ['-h', this.dbHost, '-p', this.dbPort];
    if (this.dbUser) args.push('-U', this.dbUser);
    return args;
  }

  private safeFilename(filename: string): string {
    const base = path.basename(filename);
    if (!/^[\\w.-]+\\.dump$/.test(base)) {
      throw new BadRequestException('Invalid backup filename');
    }
    return base;
  }

  async list(): Promise<BackupFileInfo[]> {
    const entries = fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.dump'));
    return entries
      .map((filename) => {
        const stat = fs.statSync(path.join(this.backupDir, filename));
        return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(): Promise<BackupFileInfo> {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const filename = `${this.dbName}-${stamp}.dump`;
    const filePath = path.join(this.backupDir, filename);

    try {
      await execFileAsync(
        this.bin('pg_dump'),
        [...this.baseArgs(), '-Fc', '-f', filePath, this.dbName],
        { env: this.pgEnv(), maxBuffer: 1024 * 1024 * 64 },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(`Backup failed: ${err.stderr || err.message}`);
    }

    const stat = fs.statSync(filePath);
    return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
  }

  getFilePath(filename: string): string {
    const safe = this.safeFilename(filename);
    const filePath = path.join(this.backupDir, safe);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Backup file not found');
    return filePath;
  }

  async restoreFromPath(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) throw new NotFoundException('Backup file not found');
    try {
      await execFileAsync(
        this.bin('pg_restore'),
        [...this.baseArgs(), '-d', this.dbName, '--clean', '--if-exists', '--no-owner', filePath],
        { env: this.pgEnv(), maxBuffer: 1024 * 1024 * 64 },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(`Restore reported errors: ${err.stderr || err.message}`);
    }
  }

  async restoreFromExisting(filename: string): Promise<void> {
    await this.restoreFromPath(this.getFilePath(filename));
  }

  delete(filename: string): void {
    fs.unlinkSync(this.getFilePath(filename));
  }
}
"""

BACKUP_CONTROLLER = """import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BackupService } from './backup.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Permissions('backup:manage')
  @Get()
  list() {
    return this.service.list();
  }

  @Permissions('backup:manage')
  @Post()
  create() {
    return this.service.create();
  }

  @Permissions('backup:manage')
  @Get(':filename/download')
  download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.service.getFilePath(filename);
    res.download(filePath);
  }

  @Permissions('backup:manage')
  @Post(':filename/restore')
  async restoreExisting(@Param('filename') filename: string) {
    await this.service.restoreFromExisting(filename);
    return { restored: true };
  }

  @Permissions('backup:manage')
  @Delete(':filename')
  remove(@Param('filename') filename: string) {
    this.service.delete(filename);
    return { deleted: true };
  }

  @Permissions('backup:manage')
  @Post('restore-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = './uploads/backup-restore-tmp';
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `upload-${Date.now()}${extname(file.originalname) || '.dump'}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!/\\.dump$/i.test(file.originalname)) {
          return cb(new BadRequestException('Restore file must be a .dump backup'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
    }),
  )
  async restoreUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    try {
      await this.service.restoreFromPath(file.path);
    } finally {
      fs.unlink(file.path, () => {});
    }
    return { restored: true };
  }
}
"""

BACKUP_MODULE = """import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [ConfigModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
"""

BACKUP_SEED = """/**
 * Somcare CMS - grant backup:manage to Manager.
 *
 * Administrator already bypasses every permission check in PermissionsGuard
 * (see backend/src/auth/guards/permissions.guard.ts), so it needs no grant.
 *
 *   npx ts-node src/database/seeds/add-backup-permission.ts
 *
 * Safe to re-run: only adds the permission if missing, never removes anything.
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const PERMISSION_NAME = 'backup:manage';

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Role, Permission, AuditLog, Patient, Department],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(Permission);

  let permission = await permissionRepo.findOne({ where: { name: PERMISSION_NAME } });
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
  }

  const manager = await roleRepo.findOne({ where: { name: 'manager' }, relations: ['permissions'] });
  if (!manager) {
    console.log('Manager role not found - run add-manager-cashier-roles.ts first. Skipping.');
  } else {
    const already = (manager.permissions ?? []).some((p) => p.id === permission!.id);
    if (already) {
      console.log('Manager already has backup:manage');
    } else {
      manager.permissions = [...(manager.permissions ?? []), permission];
      await roleRepo.save(manager);
      console.log('+ granted backup:manage to Manager');
    }
  }

  await dataSource.destroy();
  console.log('\\nDone!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
"""

BACKUP_RESTORE_PAGE = """import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Database, Upload, Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { backupApi } from '../../services/api';

interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

type RestoreTarget = { type: 'existing'; filename: string } | { type: 'upload'; file: File };

export function BackupRestorePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const { data: backups, isLoading } = useQuery<BackupFile[]>({
    queryKey: ['backups'],
    queryFn: () => backupApi.list().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      const filename = res.data.filename as string;
      const fileRes = await backupApi.download(filename);
      triggerBrowserDownload(fileRes.data, filename);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (filename: string) => backupApi.download(filename).then((res) => ({ res, filename })),
    onSuccess: ({ res, filename }) => triggerBrowserDownload(res.data, filename),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => backupApi.remove(filename),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!restoreTarget) return;
      if (restoreTarget.type === 'existing') return backupApi.restoreExisting(restoreTarget.filename);
      return backupApi.restoreUpload(restoreTarget.file);
    },
    onSuccess: () => {
      setRestoreTarget(null);
      setConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const restoreLabel = restoreTarget?.type === 'existing' ? restoreTarget.filename : restoreTarget?.file.name;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Create a backup now</h3>
            <p className="mt-1 text-xs text-gray-500">
              Takes a full snapshot of the database, saves it on the server, and downloads a copy to this computer.
            </p>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            {createMutation.isPending ? 'Backing up…' : 'Backup now'}
          </button>
        </div>
        {createMutation.isError && <p className="mt-3 text-xs text-red-600">Backup failed. Check the server logs.</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Restore from an uploaded file</h3>
        <p className="mt-1 text-xs text-gray-500">
          Upload a .dump backup file. This replaces all current data with the contents of the backup.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dump"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setRestoreTarget({ type: 'upload', file });
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload size={16} />
            Choose backup file…
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Backups on this server</h3>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-gray-400">Loading…</div>
        ) : !backups?.length ? (
          <div className="p-5 text-sm text-gray-400">No backups yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <th className="px-5 py-2 font-medium">File</th>
                <th className="px-5 py-2 font-medium">Size</th>
                <th className="px-5 py-2 font-medium">Created</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{b.filename}</td>
                  <td className="px-5 py-2.5 text-gray-600">{formatSize(b.sizeBytes)}</td>
                  <td className="px-5 py-2.5 text-gray-600">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => downloadMutation.mutate(b.filename)}
                        className="text-gray-500 hover:text-blue-600"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => setRestoreTarget({ type: 'existing', filename: b.filename })}
                        className="text-gray-500 hover:text-amber-600"
                        title="Restore this backup"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${b.filename}? This cannot be undone.`)) {
                            deleteMutation.mutate(b.filename);
                          }
                        }}
                        className="text-gray-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Restore database?</h3>
                <p className="mt-1 text-xs text-gray-600">
                  This will erase all current data and replace it with{' '}
                  <span className="font-mono">{restoreLabel}</span>. This cannot be undone. Type{' '}
                  <span className="font-semibold">RESTORE</span> to confirm.
                </p>
              </div>
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {restoreMutation.isError && <p className="mt-2 text-xs text-red-600">Restore failed. Check the server logs.</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRestoreTarget(null);
                  setConfirmText('');
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={confirmText !== 'RESTORE' || restoreMutation.isPending}
                onClick={() => restoreMutation.mutate()}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {restoreMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Restore now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""


def create_new_files() -> None:
    write_new(ROOT / "backend/src/backup/backup.service.ts", BACKUP_SERVICE)
    write_new(ROOT / "backend/src/backup/backup.controller.ts", BACKUP_CONTROLLER)
    write_new(ROOT / "backend/src/backup/backup.module.ts", BACKUP_MODULE)
    write_new(ROOT / "backend/src/database/seeds/add-backup-permission.ts", BACKUP_SEED)
    write_new(ROOT / "frontend/src/modules/settings/BackupRestorePage.tsx", BACKUP_RESTORE_PAGE)


# --------------------------------------------------------------------
# Edits to existing files
# --------------------------------------------------------------------

def patch_app_module() -> None:
    p = ROOT / "backend/src/app.module.ts"
    if not p.exists():
        sys.exit(f"Not found: {p}")
    print(f"Patching {p.relative_to(ROOT)}")
    backup(p)
    text = p.read_text()

    text = replace_once(
        text,
        "import { FaqModule } from './faq/faq.module';",
        "import { FaqModule } from './faq/faq.module';\nimport { BackupModule } from './backup/backup.module';",
        "FaqModule import (anchor for BackupModule import)",
    )
    text = replace_once(
        text,
        "    OrgChartModule,\n    FaqModule,\n  ],",
        "    OrgChartModule,\n    FaqModule,\n    BackupModule,\n  ],",
        "imports array closing (anchor for BackupModule registration)",
    )
    p.write_text(text)
    print("  done")


def patch_api_ts() -> None:
    p = ROOT / "frontend/src/services/api.ts"
    if not p.exists():
        sys.exit(f"Not found: {p}")
    print(f"Patching {p.relative_to(ROOT)}")
    backup(p)
    text = p.read_text()

    backup_api_block = """
// Backup & restore endpoints
export const backupApi = {
  list: () => api.get('/api/backup'),
  create: () => api.post('/api/backup'),
  download: (filename: string) =>
    api.get(`/api/backup/${encodeURIComponent(filename)}/download`, { responseType: 'blob' }),
  restoreExisting: (filename: string) => api.post(`/api/backup/${encodeURIComponent(filename)}/restore`),
  remove: (filename: string) => api.delete(`/api/backup/${encodeURIComponent(filename)}`),
  restoreUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/backup/restore-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
};
"""
    text = replace_once(
        text,
        "export default api;",
        "export default api;\n" + backup_api_block,
        "'export default api;' (anchor for backupApi block)",
    )
    p.write_text(text)
    print("  done")


def patch_settings_page() -> None:
    p = ROOT / "frontend/src/modules/settings/SettingsPage.tsx"
    if not p.exists():
        sys.exit(f"Not found: {p}")
    print(f"Patching {p.relative_to(ROOT)}")
    backup(p)
    text = p.read_text()

    text = replace_once(
        text,
        "import { StaffDirectoryPage } from '../staff/StaffDirectoryPage';",
        "import { StaffDirectoryPage } from '../staff/StaffDirectoryPage';\n"
        "import { BackupRestorePage } from './BackupRestorePage';",
        "StaffDirectoryPage import (anchor for BackupRestorePage import)",
    )

    old_printing_block = """  {
    id: 'printing',
    label: 'Printing',
    panels: [
      { id: 'printer-settings', title: 'Printer Settings', description: 'Printers for receipts and prescriptions', Component: PrinterSettings },
      { id: 'doc-templates', title: 'Document Templates', description: 'Printable templates used system-wide', Component: DocumentTemplates },
    ],
  },
];"""
    new_printing_block = """  {
    id: 'printing',
    label: 'Printing',
    panels: [
      { id: 'printer-settings', title: 'Printer Settings', description: 'Printers for receipts and prescriptions', Component: PrinterSettings },
      { id: 'doc-templates', title: 'Document Templates', description: 'Printable templates used system-wide', Component: DocumentTemplates },
    ],
  },
  {
    id: 'system',
    label: 'System',
    panels: [
      { id: 'backup-restore', title: 'Backup & Restore', description: 'Full database backup and restore', Component: BackupRestorePage },
    ],
  },
];"""
    text = replace_once(text, old_printing_block, new_printing_block, "Printing category block (anchor for System category)")

    p.write_text(text)
    print("  done")


if __name__ == "__main__":
    print("Creating new files...")
    create_new_files()
    print("\nPatching existing files...")
    patch_app_module()
    patch_api_ts()
    patch_settings_page()
    print(
        "\nDone.\n"
        "Next steps:\n"
        "  1. cd backend && npx ts-node src/database/seeds/add-backup-permission.ts\n"
        "  2. Restart backend (npm run start:dev) and frontend (npm run dev) if needed\n"
        "  3. Go to Settings > System > Backup & Restore\n"
    )
