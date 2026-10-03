import { type ReactNode } from 'react';
import { useToast } from './Toast';
import {
  WEEKDAYS,
  type WeeklyHoursValue,
  permissionsStore,
  rolePermissionsStore,
} from '../../../stores/settingsData';
import { useListStore, useValueStore } from '../../../stores/store';

/* ------------------------------------------------------------------ */
/*  Panel shell — every settings form lives inside one of these        */
/* ------------------------------------------------------------------ */

export function PanelShell({
  title,
  description,
  children,
  onSave,
  onReset,
  hideFooter,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  /** Table-only panels (Add/Edit/Delete already save immediately) don't need a footer. */
  hideFooter?: boolean;
}) {
  const { show } = useToast();
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-l-4 border-blue-600 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="space-y-6 px-6 pb-6">{children}</div>
      {!hideFooter && (
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={() => {
              onReset?.();
              show('Reverted to last saved values');
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            onClick={() => {
              onSave?.();
              show(`${title} saved`);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>;
}

export function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={className ? `${inputCls} ${className}` : inputCls} />;
}

export function SelectInput({
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] | string[] }) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <select {...rest} className={inputCls}>
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 3} className={inputCls} />;
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChecklistGrid — now store-backed: toggling persists and any other  */
/*  panel reading the same store sees the change immediately           */
/* ------------------------------------------------------------------ */

export function ChecklistGrid({
  allOptions,
  selected,
  onChange,
}: {
  allOptions: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const set = new Set(selected);
  const toggle = (item: string) => {
    const next = new Set(set);
    next.has(item) ? next.delete(item) : next.add(item);
    onChange(Array.from(next));
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {allOptions.map((item) => (
        <label key={item} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={set.has(item)}
            onChange={() => toggle(item)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {item}
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WeeklyHoursEditor — store-backed weekly schedule editor, reused    */
/*  for facility hours, per-doctor schedules, and department schedules */
/* ------------------------------------------------------------------ */

export function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: WeeklyHoursValue;
  onChange: (next: WeeklyHoursValue) => void;
}) {
  const toggleClosed = (day: string) => {
    const closedDays = value.closedDays.includes(day)
      ? value.closedDays.filter((d) => d !== day)
      : [...value.closedDays, day];
    onChange({ ...value, closedDays });
  };

  const setTime = (day: string, field: 'open' | 'close', time: string) => {
    onChange({
      ...value,
      hours: { ...value.hours, [day]: { ...value.hours[day], [field]: time } },
    });
  };

  return (
    <div>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {WEEKDAYS.map((day) => {
          const isClosed = value.closedDays.includes(day);
          const dayHours = value.hours[day] ?? { open: '08:00', close: '17:00' };
          return (
            <div key={day} className="flex items-center gap-4 px-4 py-2.5">
              <span className="w-28 text-sm font-medium text-gray-700">{day}</span>
              {isClosed ? (
                <span className="flex-1 text-sm text-gray-400">Closed</span>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={dayHours.open}
                    onChange={(e) => setTime(day, 'open', e.target.value)}
                    className={`${inputCls} w-32`}
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={dayHours.close}
                    onChange={(e) => setTime(day, 'close', e.target.value)}
                    className={`${inputCls} w-32`}
                  />
                </div>
              )}
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={isClosed}
                  onChange={() => toggleClosed(day)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>
      <Field label="Upcoming Holiday Closures" hint="Comma-separated dates the facility is closed" full>
        <TextInput
          value={value.holidays}
          onChange={(e) => onChange({ ...value, holidays: e.target.value })}
          placeholder="e.g. 2026-12-25, 2027-01-01"
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PermissionMatrix — reads/writes rolePermissionsStore directly, so  */
/*  it and the single-role "Role Permissions" panel always agree       */
/* ------------------------------------------------------------------ */

export function PermissionMatrix({ roles }: { roles: { id: string; name: string }[] }) {
  const permissions = useListStore(permissionsStore);
  const grants = useValueStore(rolePermissionsStore);

  const toggle = (roleId: string, permId: string) => {
    const current = new Set(grants[roleId] ?? []);
    current.has(permId) ? current.delete(permId) : current.add(permId);
    rolePermissionsStore.set({ [roleId]: Array.from(current) });
  };

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 font-medium">Permission</th>
            {roles.map((r) => (
              <th key={r.id} className="px-3 py-2 text-center font-medium">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {permissions.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-gray-700">{p.label}</td>
              {roles.map((r) => (
                <td key={r.id} className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={(grants[r.id] ?? []).includes(p.id)}
                    onChange={() => toggle(r.id, p.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
