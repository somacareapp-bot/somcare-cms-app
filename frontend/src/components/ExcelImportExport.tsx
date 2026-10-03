import { useMemo, useRef, useState } from 'react';
import { Upload, Download, Loader2, X } from 'lucide-react';
import {
  ExcelField, SheetData, autoMap, buildRecords, downloadTemplate, exportToExcel, readSheet,
} from '../utils/excelTools';

type Row = { id: string; name: string; [key: string]: any };

interface Props {
  title: string;
  fields: ExcelField[];
  rows: Row[];
  getAllRows?: () => Promise<Row[]>;
  onCreate: (data: Record<string, any>) => Promise<unknown>;
  onUpdate: (id: string, data: Record<string, any>) => Promise<unknown>;
  onDone?: () => void;
}

const keyOf = (name: unknown) => String(name ?? '').trim().toLowerCase();

function errMsg(e: any): string {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || e?.message || 'Failed';
}

export function ExcelImportExport({ title, fields, rows, getAllRows, onCreate, onUpdate, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<(SheetData & { fileName: string }) | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Map<string, Row>>(new Map());
  const [updateExisting, setUpdateExisting] = useState(true);
  const [phase, setPhase] = useState<'map' | 'running' | 'done'>('map');
  const [progress, setProgress] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const base = title.toLowerCase().replace(/\s+/g, '-');

  const defaults = useMemo(
    () => Object.fromEntries(fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.key, f.defaultValue])),
    [fields],
  );

  const parsed = useMemo(() => {
    if (!sheet) return [];
    const seen = new Set<string>();
    return buildRecords(sheet.body, mapping, fields).map((p) => {
      const k = keyOf(p.data.name);
      if (k && seen.has(k)) p.errors.push('Duplicate name in the file');
      if (k) seen.add(k);
      return p;
    });
  }, [sheet, mapping, fields]);

  const valid = parsed.filter((p) => p.errors.length === 0);
  const invalid = parsed.filter((p) => p.errors.length > 0);
  const toUpdate = valid.filter((p) => existing.has(keyOf(p.data.name)));
  const toAdd = valid.filter((p) => !existing.has(keyOf(p.data.name)));
  const jobCount = toAdd.length + (updateExisting ? toUpdate.length : 0);
  const missingRequired = fields.filter((f) => f.required && (mapping[f.key] ?? -1) < 0);

  async function handleExport() {
    setLoading(true);
    try {
      const data = getAllRows ? await getAllRows() : rows;
      exportToExcel(data, fields, base);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const s = await readSheet(file);
      if (!s.headers.length || !s.body.length) throw new Error('This file has no rows to import.');
      const all = getAllRows ? await getAllRows() : rows;
      setExisting(new Map(all.map((r) => [keyOf(r.name), r])));
      setMapping(autoMap(s.headers, fields));
      setSheet({ ...s, fileName: file.name });
      setPhase('map');
    } catch (err: any) {
      setError(err?.message || 'Could not read this file. Use .xlsx, .xls or .csv.');
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    setPhase('running');
    setProgress(0);
    const jobs = [
      ...toAdd.map((p) => ({ add: true, p })),
      ...(updateExisting ? toUpdate.map((p) => ({ add: false, p })) : []),
    ];
    const fails: string[] = [];
    let done = 0;
    for (let i = 0; i < jobs.length; i++) {
      const { add, p } = jobs[i];
      setProgress(i + 1);
      try {
        if (add) await onCreate({ ...defaults, ...p.data });
        else await onUpdate(existing.get(keyOf(p.data.name))!.id, p.data);
        done++;
      } catch (e) {
        fails.push(`Row ${p.rowNumber} (${p.data.name}): ${errMsg(e)}`);
      }
    }
    setOkCount(done);
    setFailures(fails);
    setPhase('done');
    onDone?.();
  }

  const btn =
    'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-clinical-200 bg-white text-clinical-700 hover:bg-clinical-50 disabled:opacity-50';

  return (
    <>
      <button type="button" className={btn} disabled={loading} onClick={() => fileRef.current?.click()}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import Excel
      </button>
      <button type="button" className={btn} disabled={loading} onClick={handleExport}>
        <Download size={15} /> Export Excel
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={pickFile} />

      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-sm flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
            <div className="border-b border-clinical-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-clinical-900">Import {title}</h2>
              <p className="text-sm text-clinical-500">
                {sheet.fileName} · {sheet.body.length} rows
              </p>
            </div>

            {phase === 'map' && (
              <>
                <div className="overflow-y-auto px-6 py-4">
                  <p className="mb-3 text-sm text-clinical-500">
                    We matched your columns automatically. Change any that look wrong.
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-clinical-500">
                        <th className="pb-2 font-medium">Field in the app</th>
                        <th className="pb-2 font-medium">Column in your file</th>
                        <th className="pb-2 font-medium">First value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => {
                        const col = mapping[f.key] ?? -1;
                        return (
                          <tr key={f.key} className="border-t border-clinical-100">
                            <td className="py-2 pr-3 text-clinical-900">
                              {f.label}
                              {f.required && <span className="text-red-600"> *</span>}
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                className="w-full rounded-md border border-clinical-200 px-2 py-1.5"
                                value={col}
                                onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                              >
                                <option value={-1}>Skip this field</option>
                                {sheet.headers.map((h, i) => (
                                  <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 text-clinical-500">
                              {col >= 0 ? String(sheet.body[0]?.[col] ?? '') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {missingRequired.length > 0 && (
                    <p className="mt-3 text-sm text-red-600">
                      Choose a column for: {missingRequired.map((f) => f.label).join(', ')}.
                    </p>
                  )}

                  <div className="mt-4 rounded-lg bg-clinical-50 p-3 text-sm text-clinical-700">
                    <p>
                      {toAdd.length} new · {toUpdate.length} already exist · {invalid.length} with problems
                    </p>
                    {toUpdate.length > 0 && (
                      <label className="mt-2 flex items-center gap-2">
                        <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                        Update the {toUpdate.length} items that already exist (matched by name)
                      </label>
                    )}
                    {invalid.length > 0 && (
                      <ul className="mt-2 max-h-24 list-disc overflow-y-auto pl-5 text-red-600">
                        {invalid.slice(0, 20).map((p) => (
                          <li key={p.rowNumber}>Row {p.rowNumber}: {p.errors.join(', ')} (skipped)</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-clinical-100 px-6 py-4">
                  <button type="button" className="text-sm text-clinical-600 underline" onClick={() => downloadTemplate(fields, base)}>
                    Download blank template
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className={btn} onClick={() => setSheet(null)}>Cancel</button>
                    <button
                      type="button"
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      disabled={missingRequired.length > 0 || jobCount === 0}
                      onClick={runImport}
                    >
                      Import {jobCount} items
                    </button>
                  </div>
                </div>
              </>
            )}

            {phase === 'running' && (
              <div className="flex items-center justify-center gap-2 px-6 py-16 text-clinical-600">
                <Loader2 size={18} className="animate-spin" /> Importing {progress} of {jobCount}…
              </div>
            )}

            {phase === 'done' && (
              <>
                <div className="overflow-y-auto px-6 py-6 text-sm">
                  <p className="text-base font-semibold text-clinical-900">
                    {okCount} item{okCount === 1 ? '' : 's'} imported
                    {failures.length > 0 && `, ${failures.length} failed`}
                  </p>
                  {failures.length > 0 && (
                    <ul className="mt-3 max-h-48 list-disc overflow-y-auto pl-5 text-red-600">
                      {failures.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end border-t border-clinical-100 px-6 py-4">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700"
                    onClick={() => setSheet(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
