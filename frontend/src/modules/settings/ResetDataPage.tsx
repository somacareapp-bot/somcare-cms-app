import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Loader2, RotateCcw } from 'lucide-react';
import { backupApi, resetApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

type Mode = 'reset' | 'reset-all';

interface Preview {
  mode: Mode;
  tables: { table: string; rows: number }[];
  totalRows: number;
  kept: { table: string; reason: string }[];
  unmatched: string[];
}

const MODES: Record<Mode, { title: string; button: string; phrase: string; summary: string; keeps: string }> = {
  reset: {
    title: 'Reset',
    button: 'Reset records',
    phrase: 'RESET',
    summary:
      'Deletes patients, visits, appointments, lab and radiology orders, prescriptions, sales, purchases, invoices, payments, expenses, stock logs, leave requests and notifications.',
    keeps: 'Keeps users, roles, departments, settings, test catalogs, services, medicines and lab supplies.',
  },
  'reset-all': {
    title: 'Reset all',
    button: 'Reset all',
    phrase: 'RESET ALL',
    summary: 'Deletes everything above, plus medicines, lab supplies, catalogs, departments, staff and all other users.',
    keeps: 'Keeps only your administrator account, roles, permissions and login/facility settings, so the app is like a new install.',
  },
};

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

function errText(e: any) {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || e?.message || 'Something went wrong';
}

function Wizard({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const info = MODES[mode];
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'backup' | 'confirm' | 'done'>('backup');
  const [backupFile, setBackupFile] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<any>(null);

  const { data: preview, isLoading } = useQuery<Preview>({
    queryKey: ['reset-preview', mode],
    queryFn: () => resetApi.preview(mode).then((r) => r.data),
    gcTime: 0,
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await backupApi.create();
      const filename = res.data.filename as string;
      const file = await backupApi.download(filename);
      triggerBrowserDownload(file.data, filename);
      return filename;
    },
    onSuccess: (filename) => {
      setBackupFile(filename);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetApi.run(mode, confirmText).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      setStep('done');
      queryClient.invalidateQueries();
    },
  });

  const busy = resetMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{info.title}</h2>
          <p className="text-sm text-gray-500">
            {step === 'backup' && 'Step 1 of 2: back up first'}
            {step === 'confirm' && 'Step 2 of 2: confirm'}
            {step === 'done' && 'Finished'}
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-4 text-sm text-gray-700">
          {step !== 'done' && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} /> This cannot be undone from inside the app.
              </p>
              <p className="mt-1">{info.summary}</p>
              <p className="mt-1">{info.keeps}</p>
            </div>
          )}

          {step !== 'done' && (
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              {isLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Counting records…</span>
              ) : preview ? (
                <>
                  <p className="font-medium text-gray-900">{preview.totalRows.toLocaleString()} records will be deleted</p>
                  <ul className="mt-1 max-h-28 overflow-y-auto text-gray-600">
                    {preview.tables.filter((t) => t.rows > 0).map((t) => (
                      <li key={t.table}>{t.table}: {t.rows.toLocaleString()}</li>
                    ))}
                  </ul>
                  {preview.kept.length > 0 && (
                    <p className="mt-2 text-amber-700">
                      Also kept because other data needs them: {preview.kept.map((k) => k.table).join(', ')}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {step === 'backup' && (
            <>
              <p className="mb-3">
                Download a backup now. You can use it in Backup &amp; Restore to bring everything back. The server also saves its own safety copy right before the reset.
              </p>
              {backupFile ? (
                <p className="flex items-center gap-2 font-medium text-green-700">
                  <CheckCircle2 size={16} /> Backup saved and downloaded: {backupFile}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => backupMutation.mutate()}
                  disabled={backupMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {backupMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Create and download backup
                </button>
              )}
              {backupMutation.isError && <p className="mt-2 text-red-600">Backup failed: {errText(backupMutation.error)}</p>}
            </>
          )}

          {step === 'confirm' && (
            <>
              <p className="mb-2">
                Type <span className="font-mono font-semibold">{info.phrase}</span> to confirm.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={busy}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {resetMutation.isError && <p className="mt-2 text-red-600">{errText(resetMutation.error)}</p>}
            </>
          )}

          {step === 'done' && result && (
            <div>
              <p className="flex items-center gap-2 text-base font-semibold text-green-700">
                <CheckCircle2 size={18} /> {info.title} complete
              </p>
              <p className="mt-2">{result.rowsDeleted.toLocaleString()} records deleted from {result.tablesCleared} tables.</p>
              <p className="mt-1 text-gray-500">Safety backup on the server: {result.safetyBackup}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          {step === 'done' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Reload app
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {step === 'backup' ? (
                <button
                  type="button"
                  disabled={!backupFile || isLoading}
                  onClick={() => setStep('confirm')}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || confirmText.trim() !== info.phrase}
                  onClick={() => resetMutation.mutate()}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />} {info.button}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResetDataPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const isAdmin = useAuthStore((s) => s.user?.roles?.includes('administrator') ?? false);

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
        Only an administrator can reset the app.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(['reset', 'reset-all'] as Mode[]).map((m) => (
        <div key={m} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <RotateCcw size={16} className="text-red-600" /> {MODES[m].title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{MODES[m].summary}</p>
              <p className="mt-1 text-sm text-gray-500">{MODES[m].keeps}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(m)}
              className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              {MODES[m].button}
            </button>
          </div>
        </div>
      ))}
      {mode && <Wizard mode={mode} onClose={() => setMode(null)} />}
    </div>
  );
}
