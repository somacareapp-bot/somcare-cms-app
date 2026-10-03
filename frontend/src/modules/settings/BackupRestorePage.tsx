import { useRef, useState } from 'react';
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
