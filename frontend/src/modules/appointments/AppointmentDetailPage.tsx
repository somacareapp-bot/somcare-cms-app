import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  UserCheck,
  AlertCircle,
  Download,
} from 'lucide-react';
import { appointmentsApi, facilityApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { jsPDF } from 'jspdf';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  in_triage: 'bg-orange-100 text-orange-700',
  with_doctor: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  waiting: 'Waiting',
  in_triage: 'In triage',
  with_doctor: 'With doctor',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

// Who owns moving the appointment out of each status — shown when the
// viewer's role can't take the next step themselves.
const NEXT_OWNER: Record<string, string> = {
  scheduled: 'a receptionist',
  confirmed: 'a receptionist',
};

const FLOW_STEPS = ['scheduled', 'confirmed', 'waiting'];

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-clinical-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-clinical-500" />
      </div>
      <div>
        <p className="text-xs text-clinical-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-clinical-800 font-medium mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}


async function generateCheckInReceipt(a) {
  let facility = {};
  try {
    const res = await facilityApi.get();
    facility = res.data || {};
  } catch (e) { /* use defaults */ }

  const facilityName  = facility.name     || 'SOMCARE';
  const facilityTag   = facility.tagline  || 'Better Health  •  Brighter Future';
  const facilityAddr  = facility.address  || 'Hargeisa, Somaliland';
  const facilityPhone = facility.phone    || '';
  const facilityEmail = facility.email    || 'info@somcare.health';
  const facilityWeb   = facility.website  || '';

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageW    = 148;
  const margin   = 14;
  const colRight = pageW - margin;
  const half     = (colRight - margin) / 2;

  const BRAND  = [153, 0, 0];
  const DARK   = [30, 30, 40];
  const MID    = [90, 90, 110];
  const LGRAY  = [200, 210, 220];
  const WHITE  = [255, 255, 255];

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(facilityName, margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(facilityTag, margin, 18);

  if (facilityAddr) {
    doc.setFontSize(6.5);
    doc.text(facilityAddr, margin, 23.5);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('APPOINTMENT CHECK-IN RECEIPT', colRight, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const now = new Date();
  doc.text(now.toLocaleString('en-US', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }), colRight, 18, { align: 'right' });
  if (facilityPhone) doc.text(facilityPhone, colRight, 23.5, { align: 'right' });

  // ── Receipt number + CHECKED IN pill ───────────────────────────────────
  let y = 37;
  doc.setTextColor(...MID);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt / Appointment No.', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.text(a.appointmentNumber || a.id || '—', margin, y + 5);

  doc.setFillColor(220, 38, 38);
  doc.roundedRect(colRight - 28, y - 3, 28, 8, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECKED IN', colRight - 14, y + 2, { align: 'center' });

  y += 9;
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, y, colRight, y);
  y += 6;

  function sectionHead(label, yPos) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND);
    doc.text(label, margin, yPos);
  }

  function pair(label1, value1, label2, value2, yPos) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID);
    doc.text(label1, margin, yPos);
    if (label2) doc.text(label2, margin + half, yPos);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text(value1 || '—', margin, yPos + 4.5);
    if (label2) doc.text(value2 || '—', margin + half, yPos + 4.5);
  }

  // ── Patient (2-column) ──────────────────────────────────────────────────
  sectionHead('PATIENT INFORMATION', y);
  y += 5;

  const patientName = [a.patient?.firstName, a.patient?.middleName, a.patient?.lastName].filter(Boolean).join(' ') || a.patientName || '—';
  pair('Full Name', patientName, 'Patient Number', a.patient?.patientNumber || a.patientNumber, y);
  y += 9;

  const dob = a.patient?.dateOfBirth
    ? new Date(a.patient.dateOfBirth).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'2-digit' })
    : '—';
  const gender = a.patient?.gender
    ? a.patient.gender.charAt(0).toUpperCase() + a.patient.gender.slice(1)
    : '—';
  pair('Date of Birth', dob, 'Gender', gender, y);
  y += 9;

  doc.setDrawColor(...LGRAY);
  doc.line(margin, y, colRight, y);
  y += 6;

  // ── Appointment (2-column) ──────────────────────────────────────────────
  sectionHead('APPOINTMENT DETAILS', y);
  y += 5;

  const dateStr = a.appointmentDate
    ? new Date(a.appointmentDate).toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' })
    : '—';
  const timeStr = a.appointmentTime
    ? new Date('1970-01-01T' + a.appointmentTime).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })
    : a.time || '—';
  pair('Date', dateStr, 'Time', timeStr, y);
  y += 9;

  const doctorName = a.doctor
    ? 'Dr. ' + [a.doctor.firstName, a.doctor.lastName].filter(Boolean).join(' ')
    : a.doctorName || '—';
  pair('Department', a.department, 'Appointment Type', a.appointmentType || a.type, y);
  y += 9;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID);
  doc.text('Doctor / Provider', margin, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text(doctorName, margin, y + 4.5);
  y += 9;

  if (a.notes) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID);
    doc.text('Notes', margin, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...DARK);
    doc.text(a.notes, margin, y + 4.5, { maxWidth: colRight - margin });
    y += 9;
  }

  doc.setDrawColor(...LGRAY);
  doc.line(margin, y, colRight, y);
  y += 6;

  // ── Payment ──────────────────────────────────────────────────────────────
  sectionHead('PAYMENT SUMMARY', y);
  y += 6;

  const consultationFee = parseFloat(a.consultationFee || a.fee || 0);
  const additionalFee   = parseFloat(a.additionalFee || 0);
  const totalFee        = consultationFee + additionalFee;
  const currency        = a.currency || 'USD';

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID);
  doc.text('Consultation Fee', margin, y);
  doc.text(currency + ' ' + consultationFee.toFixed(2), colRight, y, { align: 'right' });
  y += 6;
  if (additionalFee > 0) {
    doc.text('Additional Charges', margin, y);
    doc.text(currency + ' ' + additionalFee.toFixed(2), colRight, y, { align: 'right' });
    y += 6;
  }

  doc.setFillColor(...BRAND);
  doc.rect(margin, y, colRight - margin, 9, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('TOTAL', margin + 3, y + 6.2);
  doc.text(currency + ' ' + totalFee.toFixed(2), colRight - 3, y + 6.2, { align: 'right' });
  y += 15;

  // ── QR Code ──────────────────────────────────────────────────────────────
  doc.setDrawColor(...LGRAY);
  doc.line(margin, y, colRight, y);
  y += 6;

  const patNum  = a.patient?.patientNumber || a.patientNumber || '';
  const trackUrl = 'https://logging-leader-brain-navy.trycloudflare.com' + '/track.html?pn=' + encodeURIComponent(patNum) + '&aid=' + encodeURIComponent(a.id || '');

  try {
    const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(trackUrl);
    const qrResp = await fetch(qrApiUrl);
    if (qrResp.ok) {
      const blob = await qrResp.blob();
      const reader = new FileReader();
      await new Promise(resolve => { reader.onload = resolve; reader.readAsDataURL(blob); });
      const qrDataUrl = reader.result;
      const qrSize = 22;
      doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...DARK);
      doc.text('Track Your Queue', margin + qrSize + 4, y + 4.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MID);
      doc.text('Scan for your real-time position', margin + qrSize + 4, y + 9);
      doc.text('Triage → Doctor → Lab → Pharmacy', margin + qrSize + 4, y + 13.5);
      y += qrSize + 5;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID);
      doc.text('Track queue: ' + trackUrl, margin, y + 5);
      y += 10;
    }
  } catch (qrErr) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID);
    doc.text('Track queue: ' + trackUrl, margin, y + 5);
    y += 10;
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MID);
  doc.text('Thank you for choosing ' + facilityName + '. Please present this receipt at the front desk.', pageW / 2, y, { align: 'center' });
  y += 4;
  const contactParts = [facilityEmail, facilityWeb].filter(Boolean);
  if (contactParts.length) doc.text(contactParts.join('  |  '), pageW / 2, y, { align: 'center' });

  doc.save('receipt-' + (a.appointmentNumber || a.id || 'appt') + '.pdf');
}

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const pendingStatusRef = useRef('');
  const hasRole = useAuthStore((s) => s.hasRole);

  const canReceptionist = hasRole('receptionist') || hasRole('administrator');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsApi.getOne(id!).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: (status: string) => appointmentsApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowCancelConfirm(false);
      console.log("CHECK-IN RECEIPT DEBUG", pendingStatusRef.current, !!data);
      if (pendingStatusRef.current === 'waiting' && data) {
        generateCheckInReceipt(data);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-clinical-400">Loading...</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-xl border border-clinical-200 p-12 text-center">
        <p className="text-clinical-400">Appointment not found.</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-primary-600 text-sm hover:underline">Go back</button>
      </div>
    );
  }

  const a = data;
  const name = [a.patient?.firstName, a.patient?.middleName, a.patient?.lastName]
    .filter(Boolean).join(' ') || a.patientName || '—';
  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const dateStr = a.appointmentDate
    ? new Date(a.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const time = a.appointmentTime
    ? new Date(`1970-01-01T${a.appointmentTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : a.time ?? '—';

  // 'waiting' is terminal for the appointment itself — the patient has
  // handed off to the clinical Triage queue at that point.
  const isTerminal = ['waiting', 'completed', 'cancelled', 'no_show'].includes(a.status);
  const currentStep = FLOW_STEPS.indexOf(a.status);

  const ACTIONS: { label: string; next: string; icon: any; color: string }[] = [
    ...(a.status === 'scheduled' && canReceptionist ? [
      { label: 'Confirm', next: 'confirmed', icon: CheckCircle, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
      { label: 'Mark no show', next: 'no_show', icon: XCircle, color: 'bg-red-50 hover:bg-red-100 text-red-500 border border-red-200' },
    ] : []),
    ...(a.status === 'confirmed' && canReceptionist ? [
      { label: 'Check in', next: 'waiting', icon: UserCheck, color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
      { label: 'Mark no show', next: 'no_show', icon: XCircle, color: 'bg-red-50 hover:bg-red-100 text-red-500 border border-red-200' },
    ] : []),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-clinical-200 hover:bg-clinical-50 text-clinical-500"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-clinical-900">Appointment</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[a.status] ?? a.status}
            </span>
          </div>
          <p className="text-clinical-400 text-xs mt-0.5">{a.appointmentNumber ?? a.id}</p>
        </div>
        {a.status === 'waiting' && (
          <button
            onClick={() => generateCheckInReceipt(data)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-clinical-200 text-clinical-600 hover:bg-clinical-50 shrink-0"
          >
            <Download size={15} />
            Download Receipt
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!['cancelled', 'no_show'].includes(a.status) && (
        <div className="bg-white rounded-xl border border-clinical-200 p-4">
          <div className="flex items-center gap-0">
            {FLOW_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    done ? 'bg-primary-600 border-primary-600 text-white' : 'border-clinical-200 text-clinical-300'
                  } ${active ? 'ring-2 ring-primary-200' : ''}`}>
                    {i + 1}
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-primary-600' : 'bg-clinical-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex mt-1">
            {FLOW_STEPS.map((step) => (
              <div key={step} className="flex-1 text-center">
                <p className="text-xs text-clinical-400 capitalize">{STATUS_LABELS[step]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-600 text-white text-lg font-bold flex items-center justify-center">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-clinical-900 text-lg">{name}</p>
            <button
              onClick={() => a.patient?.id && navigate(`/patients/${a.patient.id}`)}
              className="text-xs text-primary-600 hover:underline"
            >
              {a.patient?.patientNumber ?? a.patientNumber ?? 'View patient record →'}
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-clinical-200 p-5 grid grid-cols-2 gap-5">
        <Field icon={Calendar} label="Date" value={dateStr} />
        <Field icon={Clock} label="Time" value={time} />
        <Field icon={Building2} label="Department" value={a.department ?? '—'} />
        <Field icon={FileText} label="Type" value={a.appointmentType ?? a.type ?? '—'} />
        <Field icon={User} label="Doctor" value={a.doctor ? `Dr. ${[a.doctor.firstName, a.doctor.lastName].filter(Boolean).join(' ')}` : (a.doctorName ?? '—')} />
      </div>

      {a.notes && (
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-xs font-medium text-clinical-400 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-clinical-700 text-sm">{a.notes}</p>
        </div>
      )}

      {/* Actions */}
      {!isTerminal && (
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm font-medium text-clinical-600 mb-3">Update status</p>
          {ACTIONS.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.next}
                    onClick={() => { pendingStatusRef.current = action.next; updateStatus(action.next); }}
                    disabled={updatingStatus}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${action.color} disabled:opacity-60`}
                  >
                    <Icon size={15} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-clinical-400">
              Waiting on {NEXT_OWNER[a.status] ?? 'the next step'} to move this forward.
            </p>
          )}
        </div>
      )}

      {/* Danger zone */}
      {!isTerminal && canReceptionist && (
        <div className="bg-white rounded-xl border border-red-100 p-5">
          <p className="text-sm font-medium text-clinical-600 mb-3">Cancel appointment</p>
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50"
            >
              <XCircle size={15} /> Cancel appointment
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-clinical-600">Are you sure?</p>
              <button
                onClick={() => updateStatus('cancelled')}
                disabled={updatingStatus}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {updatingStatus ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50"
              >
                Keep it
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
