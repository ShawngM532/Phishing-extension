import { vi, type Mock } from 'vitest';

export interface StorageAreaMock {
  readonly store: Map<string, unknown>;
  reset(): void;
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export function createStorageAreaMock(): StorageAreaMock {
  const store = new Map<string, unknown>();
  return {
    store,
    reset(): void {
      store.clear();
    },
    get: vi.fn((key: string) => Promise.resolve(store.has(key) ? { [key]: store.get(key) } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
  };
}

type ChangeListener = (changes: Record<string, unknown>, area: string) => void;

export interface ChromeMockHandle {
  action: {
    setIcon: Mock;
    setBadgeText: Mock;
    setBadgeBackgroundColor: Mock;
  };
  tabs: {
    query: Mock;
    remove: Mock;
  };
  runtime: {
    sendMessage: Mock;
  };
  session: StorageAreaMock;
  sync: StorageAreaMock;
  emitChange(changes: Record<string, unknown>, area: string): void;
}

export function installChromeMock(): ChromeMockHandle {
  const session = createStorageAreaMock();
  const sync = createStorageAreaMock();
  const changeListeners: ChangeListener[] = [];

  const action = {
    setIcon: vi.fn(() => Promise.resolve()),
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  };
  const tabs = {
    query: vi.fn(() => Promise.resolve([])),
    remove: vi.fn(() => Promise.resolve()),
  };
  const runtime = { sendMessage: vi.fn(() => Promise.resolve({ state: null })) };

  const chromeMock = {
    storage: {
      session,
      sync,
      onChanged: {
        addListener: (listener: ChangeListener): void => {
          changeListeners.push(listener);
        },
      },
    },
    action,
    runtime,
    tabs,
    webNavigation: {
      onBeforeNavigate: { addListener: vi.fn() },
      onCommitted: { addListener: vi.fn() },
      onCompleted: { addListener: vi.fn() },
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

  return {
    action,
    tabs,
    runtime,
    session,
    sync,
    emitChange(changes: Record<string, unknown>, area: string): void {
      for (const listener of changeListeners) listener(changes, area);
    },
  };
}
