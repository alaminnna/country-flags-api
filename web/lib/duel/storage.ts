import { DuelMeta, DuelResult, DuelStore } from './types';

const STORAGE_KEY = 'flags.quiz.duels.v1';
const MAX_COMPLETED = 20;

function loadStore(): DuelStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { created: {}, completed: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'created' in parsed && 'completed' in parsed) {
      return parsed as DuelStore;
    }
  } catch {
    // Corrupt data — reset silently
  }
  return { created: {}, completed: {} };
}

function saveStore(store: DuelStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Safari private mode or quota exceeded — never block UI
  }
}

export function recordCreatedDuel(meta: DuelMeta): void {
  const store = loadStore();
  store.created[meta.checksum] = meta;
  saveStore(store);
}

export function isOwnDuel(checksum: number): boolean {
  const store = loadStore();
  return checksum in store.created;
}

export function getCreatedDuel(checksum: number): DuelMeta | undefined {
  const store = loadStore();
  return store.created[checksum];
}

export function recordCompletedDuel(result: DuelResult): void {
  const store = loadStore();
  store.completed[result.checksum] = result;

  const keys = Object.keys(store.completed).map(Number);
  if (keys.length > MAX_COMPLETED) {
    const sorted = keys.sort((a, b) => {
      const ra = store.completed[a];
      const rb = store.completed[b];
      return (ra?.completedAt ?? 0) - (rb?.completedAt ?? 0);
    });
    const toRemove = sorted.slice(0, keys.length - MAX_COMPLETED);
    for (const key of toRemove) {
      delete store.completed[key];
    }
  }

  saveStore(store);
}

export function isCompletedDuel(checksum: number): boolean {
  const store = loadStore();
  return checksum in store.completed;
}

export function getCompletedDuel(checksum: number): DuelResult | undefined {
  const store = loadStore();
  return store.completed[checksum];
}
