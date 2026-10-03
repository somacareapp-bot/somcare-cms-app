/**
 * True when the requester should only see records assigned to them
 * (currently: doctors, unless they also hold an admin/manager role).
 * Centralized here so every controller applies the same rule.
 */
export function isDoctorScoped(user: { roles?: string[] }): boolean {
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
}
