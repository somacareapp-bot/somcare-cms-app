import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Globe,
  ChevronDown,
  ArrowRight,
  Users,
  ShieldCheck,
  BarChart3,
  HeartPulse,
  UserCircle2,
  UserCog,
  Pill,
  Settings,
} from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import lobbyBackground from '../assets/lobby-background.jpg';
import somcareIcon from '../assets/somcare-icon.png';

type Role = 'doctor' | 'nurse' | 'pharmacist' | 'admin';

const ROLES: { id: Role; label: string; icon: typeof UserCircle2 }[] = [
  { id: 'doctor', label: 'Doctor', icon: UserCircle2 },
  { id: 'nurse', label: 'Nurse', icon: UserCog },
  { id: 'pharmacist', label: 'Pharmacist', icon: Pill },
  { id: 'admin', label: 'Admin', icon: Settings },
];

const FEATURES = [
  { label: 'Better Patient Care', icon: Users },
  { label: 'Secure & Reliable', icon: ShieldCheck },
  { label: 'Efficient Operations', icon: BarChart3 },
  { label: 'Healthier Communities', icon: HeartPulse },
];

function BrandMark({
  layout,
  iconClassName,
  wordmarkClassName,
  subtitleClassName,
  showHalo,
  showSubtitle = true,
}: {
  layout: 'row' | 'stack';
  iconClassName: string;
  wordmarkClassName: string;
  subtitleClassName?: string;
  showHalo?: boolean;
  showSubtitle?: boolean;
}) {
  const icon = (
    <div className="relative shrink-0">
      {showHalo && (
        <div className="absolute inset-0 -m-3 rounded-full bg-white/70 blur-xl" />
      )}
      <img
        src={somcareIcon}
        alt=""
        className={`relative drop-shadow-[0_4px_14px_rgba(0,0,0,0.25)] ${iconClassName}`}
      />
    </div>
  );

  const wordmark = (
    <div className={layout === 'stack' ? 'text-center' : ''}>
      <p className={`font-extrabold leading-none tracking-tight ${wordmarkClassName}`}>
        <span className="text-neutral-900">SOM</span>
        <span className="text-red-600">CARE</span>
      </p>
      {showSubtitle && (
        <p className={`mt-1.5 font-semibold uppercase tracking-[0.15em] ${subtitleClassName}`}>
          Healthcare Management System
        </p>
      )}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div className="flex flex-col items-center">
        {icon}
        <div className="mt-3">{wordmark}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {icon}
      {wordmark}
    </div>
  );
}

