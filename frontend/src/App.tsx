import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import { useAuthStore } from './stores/auth.store';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppointmentsPage } from './modules/appointments/AppointmentsPage';
import { NewAppointmentPage } from './modules/appointments/NewAppointmentPage';
import { AppointmentDetailPage } from './modules/appointments/AppointmentDetailPage';
import { PatientsListPage } from './modules/patients/PatientsListPage';
import { RegisterPatientPage } from './modules/patients/RegisterPatientPage';
import { PatientVisitsPage } from './modules/patients/PatientVisitsPage';
import { EmergencyPatientsPage } from './modules/patients/EmergencyPatientsPage';
import { PatientDetailPage } from './modules/patients/PatientDetailPage';
import { StaffDirectoryPage } from './modules/staff/StaffDirectoryPage';
import { StaffProfilePage } from './modules/staff/StaffProfilePage';
import { LeaveRequestsPage } from './modules/leave/LeaveRequestsPage';
import { LeaveBalancePage } from './modules/leave/LeaveBalancePage';
import { LeaveTypesPage } from './modules/leave/LeaveTypesPage';
import { LeaveCalendarPage } from './modules/leave/LeaveCalendarPage';
import { LeaveApprovalsPage } from './modules/leave/LeaveApprovalsPage';
import { QueuePage } from './modules/queue/QueuePage';
import { ConsultationPage } from './modules/clinical/ConsultationPage';
import { TriagePage } from './modules/clinical/TriagePage';
import { LabQueuePage } from './modules/laboratory/LabQueuePage';
import { LabResultEntryPage } from './modules/laboratory/LabResultEntryPage';
import { LabResultsPage } from './modules/laboratory/LabResultsPage';
import { RadiologyQueuePage } from './modules/radiology/RadiologyQueuePage';
import { RadiologyResultEntryPage } from './modules/radiology/RadiologyResultEntryPage';
import { RadiologyResultsPage } from './modules/radiology/RadiologyResultsPage';
import { PharmacyDashboardPage } from './modules/pharmacy/PharmacyDashboardPage';
import { PrescriptionsPage } from './modules/pharmacy/PrescriptionsPage';
import { DispensingPage } from './modules/pharmacy/DispensingPage';
import { MedicinesPage } from './modules/pharmacy/MedicinesPage';
import { LowStockPage } from './modules/pharmacy/LowStockPage';
import { POSPage } from './modules/pharmacy/POSPage';
import { PurchasesPage } from './modules/pharmacy/PurchasesPage';
import { SalesHistoryPage } from './modules/pharmacy/SalesHistoryPage';
import { LabSuppliesPage } from './modules/inventory/LabSuppliesPage';
import { LabSuppliesPurchasesPage } from './modules/inventory/LabSuppliesPurchasesPage';
import { SettingsPage } from './modules/settings/SettingsPage';
import { TestRecipeEditorPage } from './modules/settings/laboratory/TestRecipeEditorPage';
import { BloodBankPage } from './modules/bloodbank/BloodBankPage';
import { InvoicesPage } from './modules/billing/InvoicesPage';
import { CreateInvoicePage } from './modules/billing/CreateInvoicePage';
import { PaymentsPage } from './modules/billing/PaymentsPage';
import { OutstandingPage } from './modules/billing/OutstandingPage';
import { InsurancePage } from './modules/billing/InsurancePage';
import { ExpensesPage } from './modules/billing/ExpensesPage';
import { CreditsRefundsPage } from './modules/billing/CreditsRefundsPage';
import { BedRentPage } from './modules/billing/BedRentPage';
import ReportsPage from './modules/pharmacy/ReportsPage';
import { AccountsReportsPage } from './modules/billing/AccountsReportsPage';
import { ProfitLossPage } from './modules/billing/ProfitLossPage';
import { DailyReconciliationPage } from './modules/billing/DailyReconciliationPage';
import { DiscountVoidLogPage } from './modules/billing/DiscountVoidLogPage';
import { DepartmentsPage } from './modules/departments/DepartmentsPage';
import BedManagementPage from './modules/beds/BedManagementPage';
import { OrgChartPage } from './modules/org-chart/OrgChartPage';
import { HelpPage } from './modules/help/HelpPage';
import { FaqChatWidget } from './components/FaqChatWidget';
import MonthlyReportsPage from './modules/reports/MonthlyReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user?.language) {
      import('i18next').then(({ default: i18n }) => {
        i18n.changeLanguage(user.language);
      });
    }
  }, [user?.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout />
                  <FaqChatWidget />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Patients */}
              <Route path="patients" element={<PermissionRoute permission="patients:read"><PatientsListPage /></PermissionRoute>} />
              <Route path="patients/register" element={<PermissionRoute permission="patients:create"><RegisterPatientPage /></PermissionRoute>} />
              <Route path="patients/visits" element={<PermissionRoute permission="visits:read"><PatientVisitsPage /></PermissionRoute>} />
              <Route path="patients/emergency" element={<EmergencyPatientsPage />} />
              <Route path="patients/:id" element={<PermissionRoute permission="patients:read"><PatientDetailPage /></PermissionRoute>} />
              <Route path="staff" element={<PermissionRoute permission="staff:read"><StaffDirectoryPage /></PermissionRoute>} />
              <Route path="staff/:id" element={<PermissionRoute permission="staff:read"><StaffProfilePage /></PermissionRoute>} />
              <Route path="org-chart" element={<PermissionRoute permission="orgchart:read"><OrgChartPage /></PermissionRoute>} />

              {/* Leave management */}
              <Route path="leave" element={<Navigate to="/leave/requests" replace />} />
              <Route path="leave/requests" element={<LeaveRequestsPage />} />
              <Route path="leave/balance" element={<LeaveBalancePage />} />
              <Route path="leave/types" element={<LeaveTypesPage />} />
              <Route path="leave/calendar" element={<LeaveCalendarPage />} />
              <Route path="leave/approvals" element={<LeaveApprovalsPage />} />

              {/* Appointments — one page, driven by URL */}
              <Route path="appointments" element={<PermissionRoute permission="appointments:read"><AppointmentsPage /></PermissionRoute>} />
              <Route path="appointments/calendar" element={<PermissionRoute permission="appointments:read"><AppointmentsPage /></PermissionRoute>} />
              <Route path="appointments/today" element={<PermissionRoute permission="appointments:read"><AppointmentsPage /></PermissionRoute>} />
              <Route path="appointments/upcoming" element={<PermissionRoute permission="appointments:read"><AppointmentsPage /></PermissionRoute>} />
              <Route path="appointments/new" element={<PermissionRoute permission="appointments:create"><NewAppointmentPage /></PermissionRoute>} />
              <Route path="appointments/:id" element={<PermissionRoute permission="appointments:read"><AppointmentDetailPage /></PermissionRoute>} />

              {/* Queue */}
              <Route path="queue" element={<PermissionRoute permission="queue:read"><QueuePage /></PermissionRoute>} />
              <Route path="queue/current" element={<Navigate to="/queue" replace />} />
              <Route path="queue/waiting" element={<Navigate to="/queue" replace />} />
              <Route path="queue/consultation" element={<Navigate to="/queue" replace />} />

              {/* Clinical */}
              <Route path="clinical/triage" element={<PermissionRoute permission="triage:read"><QueuePage /></PermissionRoute>} />
              <Route path="clinical/triage/:visitId" element={<PermissionRoute permission="triage:update"><TriagePage /></PermissionRoute>} />
              <Route path="clinical/consultation" element={<PermissionRoute permission="consultations:read"><ConsultationPage /></PermissionRoute>} />
              <Route path="clinical/consultation/:visitId" element={<PermissionRoute permission="consultations:update"><ConsultationPage /></PermissionRoute>} />
              <Route path="laboratory" element={<PermissionRoute permission="laboratory:read"><LabQueuePage /></PermissionRoute>} />
              <Route path="laboratory/completed" element={<PermissionRoute permission="laboratory:read"><LabResultsPage /></PermissionRoute>} />
              <Route path="laboratory/:id/result" element={<PermissionRoute permission="laboratory:update"><LabResultEntryPage /></PermissionRoute>} />
              <Route path="radiology" element={<PermissionRoute permission="radiology:read"><RadiologyQueuePage /></PermissionRoute>} />
              <Route path="radiology/completed" element={<PermissionRoute permission="radiology:read"><RadiologyResultsPage /></PermissionRoute>} />
              <Route path="radiology/:id/result" element={<PermissionRoute permission="radiology:update"><RadiologyResultEntryPage /></PermissionRoute>} />

              {/* Pharmacy */}
              <Route path="pharmacy" element={<PermissionRoute permission="pharmacy:read"><PharmacyDashboardPage /></PermissionRoute>} />
              <Route path="pharmacy/prescriptions" element={<PermissionRoute permission="prescriptions:read"><PrescriptionsPage /></PermissionRoute>} />
              <Route path="pharmacy/dispensing" element={<PermissionRoute permission="prescriptions:update"><DispensingPage /></PermissionRoute>} />
              <Route path="pharmacy/medicines" element={<PermissionRoute permission="pharmacy:read"><MedicinesPage /></PermissionRoute>} />
              <Route path="pharmacy/low-stock" element={<PermissionRoute permission="inventory:read"><LowStockPage /></PermissionRoute>} />
              <Route path="pharmacy/pos" element={<PermissionRoute permission="pharmacy:read"><POSPage /></PermissionRoute>} />
              <Route path="pharmacy/purchases" element={<PermissionRoute permission="inventory:update"><PurchasesPage /></PermissionRoute>} />
              <Route path="pharmacy/sales-history" element={<PermissionRoute permission="pharmacy:read"><SalesHistoryPage /></PermissionRoute>} />
              <Route path="pharmacy/reports" element={<PermissionRoute permission="pharmacy:read"><ReportsPage /></PermissionRoute>} />

              {/* Inventory */}
              <Route path="inventory/lab-supplies" element={<PermissionRoute permission="inventory:read"><LabSuppliesPage /></PermissionRoute>} />
              <Route path="inventory/lab-supplies/purchases" element={<PermissionRoute permission="inventory:update"><LabSuppliesPurchasesPage /></PermissionRoute>} />
              <Route path="blood-bank" element={<PermissionRoute permission="bloodbank:read"><BloodBankPage /></PermissionRoute>} />
                            <Route path="billing" element={<Navigate to="/billing/invoices" replace />} />
              <Route path="billing/invoices" element={<PermissionRoute permission="billing:read"><InvoicesPage /></PermissionRoute>} />
              <Route path="billing/invoices/create" element={<PermissionRoute permission="billing:create"><CreateInvoicePage /></PermissionRoute>} />
              <Route path="billing/payments" element={<PermissionRoute permission="billing:read"><PaymentsPage /></PermissionRoute>} />
              <Route path="billing/outstanding" element={<PermissionRoute permission="billing:read"><OutstandingPage /></PermissionRoute>} />
              <Route path="billing/insurance" element={<PermissionRoute permission="billing:read"><InsurancePage /></PermissionRoute>} />
              <Route path="billing/expenses" element={<ExpensesPage />} />
              <Route path="billing/credits-refunds" element={<PermissionRoute permission="billing:read"><CreditsRefundsPage /></PermissionRoute>} />
              <Route path="billing/bed-rent" element={<PermissionRoute permission="billing:read"><BedRentPage /></PermissionRoute>} />
              <Route path="billing/reports" element={<PermissionRoute permission="billing:read"><AccountsReportsPage /></PermissionRoute>} />
              <Route path="billing/reports/profit-loss" element={<PermissionRoute permission="billing:read"><ProfitLossPage /></PermissionRoute>} />
              <Route path="billing/reports/daily-reconciliation" element={<PermissionRoute permission="billing:read"><DailyReconciliationPage /></PermissionRoute>} />
              <Route path="billing/reports/discount-void-log" element={<PermissionRoute permission="billing:read"><DiscountVoidLogPage /></PermissionRoute>} />
              <Route path="reports/monthly" element={<PermissionRoute permission="reports:read"><MonthlyReportsPage /></PermissionRoute>} />
              <Route path="reports" element={<PermissionRoute permission="reports:read"><MonthlyReportsPage /></PermissionRoute>} />
              <Route path="departments" element={<PermissionRoute permission="departments:read"><DepartmentsPage /></PermissionRoute>} />
              <Route path="settings" element={<PermissionRoute permission="settings:read"><SettingsPage /></PermissionRoute>} />
              <Route path="settings/laboratory/tests/:id/recipe" element={<PermissionRoute permission="settings:read"><TestRecipeEditorPage /></PermissionRoute>} />
              <Route path="beds" element={<BedManagementPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
