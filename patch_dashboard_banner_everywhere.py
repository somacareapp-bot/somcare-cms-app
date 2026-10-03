path = "frontend/src/pages/DashboardPage.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Banner: remove the `isDoctor &&` guard so it renders for every role,
#    and make the welcome line role-aware instead of always "Dr."
old_banner = """      {/* Doctor hero banner */}
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
      )}

      {!isDoctor && data?.scope !== 'admin' && (
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Dashboard</h1>
          <p className="text-clinical-500 text-sm mt-1">Welcome back, {user?.firstName}. Here's what's happening today.</p>
        </div>
      )}"""

new_banner = """      {/* SOMCARE hero banner — shown on every dashboard, not just doctors */}
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
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Welcome, {isDoctor ? `Dr. ${user?.lastName ?? user?.fullName}` : (user?.fullName ?? user?.firstName)}
              </h1>
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

      <div className="flex justify-end items-center gap-2 text-clinical-500 text-sm -mt-2">
        <Calendar size={16} />
        {today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      </div>"""

if old_banner in content:
    content = content.replace(old_banner, new_banner)
    changes += 1
else:
    print("ERROR: banner anchor not found — aborting without writing.")
    raise SystemExit

if changes == 0:
    print("ERROR: no changes applied. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update — SOMCARE banner now shows on every dashboard scope (doctor, nurse, receptionist, pharmacist, accountant, facility, laboratory, admin).")
