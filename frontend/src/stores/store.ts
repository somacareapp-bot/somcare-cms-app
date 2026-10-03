import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/*  Generic persisted store primitives                                 */
/*                                                                      */
/*  ListStore<T>   - an array of records with string ids, CRUD methods */
/*  ValueStore<T>  - a single object/value, patchable                  */
/*                                                                      */
/*  Both persist to localStorage and notify subscribers on every       */
/*  change, so any panel/component reading from the same store re-     */
/*  renders automatically the instant another panel edits it.          */
/* ------------------------------------------------------------------ */

type Listener = () => void;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, in-memory state still works
  }
}

export class ListStore<T extends { id: string }> {
  private data: T[];
  private listeners = new Set<Listener>();
  private storageKey: string;

  constructor(storageKey: string, initial: T[]) {
    this.storageKey = `cms:${storageKey}`;
    this.data = loadFromStorage(this.storageKey, initial);
  }

  getSnapshot = (): T[] => this.data;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private commit(next: T[]) {
    this.data = next;
    saveToStorage(this.storageKey, this.data);
    this.listeners.forEach((l) => l());
  }

  add(item: Omit<T, 'id'>): T {
    const withId = { ...item, id: makeId() } as T;
    this.commit([...this.data, withId]);
    return withId;
  }

  update(id: string, patch: Partial<Omit<T, 'id'>>) {
    this.commit(this.data.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  remove(id: string) {
    this.commit(this.data.filter((row) => row.id !== id));
  }

  find(id: string): T | undefined {
    return this.data.find((row) => row.id === id);
  }
}

export class ValueStore<T> {
  private value: T;
  private listeners = new Set<Listener>();
  private storageKey: string;

  constructor(storageKey: string, initial: T) {
    this.storageKey = `cms:${storageKey}`;
    this.value = loadFromStorage(this.storageKey, initial);
  }

  getSnapshot = (): T => this.value;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(patch: Partial<T>) {
    this.value = { ...this.value, ...patch };
    saveToStorage(this.storageKey, this.value);
    this.listeners.forEach((l) => l());
  }

  replace(next: T) {
    this.value = next;
    saveToStorage(this.storageKey, this.value);
    this.listeners.forEach((l) => l());
  }
}

/* ------------------------------------------------------------------ */
/*  Shape both ListStore and ApiListStore satisfy, so components like   */
/*  EditableTable can accept either a local (localStorage) store or a   */
/*  real API-backed store interchangeably.                              */
/* ------------------------------------------------------------------ */
export interface ListStoreLike<T extends { id: string }> {
  getSnapshot: () => T[];
  subscribe: (listener: Listener) => () => void;
  add: (item: Omit<T, 'id'>) => T | void | Promise<T>;
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => void | Promise<void>;
  remove: (id: string) => void | Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  ApiListStore<T> - same shape as ListStore, but backed by real HTTP  */
/*  calls instead of localStorage. Data loads lazily on first           */
/*  subscribe() (i.e. the first component that reads it), and every     */
/*  add/update/remove re-fetches or patches local state and notifies    */
/*  subscribers so the UI updates automatically.                        */
/* ------------------------------------------------------------------ */
export class ApiListStore<T extends { id: string }> implements ListStoreLike<T> {
  private data: T[] = [];
  private listeners = new Set<Listener>();
  private loaded = false;
  private onError?: (action: 'load' | 'add' | 'update' | 'remove', error: unknown) => void;

  constructor(
    private api: {
      fetchAll: () => Promise<T[]>;
      create: (item: Omit<T, 'id'>) => Promise<T>;
      update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>;
      remove: (id: string) => Promise<void>;
    },
    onError?: (action: 'load' | 'add' | 'update' | 'remove', error: unknown) => void,
  ) {
    this.onError = onError;
  }

  getSnapshot = (): T[] => this.data;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (!this.loaded) {
      this.loaded = true;
      this.refresh();
    }
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async refresh() {
    try {
      this.data = await this.api.fetchAll();
      this.notify();
    } catch (err) {
      this.onError?.('load', err);
    }
  }

  async add(item: Omit<T, 'id'>) {
    try {
      const created = await this.api.create(item);
      this.data = [...this.data, created];
      this.notify();
      return created;
    } catch (err) {
      this.onError?.('add', err);
      throw err;
    }
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>) {
    try {
      const updated = await this.api.update(id, patch);
      this.data = this.data.map((row) => (row.id === id ? updated : row));
      this.notify();
    } catch (err) {
      this.onError?.('update', err);
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.api.remove(id);
      this.data = this.data.filter((row) => row.id !== id);
      this.notify();
    } catch (err) {
      this.onError?.('remove', err);
      throw err;
    }
  }

  find(id: string): T | undefined {
    return this.data.find((row) => row.id === id);
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------------------------------------------ */
/*  React bindings                                                     */
/* ------------------------------------------------------------------ */

export function useListStore<T extends { id: string }>(store: ListStoreLike<T>): T[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useValueStore<T>(store: ValueStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
