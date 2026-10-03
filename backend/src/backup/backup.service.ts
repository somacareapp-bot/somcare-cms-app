import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
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
    if (!/^[\w.-]+\.dump$/.test(base)) {
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
