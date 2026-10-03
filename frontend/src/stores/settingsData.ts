import { ListStore, ValueStore, ApiListStore } from './store';
import { labTestCatalogApi } from '../services/api';
import { vitalRangesApi, diagnosisCodesApi, visitTypesApi, noteTemplatesApi } from '../services/api';
import { branchesApi } from '../services/api';

/* ------------------------------------------------------------------ */
/*  Shared record types                                                */
/* ------------------------------------------------------------------ */

export interface Branch { id: string; name: string; address: string; phone: string; manager: string; status: 'Active' | 'Inactive'; }
export interface Department { id: string; name: string; head: string; rooms: number; staff: number; }
export interface ConsultationRoom { id: string; room: string; departmentId: string; capacity: string; status: 'Available' | 'In Use' | 'Maintenance'; }
export interface Ward { id: string; name: string; departmentId: string; totalBeds: number; occupied: number; }

export interface AppUser { id: string; name: string; email: string; roleId: string; departmentId: string; status: 'Active' | 'Inactive'; }
export interface Role { id: string; name: string; }
export interface Permission { id: string; label: string; }
export interface DoctorAccount { id: string; name: string; specialty: string; license: string; departmentId: string; }
export interface StaffAccount { id: string; name: string; position: string; departmentId: string; employmentType: 'Full-time' | 'Part-time' | 'Contract'; }
export interface DeptAssignment { id: string; personName: string; departmentId: string; roleInDept: string; effectiveDate: string; }

export interface VitalRange { id: string; vital: string; min: string; max: string; unit: string; }
export interface DiagnosisCode { id: string; code: string; description: string; category: string; }
export interface VisitType { id: string; name: string; duration: string; color: string; }
export interface NoteTemplate { id: string; name: string; specialty: string; lastUpdated: string; }

export interface MedicineCategory { id: string; name: string; }
export interface TestCatalogItem { id: string; name: string; category: string; unit: string; referenceRange: string; price: number; }
export interface ReferenceRange { id: string; test: string; sex: 'Male' | 'Female' | 'All'; range: string; unit: string; }
export interface SampleType { id: string; name: string; container: string; handling: string; }

export interface Modality { id: string; name: string; equipmentId: string; status: 'Operational' | 'Under Maintenance' | 'Offline'; }
export interface ProcedureType { id: string; name: string; modalityId: string; duration: string; prep: string; }
export interface RadiologyTemplate { id: string; name: string; modalityId: string; lastUpdated: string; }

export interface AppointmentType { id: string; name: string; durationMinutes: number; color: string; requiresDoctor: boolean; }
export interface InsuranceProvider { id: string; name: string; coverage: string; contact: string; status: 'Active' | 'Inactive'; }
export interface Supplier { id: string; name: string; contact: string; itemsSupplied: string; status: 'Active' | 'Inactive'; }
export interface DocumentTemplate { id: string; name: string; lastUpdated: string; }

