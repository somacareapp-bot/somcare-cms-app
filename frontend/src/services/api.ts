import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 - auto logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Backup & restore endpoints
export const backupApi = {
  list: () => api.get('/api/backup'),
  create: () => api.post('/api/backup'),
  download: (filename: string) =>
    api.get(`/api/backup/${encodeURIComponent(filename)}/download`, { responseType: 'blob' }),
  restoreExisting: (filename: string) => api.post(`/api/backup/${encodeURIComponent(filename)}/restore`),
  remove: (filename: string) => api.delete(`/api/backup/${encodeURIComponent(filename)}`),
  restoreUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/backup/restore-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
};


// Auth endpoints
export const authApi = {
  login: ({ username, password }: { username: string; password: string }) =>
    api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/api/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (username: string) =>
    api.post('/api/auth/forgot-password', { username }),
  logout: () => api.post('/api/auth/logout'),
};

// Patient endpoints
export const searchApi = {
  global: (q: string) => api.get('/api/search', { params: { q } }),
};

// FAQ / help assistant (fully offline, no external API)
export const faqApi = {
  ask: (question: string) => api.post('/api/faq/ask', { question }),
  getCategories: () => api.get('/api/faq/categories'),
};

export const patientsApi = {
  getAll: (params?: any) => api.get('/api/patients', { params }),
  getOne: (id: string) => api.get(`/api/patients/${id}`),
  create: (data: any) => api.post('/api/patients', data),
  update: (id: string, data: any) => api.patch(`/api/patients/${id}`, data),
  delete: (id: string) => api.delete(`/api/patients/${id}`),
  search: (query: string) => api.get('/api/patients/search', { params: { q: query } }),
};

// Visit endpoints (queue + clinical consultation)
export const visitsApi = {
  getQueue: () => api.get('/api/visits/queue'),
  getAll: (status?: string, patientId?: string) => api.get('/api/visits', { params: { status, patientId } }),
  getOne: (id: string) => api.get(`/api/visits/${id}`),
  checkIn: (data: any) => api.post('/api/visits', data),
  updateStatus: (id: string, status: string) => api.patch(`/api/visits/${id}/status`, { status }),
  updateVitals: (id: string, data: any) => api.patch(`/api/visits/${id}/vitals`, data),
  updateConsultation: (id: string, data: any) => api.patch(`/api/visits/${id}/consultation`, data),
  complete: (id: string) => api.patch(`/api/visits/${id}/complete`),
  addPrescription: (id: string, data: any) => api.post(`/api/visits/${id}/prescriptions`, data),
  removePrescription: (id: string, prescriptionId: string) =>
    api.delete(`/api/visits/${id}/prescriptions/${prescriptionId}`),
};

// Users (staff) endpoints
export const wardsApi = {
  getAll: () => api.get('/api/wards'),
};

export const servicesCatalogApi = {
  getAll: (search?: string) => api.get('/api/billing/services', { params: { search } }),
  create: (data: any) => api.post('/api/billing/services', data),
  update: (id: string, data: any) => api.patch(`/api/billing/services/${id}`, data),
  remove: (id: string) => api.delete(`/api/billing/services/${id}`),
};

