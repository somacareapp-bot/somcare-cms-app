import * as XLSX from 'xlsx';

export type FieldType = 'text' | 'number' | 'date' | 'stock' | 'enum';

export interface ExcelField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  aliases?: string[];
  unitKey?: string; // for 'stock': "138 Box" -> quantity + unit
  options?: string[]; // for 'enum'
  defaultValue?: string | number; // used only when creating new items
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
}

export interface SheetData {
  headers: string[];
  body: any[][];
}

/* ---------- fuzzy matching ---------- */
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2));
  const A = grams(a);
  const B = grams(b);
  const seen = new Map<string, number>();
  A.forEach((g) => seen.set(g, (seen.get(g) || 0) + 1));
  let hit = 0;
  B.forEach((g) => {
    const c = seen.get(g) || 0;
    if (c > 0) {
      hit++;
      seen.set(g, c - 1);
    }
  });
  return (2 * hit) / (A.length + B.length);
}

function score(header: string, field: ExcelField): number {
  const h = norm(header);
  if (!h) return 0;
  const names = [field.key, field.label, ...(field.aliases || [])].map(norm);
  let best = 0;
  for (const n of names) {
    if (h === n) return 1;
    if (n.length >= 3 && h.length >= 3 && (h.includes(n) || n.includes(h))) {
      best = Math.max(best, 0.6 + 0.3 * (Math.min(h.length, n.length) / Math.max(h.length, n.length)));
    }
    best = Math.max(best, dice(h, n));
  }
  return best;
}

/** Returns { fieldKey: columnIndex or -1 }. Each file column is used at most once. */
export function autoMap(headers: string[], fields: ExcelField[], threshold = 0.55): Record<string, number> {
  const pairs: { key: string; i: number; s: number }[] = [];
  fields.forEach((f) =>
    headers.forEach((h, i) => {
      const s = score(h, f);
      if (s >= threshold) pairs.push({ key: f.key, i, s });
    }),
  );
  pairs.sort((a, b) => b.s - a.s);
  const mapping: Record<string, number> = Object.fromEntries(fields.map((f) => [f.key, -1]));
  const used = new Set<number>();
  for (const p of pairs) {
    if (mapping[p.key] !== -1 || used.has(p.i)) continue;
    mapping[p.key] = p.i;
    used.add(p.i);
  }
  return mapping;
}

/* ---------- reading ---------- */
export async function readSheet(file: File): Promise<SheetData> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
  // header row = first row (within the top 10) that has 2 or more filled cells
  let hi = grid.slice(0, 10).findIndex((r) => r.filter((c) => String(c).trim() !== '').length >= 2);
  if (hi < 0) hi = 0;
  const headers = (grid[hi] || []).map((h) => String(h).trim());
  const body = grid.slice(hi + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  return { headers, body };
}

/* ---------- cleaning ---------- */
const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? null : n;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toISODate(v: unknown): string | null {
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // avoids timezone off-by-one-day
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : toISODate(new Date(t));
}

/** "138 Box" -> { quantity: 138, unit: "Box" }, "53 tablet(s)" -> 53 + "tablet" */
function splitStock(v: unknown): { quantity: number | null; unit: string } {
  if (typeof v === 'number') return { quantity: v, unit: '' };
  const m = String(v).trim().match(/^(-?[\d.,]+)\s*(.*)$/);
  if (!m) return { quantity: null, unit: '' };
  return { quantity: toNumber(m[1]), unit: m[2].replace(/\(s\)$/i, '').trim() };
}

function toEnum(raw: unknown, options: string[]): string | null {
  const n = norm(raw);
  if (!n) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const o of options) {
    const on = norm(o);
    const s = on === n ? 1 : dice(n, on);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return bestScore >= 0.7 ? best : null;
}

export function buildRecords(body: any[][], mapping: Record<string, number>, fields: ExcelField[]): ParsedRow[] {
  return body.map((row, idx) => {
    const data: Record<string, any> = {};
    const errors: string[] = [];
    for (const f of fields) {
      const col = mapping[f.key] ?? -1;
      const raw = col >= 0 ? row[col] : '';
      if (String(raw ?? '').trim() === '') {
        if (f.required) errors.push(`${f.label} is missing`);
        continue;
      }
      if (f.type === 'number') {
        const n = toNumber(raw);
        if (n == null) errors.push(`${f.label} is not a number`);
        else data[f.key] = n;
      } else if (f.type === 'date') {
        const d = toISODate(raw);
        if (!d) errors.push(`${f.label} is not a valid date`);
        else data[f.key] = d;
      } else if (f.type === 'stock') {
        const s = splitStock(raw);
        if (s.quantity == null) errors.push(`${f.label} is not a number`);
        else {
          data[f.key] = s.quantity;
          if (s.unit && f.unitKey) data[f.unitKey] = s.unit;
        }
      } else if (f.type === 'enum') {
        const m = toEnum(raw, f.options || []);
        if (m) data[f.key] = m;
      } else {
        data[f.key] = String(raw).trim();
      }
    }
    return { rowNumber: idx + 1, data, errors };
  });
}

/* ---------- export ---------- */
const pretty = (s: string) => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

function sheetFromRows(rows: any[], fields: ExcelField[]): XLSX.WorkSheet {
  const header = fields.map((f) => f.label);
  const aoa: any[][] = [
    header,
    ...rows.map((r) =>
      fields.map((f) => {
        const v = r[f.key];
        if (v == null) return '';
        if (f.type === 'date') return String(v).slice(0, 10);
        if (f.type === 'number' || f.type === 'stock') return Number(v);
        if (f.type === 'enum') return pretty(String(v));
        return v;
      }),
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = header.map((h, i) => ({
    wch: Math.min(40, Math.max(h.length, ...aoa.slice(1, 200).map((r) => String(r[i] ?? '').length)) + 2),
  }));
  return ws;
}

export function exportToExcel(rows: any[], fields: ExcelField[], baseName: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, fields), 'Data');
  XLSX.writeFile(wb, `${baseName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadTemplate(fields: ExcelField[], baseName: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows([], fields), 'Data');
  XLSX.writeFile(wb, `${baseName}-template.xlsx`);
}
