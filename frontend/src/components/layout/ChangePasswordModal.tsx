import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, X, Check, Circle, LogOut } from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

const MIN_LEN = 8; // matches the server rule

function strength(pw: string) {
  if (!pw) return 0;
  if (pw.length < MIN_LEN) return 1;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['bg-slate-200', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-green-500'];

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-slate-400'}`}>
      {ok ? <Check size={12} /> : <Circle size={8} />}
      {text}
    </li>
  );
}

export function ChangePasswordModal({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (forced || done) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forced, done, onClose]);

  const okLen = next.length >= MIN_LEN;
  const okDiff = !!next && next !== current;
  const okMatch = !!next && next === confirm;
  const score = strength(next);
  const canSubmit = !!current && okLen && okDiff && okMatch && !saving && !done;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      updateUser({ mustChangePassword: false });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Could not change the password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Lock size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {forced ? 'Choose a new password' : 'Change password'}
              </h3>
              {forced && (
                <p className="text-xs text-slate-500">Your password was set by an administrator. Please choose your own.</p>
              )}
            </div>
          </div>
          {!forced && !done && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
              <Check size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-900">Password changed</p>
            <p className="text-xs text-slate-500">Use your new password next time you log in.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 px-6 py-5">
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

              <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
              <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" />

              {next && (
                <div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`h-1.5 flex-1 rounded-full ${score >= n ? COLORS[score] : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-400">{LABELS[score]}</p>
                </div>
              )}

              <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

              <ul className="space-y-1">
                <Rule ok={okLen} text={`At least ${MIN_LEN} characters`} />
                <Rule ok={okDiff} text="Different from your current password" />
                <Rule ok={okMatch} text="Both new passwords match" />
              </ul>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              {forced ? (
                <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600">
                  <LogOut size={14} /> Log out
                </button>
              ) : (
                <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
              )}
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Change password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Listens for the menu click, and opens by itself when the account is flagged
// "must change password" (after an admin set or reset it).
export function ChangePasswordHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('open-change-password', onOpen);
    return () => window.removeEventListener('open-change-password', onOpen);
  }, []);

  if (!open) return null;
  return <ChangePasswordModal forced={false} onClose={() => setOpen(false)} />;
}
