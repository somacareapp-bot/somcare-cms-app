import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BackupService } from './backup.service';

export type ResetMode = 'reset' | 'reset-all';

// "Reset" clears day-to-day records. Names are entity class names (lowercase, without "Entity").
const OPERATIONAL = [
  'patient', 'visit', 'prescription', 'appointment',
  'laborder', 'laborderitem', 'laborderoordercharge'.replace('oorder', 'order'),
  'radiologyorder', 'radiologyorderitem',
  'sale', 'saleitem', 'salereturn', 'purchase', 'purchaseitem',
  'invoice', 'invoiceitem', 'payment', 'expense',
  'labsupplypurchase', 'labsupplypurchaseitem', 'labsupplystocklog',
  'blooddonor', 'bloodmovement', 'notification', 'activitylog',
  'leaverequest', 'leaveadjustment',
];

// "Reset all" clears everything except these (plus the administrator doing the reset).
const KEEP_ON_RESET_ALL = ['user', 'role', 'permission', 'loginsessionsettings', 'facilitysettings'];

interface Plan {
  order: string[]; // delete order, child tables first
  kept: { table: string; reason: string }[];
  detach: { table: string; column: string }[];
  unmatched: string[];
}

@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly backups: BackupService,
  ) {}

  private key(name: string) {
    return name.toLowerCase().replace(/entity$/, '');
  }

  private buildPlan(mode: ResetMode): Plan {
    const metas = this.dataSource.entityMetadatas.filter((m) => m.tableType !== 'view');
    const refsOf = (m: (typeof metas)[number]) => m.foreignKeys.map((fk) => fk.referencedEntityMetadata.tableName);
    const target = new Set<string>();
    const unmatched: string[] = [];

    if (mode === 'reset') {
      for (const n of OPERATIONAL) {
        const hits = metas.filter((m) => m.tableType !== 'junction' && this.key(m.name) === n);
        if (!hits.length) unmatched.push(n);
        hits.forEach((m) => target.add(m.tableName));
      }
      metas
        .filter((m) => m.tableType === 'junction' && refsOf(m).some((r) => target.has(r)))
        .forEach((m) => target.add(m.tableName));
    } else {
      const keep = new Set(KEEP_ON_RESET_ALL);
      metas
        .filter((m) => m.tableType !== 'junction' && !keep.has(this.key(m.name)))
        .forEach((m) => target.add(m.tableName));
      metas
        .filter((m) => m.tableType === 'junction' && refsOf(m).every((r) => target.has(r)))
        .forEach((m) => target.add(m.tableName));
    }

    // A kept table with a REQUIRED link to a table we wanted to clear: keep that table too.
    const kept: { table: string; reason: string }[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of metas) {
        if (target.has(m.tableName)) continue;
        for (const fk of m.foreignKeys) {
          const ref = fk.referencedEntityMetadata.tableName;
          if (target.has(ref) && fk.columns.some((c) => !c.isNullable)) {
            target.delete(ref);
            kept.push({ table: ref, reason: `required by ${m.tableName}` });
            changed = true;
          }
        }
      }
    }

    // Optional links from kept tables into cleared tables are set to empty.
    const detach: { table: string; column: string }[] = [];
    for (const m of metas) {
      if (target.has(m.tableName)) continue;
      for (const fk of m.foreignKeys) {
        if (!target.has(fk.referencedEntityMetadata.tableName)) continue;
        fk.columns.forEach((c) => detach.push({ table: m.tableName, column: c.databaseName }));
      }
    }

    // Delete order: tables that nobody else points to go first.
    const refs = new Map<string, Set<string>>();
    for (const m of metas) {
      if (target.has(m.tableName)) {
        refs.set(m.tableName, new Set(refsOf(m).filter((r) => target.has(r) && r !== m.tableName)));
      }
    }
    const order: string[] = [];
    const remaining = new Set(target);
    while (remaining.size) {
      const free = [...remaining].filter((t) => ![...remaining].some((u) => u !== t && refs.get(u)?.has(t)));
      if (!free.length) {
        order.push(...remaining);
        break;
      }
      free.forEach((t) => {
        order.push(t);
        remaining.delete(t);
      });
    }

    return { order, kept, detach, unmatched };
  }

  async preview(mode: ResetMode) {
    if (mode !== 'reset' && mode !== 'reset-all') throw new BadRequestException('Invalid reset mode');
    const plan = this.buildPlan(mode);
    const tables: { table: string; rows: number }[] = [];
    for (const t of plan.order) {
      const r = await this.dataSource.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      tables.push({ table: t, rows: r[0].n });
    }
    return {
      mode,
      tables: tables.sort((a, b) => b.rows - a.rows),
      totalRows: tables.reduce((s, t) => s + t.rows, 0),
      kept: plan.kept,
      unmatched: plan.unmatched,
    };
  }

  async run(mode: ResetMode, confirmText: string, userId?: string) {
    if (mode !== 'reset' && mode !== 'reset-all') throw new BadRequestException('Invalid reset mode');
    const phrase = mode === 'reset' ? 'RESET' : 'RESET ALL';
    if ((confirmText || '').trim() !== phrase) {
      throw new BadRequestException(`Type ${phrase} to confirm`);
    }

    const metas = this.dataSource.entityMetadatas;
    const userMeta = metas.find((m) => this.key(m.name) === 'user');
    if (mode === 'reset-all') {
      if (!userId || !userMeta) throw new BadRequestException('Could not identify the administrator account. Nothing was changed.');
      const pk = userMeta.primaryColumns[0].databaseName;
      const found = await this.dataSource.query(`SELECT 1 FROM "${userMeta.tableName}" WHERE "${pk}" = $1`, [userId]);
      if (!found.length) throw new BadRequestException('Administrator account not found. Nothing was changed.');
    }

    const plan = this.buildPlan(mode);
    const before = await this.preview(mode);

    // 1) Safety backup. If it fails, nothing is deleted.
    const backup = await this.backups.create();

    // 2) Wipe inside one transaction.
    try {
      await this.dataSource.transaction(async (em) => {
        for (const d of plan.detach) {
          await em.query(`UPDATE "${d.table}" SET "${d.column}" = NULL`);
        }
        for (const t of plan.order) {
          await em.query(`DELETE FROM "${t}"`);
        }
        if (mode === 'reset-all' && userMeta) {
          const pk = userMeta.primaryColumns[0].databaseName;
          for (const m of metas) {
            if (plan.order.includes(m.tableName)) continue;
            for (const fk of m.foreignKeys) {
              if (fk.referencedEntityMetadata.tableName !== userMeta.tableName) continue;
              for (const c of fk.columns) {
                if (c.isNullable) {
                  await em.query(`UPDATE "${m.tableName}" SET "${c.databaseName}" = NULL WHERE "${c.databaseName}" <> $1`, [userId]);
                }
              }
            }
          }
          await em.query(`DELETE FROM "${userMeta.tableName}" WHERE "${pk}" <> $1`, [userId]);
        }
      });
    } catch (err: any) {
      this.logger.error(`App reset (${mode}) FAILED and was rolled back: ${err.message}`);
      throw new InternalServerErrorException(
        `Reset failed and was rolled back, so your data is unchanged. Reason: ${err.message}`,
      );
    }

    this.logger.warn(`APP RESET (${mode}) by user ${userId}; safety backup ${backup.filename}`);
    return {
      mode,
      safetyBackup: backup.filename,
      tablesCleared: plan.order.length,
      rowsDeleted: before.totalRows,
    };
  }
}
