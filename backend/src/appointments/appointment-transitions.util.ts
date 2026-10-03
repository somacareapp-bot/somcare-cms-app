interface Transition {
  to: string;
  roles: string[];
}

// Appointments only own the pre-clinical part of the journey now.
// Once an appointment hits 'waiting', a Visit is created (see
// AppointmentsController.updateStatus) and the rest of the journey
// (triage -> with_doctor -> completed) is owned by VisitsService /
// the clinical Triage queue, not by this controller.
const APPOINTMENT_TRANSITIONS: Record<string, Transition[]> = {
  scheduled: [
    { to: 'confirmed', roles: ['receptionist'] },
    { to: 'cancelled', roles: ['receptionist'] },
    { to: 'no_show', roles: ['receptionist'] },
  ],
  confirmed: [
    { to: 'waiting', roles: ['receptionist'] },
    { to: 'cancelled', roles: ['receptionist'] },
    { to: 'no_show', roles: ['receptionist'] },
  ],
};

export function canTransition(fromStatus: string, toStatus: string, userRoles: string[]): boolean {
  if (userRoles.includes('administrator')) return true;
  const allowed = APPOINTMENT_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  const match = allowed.find((t) => t.to === toStatus);
  if (!match) return false;
  return match.roles.some((r) => userRoles.includes(r));
}
