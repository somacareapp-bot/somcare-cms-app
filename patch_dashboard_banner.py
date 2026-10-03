path = "frontend/src/pages/DashboardPage.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Imports: drop unused Stethoscope icon, add the logo + doctor photo assets
old_icon_import = """import {
  Users, Calendar, Clock, FlaskConical, Pill, UserCheck, Activity, Loader2,
  Stethoscope, ArrowRight, TrendingUp, DollarSign, AlertTriangle, Package,
  CheckCircle, XCircle,
} from 'lucide-react';"""
new_icon_import = """import {
  Users, Calendar, Clock, FlaskConical, Pill, UserCheck, Activity, Loader2,
  ArrowRight, TrendingUp, DollarSign, AlertTriangle, Package,
  CheckCircle, XCircle,
} from 'lucide-react';"""
if old_icon_import in content:
    content = content.replace(old_icon_import, new_icon_import)
    changes += 1
else:
    print("WARN: lucide-react import anchor not found")

old_dashboard_import = "import { AdminDashboardSection, type AdminDashboardStats } from '../modules/dashboard/AdminDashboardSection';"
new_dashboard_import = """import { AdminDashboardSection, type AdminDashboardStats } from '../modules/dashboard/AdminDashboardSection';
import logoImg from '../assets/somacare-logo.png';
import doctorImg from '../assets/dashboard-doctor.jpeg';"""
if new_dashboard_import in content:
    pass  # already added
elif old_dashboard_import in content:
    content = content.replace(old_dashboard_import, new_dashboard_import)
    changes += 1
else:
    print("WARN: AdminDashboardSection import anchor not found")

# ── 2. Replace the doctor hero banner with one matching the reference design
old_banner = """      {/* Doctor hero banner */}
      {isDoctor && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 p-6 sm:p-8">
          <Stethoscope size={180} className="absolute -right-6 -bottom-10 text-white/10 rotate-[-15deg] pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt={user.fullName} className="w-14 h-14 rounded-full object-cover border-2 border-white/40 flex-shrink-0" />
                : <div className="w-14 h-14 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center flex-shrink-0"><Stethoscope size={26} className="text-white" /></div>
              }
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, Dr. {user?.lastName ?? user?.fullName}</h1>
                <p className="text-primary-100 text-sm mt-0.5">{user?.department ? `${user.department} · ` : ''}Manage your patients, consultations and clinical services.</p>
              </div>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5 text-white text-sm font-medium flex items-center gap-2 self-start sm:self-auto">
              <Calendar size={16} />
              {today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}"""

new_banner = """      {/* Doctor hero banner */}
      {isDoctor && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800">
          <div className="relative flex flex-col sm:flex-row sm:items-stretch">
            {/* Logo + wordmark */}
            <div className="flex items-center gap-3 px-6 py-5 sm:border-r border-white/15 flex-shrink-0">
              <img src={logoImg} alt="Somcare" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
              <div>
                <p className="font-extrabold text-lg sm:text-xl leading-tight tracking-wide whitespace-nowrap">
                  <span className="text-white">SOM</span><span className="text-red-400">CARE</span>
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/60 tracking-wide whitespace-nowrap">Better Health &bull; Brighter Future</p>
              </div>
            </div>

            {/* Welcome message */}
            <div className="flex-1 flex items-center px-6 py-5 min-w-0">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, Dr. {user?.lastName ?? user?.fullName}</h1>
                <p className="text-white/80 text-sm mt-1">You are logged in to SOMCARE. Let's make a healthier tomorrow together.</p>
              </div>
            </div>

            {/* Doctor photo */}
            <div className="hidden md:block relative w-52 lg:w-64 flex-shrink-0 overflow-hidden">
              <img src={doctorImg} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/50 to-transparent" />
            </div>

            {/* Tagline corner */}
            <div className="hidden lg:flex flex-col items-end justify-center px-6 py-5 text-right flex-shrink-0 max-w-[190px]">
              <p className="text-white font-semibold text-sm leading-snug">Advanced care for a healthier community.</p>
            </div>
          </div>
        </div>
      )}

      {isDoctor && (
        <div className="flex justify-end items-center gap-2 text-clinical-500 text-sm -mt-2">
          <Calendar size={16} />
          {today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}"""

if old_banner in content:
    content = content.replace(old_banner, new_banner)
    changes += 1
else:
    print("ERROR: doctor hero banner anchor not found — aborting without writing.")
    raise SystemExit

# ── 3. Remove the "+ Register Patient / New Appointment / Check-in / Start
#    Consultation" quick-action buttons entirely
old_actions = """      <div className="flex flex-wrap gap-2">
        {[
          { label: '+ Register Patient', color: 'bg-primary-600 text-white' },
          { label: 'New Appointment',    color: 'bg-clinical-700 text-white' },
          { label: 'Check-in',           color: 'bg-blue-600 text-white' },
          { label: 'Start Consultation', color: 'bg-green-600 text-white' },
        ].map((a) => (
          <button key={a.label} className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 ${a.color}`}>{a.label}</button>
        ))}
      </div>

"""
if old_actions in content:
    content = content.replace(old_actions, "")
    changes += 1
else:
    print("WARN: quick-action buttons block anchor not found")

if changes == 0:
    print("ERROR: no changes applied — file may already differ from every known version. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update(s) — banner rebuilt to match reference design, quick-action buttons removed.")