export const usersApi = {
  getDoctors: (departmentId?: string) =>
    api.get('/api/users/doctors', { params: departmentId ? { departmentId } : {} }),
  getAll: () => api.get('/api/users'),
  create: (data: any) => api.post('/api/users', data),
  update: (id: string, data: any) => api.patch(`/api/users/${id}`, data),
  remove: (id: string) => api.delete(`/api/users/${id}`),
  resetPassword: (id: string, newPassword?: string) =>
    api.patch(`/api/users/${id}/reset-password`, { newPassword }),
  getRoles: () => api.get('/api/users/roles'),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/api/users/${id}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Appointment endpoints
export const appointmentsApi = {
  getAll: (params?: any) => api.get('/api/appointments', { params }),
  getOne: (id: string) => api.get(`/api/appointments/${id}`),
  create: (data: any) => api.post('/api/appointments', data),
  update: (id: string, data: any) => api.patch(`/api/appointments/${id}`, data),
  delete: (id: string) => api.delete(`/api/appointments/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/appointments/${id}/status`, { status }),
  checkDuplicate: (params: { patientId: string; doctorId?: string; department?: string }) =>
    api.get('/api/appointments/check-duplicate', { params }),
};

// Dashboard endpoints
export const dashboardApi = {
  getStats: (params?: any) => api.get('/api/reports/dashboard', { params }),
};

// Reports endpoints
export const reportsApi = {
  // Monthly reports (from/to = 'YYYY-MM-DD')
  getMonthlyVisits: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/visits', { params: { from, to } }),
  getMonthlyExpenses: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/expenses', { params: { from, to } }),
  getMonthlyLabSupplies: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/lab-supplies', { params: { from, to } }),
  getMonthlyStaffActivity: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/staff-activity', { params: { from, to } }),
  getMonthlyDiagnosis: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/diagnosis', { params: { from, to } }),
  getMonthlyLabRevenue: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/lab-revenue', { params: { from, to } }),
  getMonthlyPharmacy: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/pharmacy', { params: { from, to } }),
  getMonthlyInventoryValuation: (from?: string, to?: string) =>
    api.get('/api/reports/monthly/inventory-valuation', { params: { from, to } }),

  getProfitLoss: (from?: string, to?: string) =>
    api.get('/api/reports/profit-loss', { params: { from, to } }),
};


// Laboratory endpoints
export const labApi = {
  getQueue: () => api.get('/api/laboratory/queue'),
  getAll: (status?: string, patientId?: string) => api.get('/api/laboratory', { params: { status, patientId } }),
  getOne: (id: string) => api.get(`/api/laboratory/${id}`),
  getByVisit: (visitId: string) => api.get(`/api/laboratory/by-visit/${visitId}`),
  create: (data: any) => api.post('/api/laboratory', data),
  updateStatus: (id: string, status: string) => api.patch(`/api/laboratory/${id}/status`, { status }),
  updateResult: (id: string, items: { itemId: string; resultValue: string }[]) =>
    api.patch(`/api/laboratory/${id}/result`, { items }),
};

// Radiology orders
export const radiologyApi = {
  getQueue: () => api.get('/api/radiology/queue'),
  getAll: (status?: string, patientId?: string) => api.get('/api/radiology', { params: { status, patientId } }),
  getOne: (id: string) => api.get(`/api/radiology/${id}`),
  getByVisit: (visitId: string) => api.get(`/api/radiology/by-visit/${visitId}`),
  create: (data: any) => api.post('/api/radiology', data),
  updateStatus: (id: string, status: string) => api.patch(`/api/radiology/${id}/status`, { status }),
  updateResult: (id: string, items: { itemId: string; resultText: string }[]) =>
    api.patch(`/api/radiology/${id}/result`, { items }),
};

// Radiology test catalog (Settings > Radiology > Test Catalog)
export const radiologyTestCatalogApi = {
  getAll: (search?: string) => api.get('/api/settings/radiology/tests', { params: { search } }),
  getOne: (id: string) => api.get(`/api/settings/radiology/tests/${id}`),
  create: (data: any) => api.post('/api/settings/radiology/tests', data),
  update: (id: string, data: any) => api.patch(`/api/settings/radiology/tests/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/radiology/tests/${id}`),
  seed: () => api.post('/api/settings/radiology/tests/seed'),
};

// Laboratory test catalog (Settings > Laboratory > Test Catalog)
export const labTestCatalogApi = {
  getAll: (search?: string) => api.get('/api/settings/laboratory/tests', { params: { search } }),
  getOne: (id: string) => api.get(`/api/settings/laboratory/tests/${id}`),
  create: (data: any) => api.post('/api/settings/laboratory/tests', data),
  update: (id: string, data: any) => api.patch(`/api/settings/laboratory/tests/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/laboratory/tests/${id}`),
  seed: () => api.post('/api/settings/laboratory/tests/seed'),
  getComponents: (id: string) => api.get(`/api/settings/laboratory/tests/${id}/components`),
  setComponents: (
    id: string,
    components: { labSupplyId: string; quantityPerTest: number; wastagePercent?: number; notes?: string }[],
  ) => api.put(`/api/settings/laboratory/tests/${id}/components`, { components }),
  getCostBreakdown: (id: string) => api.get(`/api/settings/laboratory/tests/${id}/cost-breakdown`),
  setCostMode: (
    id: string,
    data: { costCalculationMode: 'auto' | 'manual'; manualCostOverride?: number; manualCostReason?: string },
  ) => api.patch(`/api/settings/laboratory/tests/${id}/cost-mode`, data),
};

// Pharmacy endpoints
export const pharmacyApi = {
  getDashboard: () => api.get('/api/pharmacy/dashboard'),
  getMedicines: (search?: string) => api.get('/api/pharmacy/medicines', { params: { search } }),
  getLowStock: () => api.get('/api/pharmacy/medicines/low-stock'),
  createMedicine: (data: any) => api.post('/api/pharmacy/medicines', data),
  updateMedicine: (id: string, data: any) => api.patch(`/api/pharmacy/medicines/${id}`, data),
  restockMedicine: (id: string, quantity: number) => api.patch(`/api/pharmacy/medicines/${id}/restock`, { quantity }),
  deactivateMedicine: (id: string) => api.delete(`/api/pharmacy/medicines/${id}`),
  getPrescriptions: (status?: string) => api.get('/api/pharmacy/prescriptions', { params: { status } }),
  dispense: (id: string, data: { medicineId: string; quantity: number }) =>
    api.post(`/api/pharmacy/prescriptions/${id}/dispense`, data),
  cancelPrescription: (id: string) => api.patch(`/api/pharmacy/prescriptions/${id}/cancel`),

  // Purchases (goods receipt)
  getDeptHeadQueue: () => api.get('/api/pharmacy/purchases/dept-head-queue'),
  deptHeadReviewPurchase: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    api.patch(`/api/pharmacy/purchases/${id}/dept-head-review`, { decision, notes }),
  getPurchases: (status?: string) => api.get('/api/pharmacy/purchases', { params: { status } }),
  getPurchase: (id: string) => api.get(`/api/pharmacy/purchases/${id}`),
  createPurchase: (data: any) => api.post('/api/pharmacy/purchases', data),
  confirmPurchase: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/confirm`),
  recordPurchasePayment: (id: string, amount: number) => api.patch(`/api/pharmacy/purchases/${id}/payment`, { amount }),
  cancelPurchase: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/cancel`),
  adminReviewPurchase: (id: string, decision: 'approve' | 'reject', rejectionReason?: string) =>
    api.patch(`/api/pharmacy/purchases/${id}/admin-review`, { decision, rejectionReason }),
  markPurchasePaid: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/mark-paid`),

  // POS
  getSales: () => api.get('/api/pharmacy/sales'),
  createSale: (data: any) => api.post('/api/pharmacy/sales', data),
  voidSale: (id: string) => api.patch(`/api/pharmacy/sales/${id}/void`),
};

export const pharmacyReturnsApi = {
  getAll: () => api.get('/api/pharmacy/returns').then(r => r.data),
  create: (body: {
    type: 'pos' | 'rx';
    saleId?: string;
    saleItemId?: string;
    prescriptionId?: string;
    quantity: number;
    reason: string;
    notes?: string;
  }) => api.post('/api/pharmacy/returns', body).then(r => r.data),
};

export const bloodBankApi = {
  getInventory: () => api.get('/api/blood-bank/inventory'),
  addUnits: (bloodType: string, units: number, note?: string) =>
    api.post('/api/blood-bank/inventory/add', { bloodType, units, note }),
  issueUnits: (bloodType: string, units: number, note?: string) =>
    api.post('/api/blood-bank/inventory/issue', { bloodType, units, note }),
  getDonors: (params?: any) => api.get('/api/blood-bank/donors', { params }),
  recordDonation: (data: any) => api.post('/api/blood-bank/donations', data),
};

export const billingApi = {
  getVisitSummary: (visitId: string) => api.get(`/api/billing/visit-summary/${visitId}`),
  getAll: (patientId?: string, search?: string) => api.get('/api/billing/invoices', { params: { patientId, search } }),
  getOne: (id: string) => api.get(`/api/billing/invoices/${id}`),
  create: (data: any) => api.post('/api/billing/invoices', data),
  recordPayment: (id: string, amount: number) =>
    api.post(`/api/billing/invoices/${id}/payments`, { amount }),
  remove: (id: string) => api.delete(`/api/billing/invoices/${id}`),
  getAllPayments: () => api.get('/api/billing/payments'),
};

export const expenseCategoriesApi = {
  getGroups: () => api.get('/api/expense-categories/groups'),
  getAll: (includeInactive = false) =>
    api.get('/api/expense-categories', { params: { includeInactive: includeInactive || undefined } }),
  create: (data: any) => api.post('/api/expense-categories', data),
  update: (id: string, data: any) => api.patch(`/api/expense-categories/${id}`, data),
  deactivate: (id: string) => api.patch(`/api/expense-categories/${id}/deactivate`),
};

export const expensesApi = {
  getAll: (status?: string, submittedById?: string) =>
    api.get('/api/expenses', { params: { status, submittedById } }),
  getOne: (id: string) => api.get(`/api/expenses/${id}`),
  create: (data: any) => api.post('/api/expenses', data),
  getDeptHeadQueue: () => api.get('/api/expenses/dept-head-queue'),
  deptHeadReview: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    api.patch(`/api/expenses/${id}/dept-head-review`, { decision, notes }),
  approve: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    api.patch(`/api/expenses/${id}/approve`, { decision, notes }),
  markPaid: (id: string, notes?: string) =>
    api.patch(`/api/expenses/${id}/mark-paid`, { notes }),
  remove: (id: string) => api.delete(`/api/expenses/${id}`),
};

export const departmentsApi = {
  getAll: () => api.get('/api/departments'),
  create: (data: any) => api.post('/api/departments', data),
  update: (id: string, data: any) => api.patch(`/api/departments/${id}`, data),
  remove: (id: string) => api.delete(`/api/departments/${id}`),
};

export const rolesApi = {
  getAll: () => api.get('/api/roles'),
  create: (data: any) => api.post('/api/roles', data),
  update: (id: string, data: any) => api.patch(`/api/roles/${id}`, data),
  remove: (id: string) => api.delete(`/api/roles/${id}`),
};

export const permissionsApi = {
  getAll: () => api.get('/api/permissions'),
};

export const vitalRangesApi = {
  getAll: () => api.get('/api/settings/clinical/vital-ranges'),
  create: (data: any) => api.post('/api/settings/clinical/vital-ranges', data),
  update: (id: string, data: any) => api.patch(`/api/settings/clinical/vital-ranges/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/clinical/vital-ranges/${id}`),
};

export const diagnosisCodesApi = {
  getAll: () => api.get('/api/settings/clinical/diagnosis-codes'),
  create: (data: any) => api.post('/api/settings/clinical/diagnosis-codes', data),
  update: (id: string, data: any) => api.patch(`/api/settings/clinical/diagnosis-codes/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/clinical/diagnosis-codes/${id}`),
};

export const visitTypesApi = {
  getAll: () => api.get('/api/settings/clinical/visit-types'),
  create: (data: any) => api.post('/api/settings/clinical/visit-types', data),
  update: (id: string, data: any) => api.patch(`/api/settings/clinical/visit-types/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/clinical/visit-types/${id}`),
};

export const noteTemplatesApi = {
  getAll: () => api.get('/api/settings/clinical/note-templates'),
  create: (data: any) => api.post('/api/settings/clinical/note-templates', data),
  update: (id: string, data: any) => api.patch(`/api/settings/clinical/note-templates/${id}`, data),
  remove: (id: string) => api.delete(`/api/settings/clinical/note-templates/${id}`),
};

// Facility settings endpoints
export const facilityApi = {
  get: () => api.get('/api/settings/facility'),
  update: (data: any) => api.patch('/api/settings/facility', data),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/api/settings/facility/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};


// Inventory / Laboratory Supplies
export const inventoryApi = {
  getLabSupplies: (search?: string) => api.get('/api/inventory/lab-supplies', { params: { search } }),
  getLabSuppliesLowStock: () => api.get('/api/inventory/lab-supplies/low-stock'),
  createLabSupply: (data: any) => api.post('/api/inventory/lab-supplies', data),
  updateLabSupply: (id: string, data: any) => api.patch(`/api/inventory/lab-supplies/${id}`, data),
  restockLabSupply: (id: string, quantity: number, reason?: string) => api.patch(`/api/inventory/lab-supplies/${id}/restock`, { quantity, reason }),
  issueLabSupply: (id: string, quantity: number, reason?: string) => api.patch(`/api/inventory/lab-supplies/${id}/issue`, { quantity, reason }),
  getLabSupplyStockLogs: (id: string) => api.get(`/api/inventory/lab-supplies/${id}/stock-logs`),
  deactivateLabSupply: (id: string) => api.delete(`/api/inventory/lab-supplies/${id}`),

  // Purchases (goods receipt)
  getLabSupplyDeptHeadQueue: () => api.get('/api/inventory/lab-supplies/purchases/dept-head-queue'),
  deptHeadReviewLabSupplyPurchase: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    api.patch(`/api/inventory/lab-supplies/purchases/${id}/dept-head-review`, { decision, notes }),
  getLabSupplyPurchases: (status?: string) => api.get('/api/inventory/lab-supplies/purchases', { params: { status } }),
  getLabSupplyPurchase: (id: string) => api.get(`/api/inventory/lab-supplies/purchases/${id}`),
  createLabSupplyPurchase: (data: any) => api.post('/api/inventory/lab-supplies/purchases', data),
  confirmLabSupplyPurchase: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/confirm`),
  recordLabSupplyPurchasePayment: (id: string, amount: number) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/payment`, { amount }),
  cancelLabSupplyPurchase: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/cancel`),
  adminReviewLabSupplyPurchase: (id: string, decision: 'approve' | 'reject', rejectionReason?: string) =>
    api.patch(`/api/inventory/lab-supplies/purchases/${id}/admin-review`, { decision, rejectionReason }),
  markLabSupplyPurchasePaid: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/mark-paid`),
};
// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE TO: frontend/src/services/api.ts
// ─────────────────────────────────────────────────────────────────────────────

// Staff member endpoints (individual fetch — used by StaffProfilePage)
export const staffApi = {
  getAll: (params?: any) => api.get('/api/staff', { params }),
  getOne: (id: string) => api.get(`/api/staff/${id}`),
  create: (data: any) => api.post('/api/staff', data),
  update: (id: string, data: any) => api.patch(`/api/staff/${id}`, data),
  delete: (id: string) => api.delete(`/api/staff/${id}`),
};

// Staff profile endpoints (CV, skills, education, experience)
export const staffProfileApi = {
  get: (userId: string) => api.get(`/api/staff-profiles/${userId}`),
  update: (userId: string, data: any) => api.patch(`/api/staff-profiles/${userId}`, data),
  uploadCv: (userId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/staff-profiles/${userId}/cv`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
};


export const branchesApi = {
  getAll: () => api.get('/api/branches'),
  create: (data: any) => api.post('/api/branches', data),
  update: (id: string, data: any) => api.patch(`/api/branches/${id}`, data),
  remove: (id: string) => api.delete(`/api/branches/${id}`),
};

export const loginSessionApi = {
  get: () => api.get('/api/settings/login-session'),
  update: (data: any) => api.patch('/api/settings/login-session', data),
};

export const insuranceProvidersApi = {
  getAll: () => api.get('/api/insurance-providers'),
  create: (data: any) => api.post('/api/insurance-providers', data),
  update: (id: string, data: any) => api.patch(`/api/insurance-providers/${id}`, data),
  remove: (id: string) => api.delete(`/api/insurance-providers/${id}`),
};

// App reset (clear records / reset all)
export const resetApi = {
  preview: (mode: string) => api.get('/api/app-reset/preview', { params: { mode } }),
  run: (mode: string, confirmText: string) => api.post('/api/app-reset', { mode, confirmText }),
};
