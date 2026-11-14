import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerRequest, WorkerResponse } from './protocol';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly posted: WorkerRequest[] = [];
  readonly url: URL;
  readonly options: WorkerOptions;
  failPost = false;

  constructor(url: URL, options: WorkerOptions) {
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerRequest): void {
    if (this.failPost) {
      throw new Error('posting failed');
    }
    this.posted.push(message);
  }

  respond(response: WorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>);
  }

  crash(): void {
    this.onerror?.(new Event('error'));
  }
}

async function loadStore() {
  return import('./store');
}

beforeEach(() => {
  vi.resetModules();
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('setLocalUser', () => {
  it('rejects operations while nobody is signed in', async () => {
    const store = await loadStore();

    await expect(store.createNote('buy coffee @home')).rejects.toThrow(
      'No signed-in user for local notes.',
    );
  });
});

describe('worker requests', () => {
  it('sends createNote for the signed-in user and resolves the result', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');
    const note = {
      id: 'note-1',
      content: 'buy coffee',
      createdAt: '2026-01-01T00:00:00.000Z',
      groups: [{ id: 'group-1', name: 'home' }],
    };

    const pending = store.createNote('buy coffee @home');

    const worker = FakeWorker.instances[0]!;
    expect(worker.posted).toEqual([
      {
        id: 1,
        userId: 'user-1',
        op: 'createNote',
        content: 'buy coffee @home',
      },
    ]);

    worker.respond({ id: 1, ok: true, result: note });
    await expect(pending).resolves.toEqual(note);
  });
});

describe('worker forwarding', () => {
  it.each([
    [
      'listNotes',
      (store: Awaited<ReturnType<typeof loadStore>>) => store.listNotes('home'),
      'listNotes',
    ],
    [
      'listGroups',
      (store: Awaited<ReturnType<typeof loadStore>>) => store.listGroups(),
      'listGroups',
    ],
    [
      'deleteNote',
      (store: Awaited<ReturnType<typeof loadStore>>) =>
        store.deleteNote('note-1'),
      'deleteNote',
    ],
    [
      'deleteGroup',
      (store: Awaited<ReturnType<typeof loadStore>>) =>
        store.deleteGroup('group-1'),
      'deleteGroup',
    ],
    [
      'updateNote',
      (store: Awaited<ReturnType<typeof loadStore>>) =>
        store.updateNote('note-1', 'tea @work'),
      'updateNote',
    ],
  ])('forwards %s to the worker', async (_name, run, operation) => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    const pending = run(store);
    const worker = FakeWorker.instances[0]!;
    expect(worker.posted[0]!.op).toBe(operation);

    worker.respond({ id: worker.posted[0]!.id, ok: true, result: [] });
    await pending;
  });
});

describe('worker responses', () => {
  it('rejects with the error the worker reports', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    const pending = store.updateNote('missing', 'tea @work');
    const worker = FakeWorker.instances[0]!;
    worker.respond({
      id: worker.posted[0]!.id,
      ok: false,
      error: 'Note not found',
    });

    await expect(pending).rejects.toThrow('Note not found');
  });

  it('reuses one worker for later operations', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    const first = store.listGroups();
    FakeWorker.instances[0]!.respond({
      id: FakeWorker.instances[0]!.posted[0]!.id,
      ok: true,
      result: [],
    });
    await first;

    const second = store.listGroups();
    FakeWorker.instances[0]!.respond({
      id: FakeWorker.instances[0]!.posted[1]!.id,
      ok: true,
      result: [],
    });
    await second;

    expect(FakeWorker.instances).toHaveLength(1);
  });
});

describe('worker failures', () => {
  it('rejects every pending operation when the worker crashes', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    const pending = store.createNote('buy coffee @home');
    FakeWorker.instances[0]!.crash();

    await expect(pending).rejects.toThrow('Local storage is unavailable');
  });

  it('starts a fresh worker after a crash', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    store.createNote('buy coffee @home').catch(() => undefined);
    FakeWorker.instances[0]!.crash();

    store.listGroups().catch(() => undefined);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('rejects when the browser cannot start a worker', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('no workers here');
        }
      },
    );
    const store = await loadStore();
    store.setLocalUser('user-1');

    await expect(store.listGroups()).rejects.toThrow(
      'Local storage is unavailable',
    );
  });

  it('rejects when posting to the worker fails', async () => {
    const store = await loadStore();
    store.setLocalUser('user-1');

    const first = store.listGroups();
    const worker = FakeWorker.instances[0]!;
    worker.respond({ id: worker.posted[0]!.id, ok: true, result: [] });
    await first;

    worker.failPost = true;
    await expect(store.listGroups()).rejects.toThrow(
      'Local storage is unavailable',
    );
  });
});
