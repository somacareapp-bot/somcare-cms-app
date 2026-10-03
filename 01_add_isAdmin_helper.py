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

patch(
    root / "backend/src/auth/utils/scope.util.ts",
    """export function isDoctorScoped(user: { roles?: string[] }): boolean {
  const roles = user?.roles ?? [];
  if (roles.includes('administrator') || roles.includes('manager')) return false;
  return roles.includes('doctor');
}""",
    """export function isDoctorScoped(user: { roles?: string[] }): boolean {
  const roles = user?.roles ?? [];
  if (roles.includes('administrator') || roles.includes('manager')) return false;
  return roles.includes('doctor');
}

/**
 * True when the requester holds the administrator role — used to route
 * them to the dedicated admin dashboard instead of the shared facility one.
 */
export function isAdmin(user: { roles?: string[] }): boolean {
  const roles = user?.roles ?? [];
  return roles.includes('administrator');
}""",
    "scope.util.ts: isAdmin() helper added",
)
