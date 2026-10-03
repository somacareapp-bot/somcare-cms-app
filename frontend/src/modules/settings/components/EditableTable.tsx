import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import type { ListStoreLike } from '../../../stores/store';
import { useListStore } from '../../../stores/store';
import { Field, FieldGrid, TextInput, SelectInput, Toggle } from './primitives';

export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'boolean';
  /** Static options (plain strings or {value,label} pairs), or a function called at
   *  render time — pass a function to pull live options from another store (e.g.
   *  department names), so the dropdown always reflects that other panel's state. */
  options?: string[] | { value: string; label: string }[] | (() => { value: string; label: string }[]);
  /** Custom cell display, e.g. resolving a stored departmentId to its current name. */
  render?: (row: T) => ReactNode;
  hideInForm?: boolean;
}

interface EditableTableProps<T extends { id: string }> {
  store: ListStoreLike<T>;
  columns: ColumnDef<T>[];
  addLabel?: string;
  /** Singular display name used in toasts and confirm dialogs, e.g. "Branch". */
  entityName: string;
  /** Blank record used to seed the "Add" form. */
  defaults: Omit<T, 'id'>;
  /** Optional display-only filter (e.g. a search box) — CRUD still targets the real store. */
  filterRows?: (rows: T[]) => T[];
}

export function EditableTable<T extends Record<string, any> & { id: string }>({
  store,
  columns,
  addLabel = '+ Add',
  entityName,
  defaults,
  filterRows,
}: EditableTableProps<T>) {
  const allRows = useListStore(store);
  const rows = filterRows ? filterRows(allRows) : allRows;
  const { show } = useToast();
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; draft: T } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function openAdd() {
    setModal({ mode: 'add', draft: { ...(defaults as T), id: '' } });
  }
  function openEdit(row: T) {
    setModal({ mode: 'edit', draft: { ...row } });
  }
  function setField(key: string, value: unknown) {
    setModal((prev) => (prev ? { ...prev, draft: { ...prev.draft, [key]: value } } : prev));
  }
  function save() {
    if (!modal) return;
    const { id, ...rest } = modal.draft;
    if (modal.mode === 'add') {
      store.add(rest as Omit<T, 'id'>);
      show(`${entityName} added`);
    } else {
      store.update(id, rest as Partial<Omit<T, 'id'>>);
      show(`${entityName} updated`);
    }
    setModal(null);
  }
  function doDelete() {
    if (!confirmDeleteId) return;
    store.remove(confirmDeleteId);
    show(`${entityName} deleted`);
    setConfirmDeleteId(null);
  }

  function resolveOptions(col: ColumnDef<T>) {
    if (!col.options) return [];
    const raw = typeof col.options === 'function' ? col.options() : col.options;
    return raw.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-sm text-gray-400">
                  No {entityName.toLowerCase()}s yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-gray-700">
                    {c.render
                      ? c.render(row)
                      : c.type === 'boolean'
                      ? row[c.key]
                        ? 'Yes'
                        : 'No'
                      : String(row[c.key] ?? '—')}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button onClick={() => openEdit(row)} className="text-xs font-medium text-blue-600 hover:underline">
                    Edit
                  </button>
                  <span className="mx-1.5 text-gray-300">|</span>
                  <button
                    onClick={() => setConfirmDeleteId(row.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={openAdd} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
        {addLabel}
      </button>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? `Add ${entityName}` : `Edit ${entityName}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                onClick={() => setModal(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {modal.mode === 'add' ? 'Add' : 'Save'}
              </button>
            </>
          }
        >
          <FieldGrid>
            {columns
              .filter((c) => !c.hideInForm)
              .map((c) => (
                <Field key={c.key} label={c.label}>
                  {c.type === 'select' ? (
                    <SelectInput
                      options={resolveOptions(c)}
                      value={String(modal.draft[c.key] ?? '')}
                      onChange={(e) => setField(c.key, e.target.value)}
                    />
                  ) : c.type === 'boolean' ? (
                    <div className="pt-1">
                      <Toggle checked={!!modal.draft[c.key]} onChange={(v) => setField(c.key, v)} />
                    </div>
                  ) : c.type === 'date' ? (
                    <TextInput
                      type="date"
                      value={String(modal.draft[c.key] ?? '')}
                      onChange={(e) => setField(c.key, e.target.value)}
                    />
                  ) : c.type === 'number' ? (
                    <TextInput
                      type="number"
                      value={String(modal.draft[c.key] ?? '')}
                      onChange={(e) => setField(c.key, Number(e.target.value))}
                    />
                  ) : (
                    <TextInput
                      value={String(modal.draft[c.key] ?? '')}
                      onChange={(e) => setField(c.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
          </FieldGrid>
        </Modal>
      )}

      {confirmDeleteId && (
        <Modal
          title={`Delete ${entityName}?`}
          onClose={() => setConfirmDeleteId(null)}
          width="max-w-sm"
          footer={
            <>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={doDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            This can't be undone. If anything elsewhere references this {entityName.toLowerCase()}, you'll want to
            update that too.
          </p>
        </Modal>
      )}
    </div>
  );
}