export interface WeeklyHoursValue {
  closedDays: string[];
  hours: Record<string, { open: string; close: string }>;
  holidays: string;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function defaultWeeklyHours(closedDays: string[] = ['Sunday']): WeeklyHoursValue {
  const hours: WeeklyHoursValue['hours'] = {};
  WEEKDAYS.forEach((d) => (hours[d] = { open: '08:00', close: '17:00' }));
  return { closedDays, hours, holidays: '' };
}

/* ------------------------------------------------------------------ */
/*  Facility & Organization                                            */
/* ------------------------------------------------------------------ */

export const facilityInfoStore = new ValueStore('facilityInfo', {
  name: 'Daryeel Medicare',
  regNumber: 'DM-2025-001',
  address: 'Hargeisa, Somaliland',
  city: 'Hargeisa',
  country: 'Somaliland',
  phone: '+252 63 1234567',
  email: 'info@daryeelmedicare.com',
  website: 'www.daryeelmedicare.com',
});

export const branchesStore = new ApiListStore<Branch>({
  fetchAll: async () => (await branchesApi.getAll()).data,
  create: async (item) => (await branchesApi.create(item)).data,
  update: async (id, patch) => (await branchesApi.update(id, patch)).data,
  remove: async (id) => { await branchesApi.remove(id); },
});

export const departmentsStore = new ListStore<Department>('departments', [
  { id: 'dep1', name: 'General Medicine', head: 'Dr. Ahmed Hassan', rooms: 4, staff: 12 },
  { id: 'dep2', name: 'Pediatrics', head: 'Dr. Faduma Ali', rooms: 3, staff: 8 },
  { id: 'dep3', name: 'Laboratory', head: 'Eng. Yusuf Ismail', rooms: 2, staff: 5 },
  { id: 'dep4', name: 'Pharmacy', head: 'Khadija Omar', rooms: 1, staff: 4 },
]);

export const servicesStore = new ValueStore('services', {
  clinical: ['General Consultation', 'Pediatrics', 'Antenatal Care', 'Minor Surgery', 'Vaccination', 'Dental'],
  diagnostic: ['Laboratory Tests', 'X-Ray', 'Ultrasound', 'ECG'],
});
export const CLINICAL_SERVICE_OPTIONS = ['General Consultation', 'Pediatrics', 'Antenatal Care', 'Minor Surgery', 'Vaccination', 'Dental', 'Physiotherapy', 'Dermatology'];
export const DIAGNOSTIC_SERVICE_OPTIONS = ['Laboratory Tests', 'X-Ray', 'Ultrasound', 'ECG', 'CT Scan', 'Endoscopy'];

export const roomsStore = new ListStore<ConsultationRoom>('rooms', [
  { id: 'rm1', room: 'Room 101', departmentId: 'dep1', capacity: '1 patient', status: 'In Use' },
  { id: 'rm2', room: 'Room 102', departmentId: 'dep1', capacity: '1 patient', status: 'Available' },
  { id: 'rm3', room: 'Room 201', departmentId: 'dep2', capacity: '1 patient', status: 'Available' },
]);

export const wardsStore = new ListStore<Ward>('wards', [
  { id: 'wd1', name: 'Male Ward', departmentId: 'dep1', totalBeds: 10, occupied: 6 },
  { id: 'wd2', name: 'Female Ward', departmentId: 'dep1', totalBeds: 10, occupied: 5 },
  { id: 'wd3', name: 'Maternity Ward', departmentId: 'dep2', totalBeds: 6, occupied: 2 },
]);

export const workingHoursStore = new ValueStore<WeeklyHoursValue>('workingHours', defaultWeeklyHours(['Sunday']));

/* ------------------------------------------------------------------ */
/*  Users & Access                                                     */
/* ------------------------------------------------------------------ */

export const rolesStore = new ListStore<Role>('roles', [
  { id: 'role-admin', name: 'Administrator' },
  { id: 'role-doctor', name: 'Doctor' },
  { id: 'role-nurse', name: 'Nurse' },
  { id: 'role-reception', name: 'Receptionist' },
  { id: 'role-pharmacist', name: 'Pharmacist' },
  { id: 'role-labtech', name: 'Lab Tech' },
  { id: 'role-accountant', name: 'Accountant' },
]);

export const permissionsStore = new ListStore<Permission>('permissions', [
  { id: 'perm-view-patients', label: 'View Patients' },
  { id: 'perm-edit-patients', label: 'Edit Patients' },
  { id: 'perm-delete-patients', label: 'Delete Patients' },
  { id: 'perm-appointments', label: 'Manage Appointments' },
  { id: 'perm-billing', label: 'Manage Billing' },
  { id: 'perm-dispense', label: 'Dispense Medicine' },
  { id: 'perm-reports', label: 'View Reports' },
  { id: 'perm-settings', label: 'Manage Settings' },
]);

// Shared by both the "Permissions" matrix panel and the "Role Permissions" single-role
// panel — editing either one updates the same underlying grants.
export const rolePermissionsStore = new ValueStore<Record<string, string[]>>('rolePermissions', {
  'role-admin': permissionsStore.getSnapshot().map((p) => p.id),
  'role-doctor': ['perm-view-patients', 'perm-edit-patients', 'perm-appointments'],
  'role-nurse': ['perm-view-patients', 'perm-appointments'],
  'role-reception': ['perm-view-patients', 'perm-appointments'],
  'role-pharmacist': ['perm-dispense', 'perm-view-patients'],
  'role-labtech': ['perm-view-patients', 'perm-reports'],
  'role-accountant': ['perm-billing', 'perm-reports'],
});

export const usersStore = new ListStore<AppUser>('users', [
  { id: 'u1', name: 'Ahmed Hassan', email: 'ahmed@daryeelmedicare.com', roleId: 'role-doctor', departmentId: 'dep1', status: 'Active' },
  { id: 'u2', name: 'Khadija Omar', email: 'khadija@daryeelmedicare.com', roleId: 'role-pharmacist', departmentId: 'dep4', status: 'Active' },
  { id: 'u3', name: 'System Administrator', email: 'admin@daryeelmedicare.com', roleId: 'role-admin', departmentId: 'dep1', status: 'Active' },
]);

export const doctorAccountsStore = new ListStore<DoctorAccount>('doctorAccounts', [
  { id: 'doc1', name: 'Dr. Ahmed Hassan', specialty: 'General Practitioner', license: 'SL-MD-1042', departmentId: 'dep1' },
  { id: 'doc2', name: 'Dr. Faduma Ali', specialty: 'Pediatrician', license: 'SL-MD-2078', departmentId: 'dep2' },
]);

export const staffAccountsStore = new ListStore<StaffAccount>('staffAccounts', [
  { id: 'st1', name: 'Amina Jama', position: 'Receptionist', departmentId: 'dep1', employmentType: 'Full-time' },
  { id: 'st2', name: 'Yusuf Ismail', position: 'Lab Technician', departmentId: 'dep3', employmentType: 'Full-time' },
]);

export const deptAssignmentsStore = new ListStore<DeptAssignment>('deptAssignments', [
  { id: 'da1', personName: 'Amina Jama', departmentId: 'dep1', roleInDept: 'Receptionist', effectiveDate: '2026-01-15' },
  { id: 'da2', personName: 'Yusuf Ismail', departmentId: 'dep3', roleInDept: 'Technician', effectiveDate: '2026-02-01' },
]);

export const loginSessionStore = new ValueStore('loginSession', {
  sessionTimeout: 120,
  maxLoginAttempts: 5,
  passwordExpiry: 90,
  minPasswordLength: 8,
  require2fa: false,
  forceChange: true,
});

/* ------------------------------------------------------------------ */
/*  Clinical Configuration                                             */
/* ------------------------------------------------------------------ */

export const vitalRangesStore = new ApiListStore<VitalRange>({
  fetchAll: async () => (await vitalRangesApi.getAll()).data,
  create: async (item) => (await vitalRangesApi.create(item)).data,
  update: async (id, patch) => (await vitalRangesApi.update(id, patch)).data,
  remove: async (id) => { await vitalRangesApi.remove(id); },
});

export const diagnosisCodesStore = new ApiListStore<DiagnosisCode>({
  fetchAll: async () => (await diagnosisCodesApi.getAll()).data,
  create: async (item) => (await diagnosisCodesApi.create(item)).data,
  update: async (id, patch) => (await diagnosisCodesApi.update(id, patch)).data,
  remove: async (id) => { await diagnosisCodesApi.remove(id); },
});

export const visitTypesStore = new ApiListStore<VisitType>({
  fetchAll: async () => (await visitTypesApi.getAll()).data,
  create: async (item) => (await visitTypesApi.create(item)).data,
  update: async (id, patch) => (await visitTypesApi.update(id, patch)).data,
  remove: async (id) => { await visitTypesApi.remove(id); },
});

export const noteTemplatesStore = new ApiListStore<NoteTemplate>({
  fetchAll: async () => (await noteTemplatesApi.getAll()).data,
  create: async (item) => (await noteTemplatesApi.create(item)).data,
  update: async (id, patch) => (await noteTemplatesApi.update(id, patch)).data,
  remove: async (id) => { await noteTemplatesApi.remove(id); },
});

/* ------------------------------------------------------------------ */
/*  Pharmacy                                                            */
/* ------------------------------------------------------------------ */

export const medicineCategoriesStore = new ListStore<MedicineCategory>('medicineCategories', [
  { id: 'mc1', name: 'Antibiotics' },
  { id: 'mc2', name: 'Analgesics' },
  { id: 'mc3', name: 'Antimalarials' },
  { id: 'mc4', name: 'Vitamins' },
]);

export const medicinesCatalogDefaultsStore = new ValueStore('medicinesCatalogDefaults', {
  defaultUnit: 'Tablet',
  defaultCategoryId: 'mc1',
  requireGeneric: true,
});

export const stockAlertsStore = new ValueStore('stockAlerts', {
  lowStockThreshold: 20,
  expiryAlertDays: 60,
});

export const dispensingRulesStore = new ValueStore('dispensingRules', {
  requireRx: true,
  allowPartial: true,
  requireDoubleCheck: true,
});

/* ------------------------------------------------------------------ */
/*  Laboratory                                                          */
/* ------------------------------------------------------------------ */

export const testCatalogStore = new ApiListStore<TestCatalogItem>({
  fetchAll: async () => (await labTestCatalogApi.getAll()).data,
  create: async (item) => (await labTestCatalogApi.create(item)).data,
  update: async (id, patch) => (await labTestCatalogApi.update(id, patch)).data,
  remove: async (id) => { await labTestCatalogApi.remove(id); },
});

export const referenceRangesStore = new ListStore<ReferenceRange>('referenceRanges', [
  { id: 'rr1', test: 'Hemoglobin', sex: 'Male', range: '13.5 – 17.5', unit: 'g/dL' },
  { id: 'rr2', test: 'Hemoglobin', sex: 'Female', range: '12.0 – 15.5', unit: 'g/dL' },
  { id: 'rr3', test: 'Fasting Glucose', sex: 'All', range: '70 – 100', unit: 'mg/dL' },
]);

export const sampleTypesStore = new ListStore<SampleType>('sampleTypes', [
  { id: 'sm1', name: 'Venous Blood', container: 'EDTA Tube', handling: 'Refrigerate, analyze within 24h' },
  { id: 'sm2', name: 'Urine', container: 'Sterile Cup', handling: 'Analyze within 2h of collection' },
]);

/* ------------------------------------------------------------------ */
/*  Radiology                                                           */
/* ------------------------------------------------------------------ */

export const modalitiesStore = new ListStore<Modality>('modalities', [
  { id: 'mod1', name: 'X-Ray', equipmentId: 'XR-001', status: 'Operational' },
  { id: 'mod2', name: 'Ultrasound', equipmentId: 'US-002', status: 'Operational' },
]);

export const procedureTypesStore = new ListStore<ProcedureType>('procedureTypes', [
  { id: 'pt1', name: 'Chest X-Ray', modalityId: 'mod1', duration: '10 min', prep: 'Remove metal objects' },
  { id: 'pt2', name: 'Abdominal Ultrasound', modalityId: 'mod2', duration: '20 min', prep: 'Fasting 6h prior' },
]);

export const radiologyTemplatesStore = new ListStore<RadiologyTemplate>('radiologyTemplates', [
  { id: 'rt1', name: 'Chest X-Ray — Normal', modalityId: 'mod1', lastUpdated: '3 weeks ago' },
  { id: 'rt2', name: 'Obstetric Ultrasound', modalityId: 'mod2', lastUpdated: '5 days ago' },
]);

/* ------------------------------------------------------------------ */
/*  Appointment Settings                                                */
/* ------------------------------------------------------------------ */

// Single source of truth for appointment types AND their default durations —
// the old app had two separate hardcoded lists that could drift apart.
export const appointmentTypesStore = new ListStore<AppointmentType>('appointmentTypes', [
  { id: 'at1', name: 'New Patient', durationMinutes: 30, color: 'Blue', requiresDoctor: true },
  { id: 'at2', name: 'Follow-up', durationMinutes: 15, color: 'Green', requiresDoctor: true },
  { id: 'at3', name: 'Procedure', durationMinutes: 45, color: 'Orange', requiresDoctor: true },
  { id: 'at4', name: 'Urgent', durationMinutes: 20, color: 'Red', requiresDoctor: true },
]);

export const doctorSchedulesStore = new ValueStore<Record<string, WeeklyHoursValue>>('doctorSchedules', {
  doc1: defaultWeeklyHours(['Sunday']),
  doc2: defaultWeeklyHours(['Friday', 'Sunday']),
});

export const departmentSchedulesStore = new ValueStore<Record<string, WeeklyHoursValue>>('departmentSchedules', {
  dep1: defaultWeeklyHours(['Sunday']),
  dep2: defaultWeeklyHours(['Sunday']),
  dep3: defaultWeeklyHours(['Friday', 'Sunday']),
});

export const bookingRulesStore = new ValueStore('bookingRules', {
  advanceBookingLimit: 30,
  minNoticeHours: 2,
  maxPerPatientPerDay: 2,
  allowSameDay: true,
});

export const cancellationRulesStore = new ValueStore('cancellationRules', {
  cancellationWindowHours: 24,
  lateFee: '',
  allowSelfCancel: true,
});

export const reschedulingRulesStore = new ValueStore('reschedulingRules', {
  maxReschedules: 2,
  rescheduleWindowHours: 12,
  requireReason: false,
});

export const onlineBookingStore = new ValueStore('onlineBooking', {
  enabled: true,
  requireVerify: true,
  bookingHorizonDays: 14,
  visibleDoctors: 'All Doctors',
});

export const appointmentRemindersStore = new ValueStore('appointmentReminders', {
  sms: true,
  email: true,
  firstReminderHours: 24,
  secondReminderHours: 2,
  template: 'Hi {patient_name}, this is a reminder of your appointment with {doctor_name} on {date} at {time}.',
});

/* ------------------------------------------------------------------ */
/*  Queue Management                                                    */
/* ------------------------------------------------------------------ */

export const queueDisplayStore = new ValueStore('queueDisplay', {
  displayType: 'Screen + TV',
  callIntervalSeconds: 30,
  autoCall: true,
});

export const QUEUE_STAGE_OPTIONS = ['Registration', 'Triage', 'Consultation', 'Laboratory', 'Radiology', 'Pharmacy', 'Cashier'];
export const queueCategoriesStore = new ValueStore('queueCategories', {
  activeStages: [...QUEUE_STAGE_OPTIONS],
});

export const priorityRulesStore = new ValueStore('priorityRules', {
  emergencyTopPriority: true,
  elderlyPriority: true,
  appointmentHoldersPriority: false,
});

/* ------------------------------------------------------------------ */
/*  Billing & Finance / Inventory / Printing                            */
/* ------------------------------------------------------------------ */

export const generalBillingStore = new ValueStore('generalBilling', {
  currency: 'USD (US Dollar)',
  taxRate: 0,
  invoicePrefix: 'INV-',
  invoiceDueDays: 7,
});

export const PAYMENT_METHOD_OPTIONS = ['Cash', 'Card', 'EVC Plus', 'Zaad', 'Insurance', 'Bank Transfer'];
export const paymentMethodsStore = new ValueStore('paymentMethods', {
  accepted: ['Cash', 'Card', 'EVC Plus', 'Zaad', 'Insurance', 'Bank Transfer'],
});

export const insuranceProvidersStore = new ListStore<InsuranceProvider>('insuranceProviders', [
  { id: 'ip1', name: 'Nasiye Insurance', coverage: '80%', contact: '+252 63 9988776', status: 'Active' },
  { id: 'ip2', name: 'Takaful Insurance', coverage: '70%', contact: '+252 63 1122334', status: 'Active' },
]);

export const stockSettingsStore = new ValueStore('stockSettings', {
  defaultReorderThreshold: 15,
  defaultUnit: 'Piece',
  autoReorder: false,
});

export const suppliersStore = new ListStore<Supplier>('suppliers', [
  { id: 'sup1', name: 'Hargeisa Medical Supplies', contact: '+252 63 4455667', itemsSupplied: 'Medicines, Consumables', status: 'Active' },
  { id: 'sup2', name: 'Horn Pharma Distributors', contact: '+252 63 7788990', itemsSupplied: 'Medicines', status: 'Active' },
]);

export const printerSettingsStore = new ValueStore('printerSettings', {
  printerType: 'Thermal / Receipt Printer',
  defaultPrinter: 'Epson TM-T88',
  autoPrintRx: true,
  autoPrintReceipt: true,
  printCardOnRegistration: false,
});

export const documentTemplatesStore = new ListStore<DocumentTemplate>('documentTemplates', [
  { id: 'doc-t1', name: 'Prescription', lastUpdated: '1 week ago' },
  { id: 'doc-t2', name: 'Receipt', lastUpdated: '2 weeks ago' },
  { id: 'doc-t3', name: 'Lab Report', lastUpdated: '3 days ago' },
  { id: 'doc-t4', name: 'Referral Letter', lastUpdated: '1 month ago' },
]);
// ─────────────────────────────────────────────────────────────────────────────
// PASTE THIS AT THE BOTTOM OF: src/stores/settingsData.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface Bed {
  id: string;
  bedNumber: string;
  wardId: string;   // references Ward.id
  floor: number;
  dailyRate: number;
  status: 'Available' | 'Occupied' | 'Maintenance';
  patientId: string;  // patient booked into this bed (empty = none)
  notes: string;
}

export const bedsStore = new ListStore<Bed>('beds', [
  { id: 'bed1', bedNumber: 'GEN-101', wardId: 'wd1', floor: 1, dailyRate: 300, status: 'Available', patientId: '', notes: '' },
  { id: 'bed2', bedNumber: 'GEN-102', wardId: 'wd1', floor: 1, dailyRate: 300, status: 'Occupied',  patientId: '', notes: '' },
  { id: 'bed3', bedNumber: 'FEM-101', wardId: 'wd2', floor: 1, dailyRate: 300, status: 'Available', patientId: '', notes: '' },
  { id: 'bed4', bedNumber: 'MAT-201', wardId: 'wd3', floor: 2, dailyRate: 500, status: 'Available', patientId: '', notes: '' },
  { id: 'bed5', bedNumber: 'MAT-202', wardId: 'wd3', floor: 2, dailyRate: 500, status: 'Maintenance', patientId: '', notes: 'Broken frame' },
]);
