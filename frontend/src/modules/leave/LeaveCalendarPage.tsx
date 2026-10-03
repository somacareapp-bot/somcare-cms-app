import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { leaveApi } from './leaveApi';
import { PageHeader, cardCls, btnGhost, fmtRange, fmtDays } from './leaveShared';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function LeaveCalendarPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m: 0-11

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const from = iso(cursor.y, cursor.m + 1, 1);
  const to = iso(cursor.y, cursor.m + 1, daysInMonth);
  const entries = useQuery({ queryKey: ['leave', 'calendar', from, to], queryFn: () => leaveApi.calendar(from, to) });
  const list = entries.data ?? [];

  const lead = new Date(cursor.y, cursor.m, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const legend = Array.from(new Map(list.map((e) => [e.leaveTypeId, e])).values());

  return (
    <div>
      <PageHeader
        title="Leave Calendar"
        subtitle="Who is away and when. Pending requests are shown faded."
        actions={
          <>
            <button className={btnGhost} onClick={() => move(-1)}><ChevronLeft size={16} /></button>
            <span className="min-w-[10rem] text-center text-sm font-semibold text-gray-900">{title}</span>
            <button className={btnGhost} onClick={() => move(1)}><ChevronRight size={16} /></button>
            <button className={btnGhost} onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
          </>
        }
      />

      <div className={`${cardCls} overflow-hidden`}>
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
          {WEEKDAYS.map((w) => (<div key={w} className="py-2">{w}</div>))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = d ? iso(cursor.y, cursor.m + 1, d) : '';
            const day = d ? list.filter((e) => e.startDate <= key && key <= e.endDate) : [];
            return (
              <div key={i} className={`min-h-[6.5rem] border-b border-r border-gray-100 p-1.5 ${d ? '' : 'bg-gray-50/60'}`}>
                {d && (
                  <>
                    <div className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${key === today ? 'bg-primary-600 font-semibold text-white' : 'text-gray-600'}`}>
                      {d}
                    </div>
                    <div className="space-y-0.5">
                      {day.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          title={`${e.userName} — ${e.leaveTypeName} (${e.status})`}
                          className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${e.status === 'pending' ? 'opacity-50' : ''}`}
                          style={{ backgroundColor: e.color }}
                        >
                          {e.userName}
                        </div>
                      ))}
                      {day.length > 3 && <div className="px-1 text-[11px] text-gray-500">+{day.length - 3} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {legend.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
          {legend.map((e) => (
            <span key={e.leaveTypeId} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} /> {e.leaveTypeName}
            </span>
          ))}
        </div>
      )}

      <div className={`${cardCls} mt-6`}>
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Leave this month</div>
        {list.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Nobody is on leave this month.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                  {e.userName}
                  <span className="font-normal text-gray-500">· {e.leaveTypeName}</span>
                </span>
                <span className="text-gray-600">
                  {fmtRange(e.startDate, e.endDate)} · {fmtDays(e.days)} day(s)
                  {e.status === 'pending' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Pending</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
