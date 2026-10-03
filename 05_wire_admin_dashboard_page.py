from pathlib import Path

def patch(path: Path, old: str, new: str, label: str):
    src = path.read_text()
    count = src.count(old)
    if count != 1:
        print(f"SKIP — {label} (expected 1 match, found {count})")
        return
    path.write_text(src.replace(old, new))
    print(f"OK — {label}")

root = Path(".")
page = root / "frontend/src/pages/DashboardPage.tsx"

patch(
    page,
    "import { useAuthStore } from '../stores/auth.store';",
    """import { useAuthStore } from '../stores/auth.store';
import { AdminDashboardSection, type AdminDashboardStats } from '../modules/dashboard/AdminDashboardSection';""",
    "DashboardPage.tsx: AdminDashboardSection import added",
)

patch(
    page,
    "type DashboardData = DoctorDashboard | FacilityDashboard;",
    "type DashboardData = DoctorDashboard | FacilityDashboard | AdminDashboardStats;",
    "DashboardPage.tsx: DashboardData union extended with AdminDashboardStats",
)

patch(
    page,
    """      {!isDoctor && (
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Dashboard</h1>
          <p className="text-clinical-500 text-sm mt-1">
            Welcome back, {user?.firstName}. Here's what's happening today.
          </p>
        </div>
      )}""",
    """      {!isDoctor && data?.scope !== 'admin' && (
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Dashboard</h1>
          <p className="text-clinical-500 text-sm mt-1">
            Welcome back, {user?.firstName}. Here's what's happening today.
          </p>
        </div>
      )}""",
    "DashboardPage.tsx: generic header now skipped for admin (AdminDashboardSection has its own)",
)

patch(
    page,
    """              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.patientsByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="patients" fill="#c11414" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}""",
    """              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.patientsByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="patients" fill="#c11414" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {data && data.scope === 'admin' && (
        <AdminDashboardSection data={data} user={user} navigate={navigate} />
      )}
    </div>
  );
}""",
    "DashboardPage.tsx: admin branch added — doctor/facility branches untouched",
)

print("\nDone. The doctor and facility branches are byte-for-byte unchanged —")
print("this only adds a third, independent branch for scope === 'admin'.")