function LanguageSwitcher() {
  const LANGUAGES = ['English', 'Somali', 'Arabic'];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('English');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <Globe size={16} />
        {selected}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-neutral-100 bg-white py-1 shadow-lg">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                setSelected(lang);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-red-50 hover:text-red-700 ${
                lang === selected
                  ? 'font-semibold text-red-600'
                  : 'text-neutral-600'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LoginPage() {
  const [role, setRole] = useState<Role>('doctor');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authApi.login({ username, password });
      setAuth(res.data.user, res.data.access_token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Invalid username, password, or role. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-white flex flex-col lg:flex-row">
      {/* Decorative corner triangles — framing the whole viewport, behind all content */}
      <CornerTriangles />

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />

      {/* Left: brand / photo panel */}
      <div className="relative z-10 hidden lg:flex lg:w-[58%] overflow-hidden">
        <img
          src={lobbyBackground}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />

        <div className="relative z-20 flex w-full flex-col justify-end p-12 xl:p-16">
          {/* Headline + features, on a frosted panel so it reads over any part of the photo */}
          <div className="max-w-md rounded-2xl bg-white/80 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md xl:p-7">
            <h1 className="text-3xl font-bold leading-tight text-neutral-900 xl:text-[2.15rem]">
              Complete Healthcare
              <br />
              Management <span className="text-red-600">System</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
              Manage patients, doctors, departments, appointments, pharmacy,
              laboratory, radiology and more — all in one place.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
              {FEATURES.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-red-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-700 text-white shadow-sm transition-transform duration-150 group-hover:scale-105 group-hover:bg-red-800">
                    <Icon size={18} strokeWidth={2.25} />
                  </span>
                  <span className="text-sm font-semibold text-neutral-800">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Signature */}
          <p className="font-serif text-xl italic text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            Your Health, Our Priority
            <span className="mt-1 block h-[2px] w-32 rounded-full bg-red-600" />
          </p>
        </div>
      </div>

      {/* Right: login card — curved, elevated, with a deep black shadow */}
      <div className="relative z-20 flex w-full flex-1 items-center justify-center bg-neutral-50 p-3 lg:w-[42%] lg:bg-transparent lg:p-6">
        <div className="flex w-full flex-col justify-center rounded-[2rem] bg-white px-8 py-6 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.55)] sm:px-12 lg:px-14 lg:py-7">
          <div className="mx-auto w-full max-w-sm">
            <div className="flex justify-end">
              <LanguageSwitcher />
            </div>

            <div className="mt-1 flex flex-col items-center text-center">
              <BrandMark
                layout="stack"
                iconClassName="h-24 w-24"
                wordmarkClassName="text-3xl"
                subtitleClassName="text-[10px] text-neutral-500"
              />
              <h2 className="mt-2 text-xl font-bold text-neutral-900">
                Login to Your Account
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                Access your dashboard and manage your patients, appointments
                and more.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors peer-focus:text-red-600"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or Email"
                  autoComplete="username"
                  className="peer w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-sm text-neutral-800 outline-none transition-all placeholder:text-neutral-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors peer-focus:text-red-600"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="peer w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-11 text-sm text-neutral-800 outline-none transition-all placeholder:text-neutral-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-red-600 accent-red-600 focus:ring-red-500"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-red-600 to-red-700 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(185,28,28,0.35)] transition-all hover:shadow-[0_6px_20px_rgba(185,28,28,0.45)] active:scale-[0.98] active:shadow-[0_2px_8px_rgba(185,28,28,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  'Signing in…'
                ) : (
                  <>
                    <ArrowRight size={16} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Or
              </span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {ROLES.map(({ id, label, icon: Icon }) => {
                const active = role === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRole(id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      active
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-center text-xs text-neutral-400">
              <p className="font-medium text-neutral-500">SOMCARE v1.0.0</p>
              <p>© 2026 SOMCARE. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CornerTriangles() {
  const base =
    'absolute z-0 bg-gradient-to-br from-red-600 to-red-800 pointer-events-none';
  return (
    <>
      {/* top-left */}
      <div
        className={base}
        style={{
          top: 0,
          left: 0,
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '0 0 220px 220px',
          borderColor: 'transparent transparent #b91c1c transparent',
        }}
      />
      {/* top-right — enlarged, this is the corner that peeks around the curved card */}
      <div
        className={base}
        style={{
          top: 0,
          right: 0,
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '0 340px 340px 0',
          borderColor: 'transparent #b91c1c transparent transparent',
        }}
      />
      {/* bottom-left */}
      <div
        className={base}
        style={{
          bottom: 0,
          left: 0,
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '220px 0 0 220px',
          borderColor: 'transparent transparent transparent #b91c1c',
        }}
      />
      {/* bottom-right — enlarged, matching the top-right corner */}
      <div
        className={base}
        style={{
          bottom: 0,
          right: 0,
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '420px 420px 0 0',
          borderColor: '#b91c1c transparent transparent transparent',
        }}
      />
      {/* thin white inset line so the red reads as a frame, not a filled corner */}
      <div className="pointer-events-none absolute inset-3 z-[1] rounded-[1.5rem] ring-1 ring-white/40" />
    </>
  );
}

function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(username);
    } catch {
      // Still show the generic message — never reveal whether the request succeeded.
    } finally {
      setIsSubmitting(false);
      setSent(true);
    }
  }

  function handleClose() {
    setUsername('');
    setSent(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <>
            <h3 className="text-lg font-bold text-neutral-900">Request sent</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              If this account exists, an administrator has been notified and will set a
              new password for you.
            </p>
            <button
              onClick={handleClose}
              className="mt-5 w-full rounded-xl bg-gradient-to-b from-red-600 to-red-700 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-neutral-900">Forgot password?</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Enter your username and an administrator will be notified to reset it for
              you.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !username.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-b from-red-600 to-red-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
