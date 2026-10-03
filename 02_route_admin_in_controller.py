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
ctrl = root / "backend/src/reports/reports.controller.ts"

patch(
    ctrl,
    "import { isDoctorScoped } from '../auth/utils/scope.util';",
    "import { isAdmin, isDoctorScoped } from '../auth/utils/scope.util';",
    "reports.controller.ts: isAdmin import added",
)

patch(
    ctrl,
    """  @Get('dashboard')
  getDashboard(@Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return scopeDoctorId
      ? this.reportsService.getDoctorDashboard(scopeDoctorId)
      : this.reportsService.getFacilityDashboard();
  }""",
    """  @Get('dashboard')
  getDashboard(@Request() req: any) {
    if (isAdmin(req.user)) {
      return this.reportsService.getAdminDashboard();
    }
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return scopeDoctorId
      ? this.reportsService.getDoctorDashboard(scopeDoctorId)
      : this.reportsService.getFacilityDashboard();
  }""",
    "reports.controller.ts: getDashboard() checks isAdmin() first",
)

print("\nNote: receptionists, nurses, pharmacists, etc. are untouched — they still")
print("fall through to getFacilityDashboard() exactly as before.")
