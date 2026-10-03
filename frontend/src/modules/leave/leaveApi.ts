import api from '../../services/api';

// Works whether the API layer returns raw data or wraps it as { data: ... }.
const unwrap = (r: any) => {
  // Full axios response -> take .data; already-unwrapped (interceptor) -> use as is.
  let d = r && typeof r === 'object' && 'config' in r && 'status' in r ? r.data : r;
  // Envelope like { success: true, data: ... }
  if (d && !Array.isArray(d) && typeof d === 'object' && d.data !== undefined && (d.success !== undefined || Object.keys(d).length <= 2)) d = d.data;
  return d;
};

const report = (e: any) => {
  try {
    const st = e?.response?.status;
    const m = e?.response?.data?.message;
    const msg = `Leave API error${st ? ' ' + st : ''}: ${Array.isArray(m) ? m.join(', ') : m || e?.message}`;
    let el = document.getElementById('leave-api-error');
    if (!el) {
      const box = document.createElement('div');
      box.id = 'leave-api-error';
      box.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;max-width:420px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font:13px system-ui;cursor:pointer';
      box.onclick = () => box.remove();
      document.body.appendChild(box);
      el = box;
    }
    el.textContent = msg;
  } catch { /* ignore */ }
  throw e;
};

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveMe {
  userId: string;
  isAdmin: boolean;
  isApprover: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  accrualPerMonth: number;
  maxDaysPerYear: number | null;
  maxDaysPerRequest: number | null;
  isPaid: boolean;
  isUnlimited: boolean;
  isActive: boolean;
  color: string;
}

export type LeaveTypeInput = Partial<Omit<LeaveType, 'id'>> & { name: string };

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approverId: string | null;
  approverName: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface BalanceRow {
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  color: string;
  isUnlimited: boolean;
  accrualPerMonth: number;
  accrued: number;
  adjustment: number;
  used: number;
  pending: number;
  available: number | null;
}

export interface CalendarEntry {
  id: string;
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  color: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
}

export const leaveApi = {
  me: (): Promise<LeaveMe> => api.get('/api/leave/me').then(unwrap, report),

  types: (all = false): Promise<LeaveType[]> => api.get('/api/leave/types', { params: all ? { all: 1 } : {} }).then(unwrap, report),
  createType: (body: LeaveTypeInput): Promise<LeaveType> => api.post('/api/leave/types', body).then(unwrap),
  updateType: (id: string, body: Partial<LeaveTypeInput>): Promise<LeaveType> => api.patch(`/api/leave/types/${id}`, body).then(unwrap),
  deleteType: (id: string): Promise<{ deleted: boolean; deactivated: boolean }> => api.delete(`/api/leave/types/${id}`).then(unwrap),

  balances: (scope: 'mine' | 'all', year: number): Promise<{ year: number; rows: BalanceRow[] }> =>
    api.get('/api/leave/balances', { params: { scope, year } }).then(unwrap, report),
  adjust: (body: { userId: string; leaveTypeId: string; year: number; days: number; note?: string }) =>
    api.post('/api/leave/balances/adjust', body).then(unwrap),

  requests: (scope: 'mine' | 'all'): Promise<LeaveRequest[]> => api.get('/api/leave/requests', { params: { scope } }).then(unwrap, report),
  createRequest: (body: { leaveTypeId: string; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequest> =>
    api.post('/api/leave/requests', body).then(unwrap),
  cancel: (id: string): Promise<LeaveRequest> => api.patch(`/api/leave/requests/${id}/cancel`).then(unwrap),

  approvals: (view: 'pending' | 'decided'): Promise<LeaveRequest[]> => api.get('/api/leave/approvals', { params: { view } }).then(unwrap, report),
  decide: (id: string, body: { decision: 'approve' | 'reject'; note?: string }): Promise<LeaveRequest> =>
    api.patch(`/api/leave/requests/${id}/decision`, body).then(unwrap),

  calendar: (from: string, to: string): Promise<CalendarEntry[]> => api.get('/api/leave/calendar', { params: { from, to } }).then(unwrap, report),
};
