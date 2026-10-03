"""
add_completed_column.py
Changes to QueuePage.tsx:
  1. Adds a 5th "Completed" column to columnDefs
  2. Changes Doctor column cards to show a "Complete" button (moves to 'completed')
  3. Changes grid from 4 to 5 columns
  4. Completed cards show a green checkmark badge, are NOT clickable
"""
from pathlib import Path

TARGET = Path(__file__).parent / "frontend/src/modules/queue/QueuePage.tsx"
src = TARGET.read_text(encoding="utf-8")
original = src

# ── 1. Add Completed to columnDefs ──────────────────────────────────────────
src = src.replace(
    "  { key: 'ready_discharge', title: 'Pharmacy', accent: 'border-l-emerald-400' },\n\n];",
    "  { key: 'ready_discharge', title: 'Pharmacy', accent: 'border-l-emerald-400' },\n"
    "  { key: 'completed', title: 'Completed', accent: 'border-l-green-400' },\n\n];"
)

# ── 2. Change grid from 4 cols to 5 cols ────────────────────────────────────
src = src.replace(
    'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"',
    'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"'
)

# ── 3. Replace the visit card block with one that:
#       • Shows a "Complete" button on Doctor column cards
#       • Shows a green ✓ badge on Completed column cards
#       • Is not clickable in Completed column
OLD_CARD = """                    {visits.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (col.key === 'with_doctor') navigate(`/clinical/consultation/${v.id}`);
                          if (col.key === 'waiting' || col.key === 'in_triage') navigate(`/clinical/triage/${v.id}`);
                        }}
                        className={`bg-clinical-50 rounded-lg p-3 border-l-[3px] ${urgencyBorder[v.urgency] || col.accent} ${
                          ['with_doctor', 'waiting', 'in_triage'].includes(col.key)
                            ? 'cursor-pointer hover:bg-clinical-100/70'
                            : ''
                        } transition-colors`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-clinical-400">{v.visitNumber}</span>
                          {v.urgency === 'emergency' && (
                            <span className="text-[10px] font-bold text-red-600 uppercase">Urgent</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-clinical-900 mt-1">
                          {v.patient.firstName} {v.patient.lastName}
                        </p>
                        <p className="text-xs text-clinical-500 mt-0.5">
                          {v.patient.patientNumber} · {timeAgo(v.checkedInAt)}
                        </p>
                        {v.doctor && (
                          <p className="text-[11px] text-primary-600 font-medium mt-0.5">
                            Dr. {v.doctor.firstName} {v.doctor.lastName}
                          </p>
                        )}
                      </div>
                    ))}"""

NEW_CARD = """                    {visits.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (col.key === 'with_doctor') navigate(`/clinical/consultation/${v.id}`);
                          if (col.key === 'waiting' || col.key === 'in_triage') navigate(`/clinical/triage/${v.id}`);
                        }}
                        className={`rounded-lg p-3 border-l-[3px] ${
                          col.key === 'completed' ? 'bg-green-50 border-l-green-400' : `bg-clinical-50 ${urgencyBorder[v.urgency] || col.accent}`
                        } ${
                          ['with_doctor', 'waiting', 'in_triage'].includes(col.key)
                            ? 'cursor-pointer hover:bg-clinical-100/70'
                            : ''
                        } transition-colors`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-clinical-400">{v.visitNumber}</span>
                          {col.key === 'completed' ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">✓ Done</span>
                          ) : v.urgency === 'emergency' ? (
                            <span className="text-[10px] font-bold text-red-600 uppercase">Urgent</span>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-clinical-900 mt-1">
                          {v.patient.firstName} {v.patient.lastName}
                        </p>
                        <p className="text-xs text-clinical-500 mt-0.5">
                          {v.patient.patientNumber} · {timeAgo(v.checkedInAt)}
                        </p>
                        {v.doctor && (
                          <p className="text-[11px] text-primary-600 font-medium mt-0.5">
                            Dr. {v.doctor.firstName} {v.doctor.lastName}
                          </p>
                        )}
                        {/* Doctor column: Complete button */}
                        {col.key === 'with_doctor' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveMutation.mutate({ id: v.id, status: 'completed' });
                            }}
                            disabled={moveMutation.isPending}
                            className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md py-1 disabled:opacity-50"
                          >
                            ✓ Complete Consultation
                          </button>
                        )}
                      </div>
                    ))}"""

if OLD_CARD in src:
    src = src.replace(OLD_CARD, NEW_CARD)
    print("OK  — visit cards updated with Complete button + Completed column styling")
else:
    print("WARN — card block not matched exactly; check manually")

# ── Write back ───────────────────────────────────────────────────────────────
TARGET.with_suffix('.tsx.bak').write_text(original, encoding='utf-8')
TARGET.write_text(src, encoding='utf-8')
print("SUCCESS — QueuePage.tsx updated. Refresh the browser.")
