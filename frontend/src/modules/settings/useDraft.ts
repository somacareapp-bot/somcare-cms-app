import { useState } from 'react';
import type { ValueStore } from '../../stores/store';
import { useValueStore } from '../../stores/store';

export function useDraft<T>(store: ValueStore<T>) {
  const stored = useValueStore(store);
  const [draft, setDraft] = useState<T>(stored);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<T>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  function save() {
    store.set(draft);
    setDirty(false);
  }

  function reset() {
    setDraft(stored);
    setDirty(false);
  }

  return { draft, patch, save, reset, dirty };
}
