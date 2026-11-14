import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerRequest, WorkerResponse } from './protocol';

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  listGroups: vi.fn(),
  deleteGroup: vi.fn(),
  migrate: vi.fn(),
  sqliteDatabase: vi.fn(() => ({ marker: 'database' })),
  installOpfsSAHPoolVfs: vi.fn(),
}));

vi.mock('@sqlite.org/sqlite-wasm', () => ({
  default: vi.fn(async () => ({
    installOpfsSAHPoolVfs: mocks.installOpfsSAHPoolVfs,
  })),
}));

// Stryker's sandbox cannot serve the real wasm asset through Vite's `?url`
// transform; the worker test only exercises dispatch, not wasm loading.
vi.mock('@sqlite.org/sqlite-wasm/sqlite3.wasm?url', () => ({
  default: 'sqlite3.wasm',
}));

vi.mock('./database', () => ({
  migrate: mocks.migrate,
  sqliteDatabase: mocks.sqliteDatabase,
}));

vi.mock('./notes-db', () => ({
  createNote: mocks.createNote,
  listNotes: mocks.listNotes,
  updateNote: mocks.updateNote,
  deleteNote: mocks.deleteNote,
  listGroups: mocks.listGroups,
  deleteGroup: mocks.deleteGroup,
}));

const posted: WorkerResponse[] = [];
let onmessage: (event: { data: WorkerRequest }) => void;

beforeEach(async () => {
  posted.length = 0;
  vi.clearAllMocks();
  mocks.installOpfsSAHPoolVfs.mockResolvedValue({
    OpfsSAHPoolDb: class {
      exec(): void {
        // no-op
      }
    },
  });

  vi.stubGlobal('postMessage', (message: WorkerResponse) => {
    posted.push(message);
  });
  vi.resetModules();
  await import('./sqlite-worker');
  onmessage = (self as unknown as { onmessage: typeof onmessage }).onmessage;
});

async function send(request: WorkerRequest) {
  onmessage({ data: request });
  await vi.waitFor(() => {
    expect(posted).toHaveLength(1);
  });
  return posted[0]!;
}

describe('sqlite worker', () => {
  it('creates a note for the requested user', async () => {
    const note = { id: 'note-1' };
    mocks.createNote.mockReturnValue(note);

    const response = await send({
      id: 1,
      userId: 'user-1',
      op: 'createNote',
      content: 'buy coffee @home',
    });

    expect(response).toEqual({ id: 1, ok: true, result: note });
    expect(mocks.sqliteDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.migrate).toHaveBeenCalledTimes(1);
    expect(mocks.createNote).toHaveBeenCalledWith(
      { marker: 'database' },
      'buy coffee @home',
    );
  });

  it.each([
    ['listNotes', { group: 'home' }, 'listNotes'],
    ['listGroups', {}, 'listGroups'],
    ['deleteNote', { noteId: 'note-1' }, 'deleteNote'],
    ['deleteGroup', { groupId: 'group-1' }, 'deleteGroup'],
    ['updateNote', { noteId: 'note-1', content: 'tea @work' }, 'updateNote'],
  ])('forwards %s to the local operations', async (op, extra, expected) => {
    const operations = {
      listNotes: mocks.listNotes,
      listGroups: mocks.listGroups,
      deleteNote: mocks.deleteNote,
      deleteGroup: mocks.deleteGroup,
      updateNote: mocks.updateNote,
    };
    operations[expected as keyof typeof operations].mockReturnValue('result');

    const response = await send({
      id: 2,
      userId: 'user-2',
      op,
      ...extra,
    } as WorkerRequest);

    expect(response).toMatchObject({ id: 2, ok: true });
    expect(operations[expected as keyof typeof operations]).toHaveBeenCalled();
  });
});

describe('sqlite worker errors', () => {
  it('reports operation errors back to the main thread', async () => {
    mocks.createNote.mockImplementation(() => {
      throw new Error('Note not found');
    });

    const response = await send({
      id: 3,
      userId: 'user-3',
      op: 'createNote',
      content: 'buy coffee @home',
    });

    expect(response).toEqual({ id: 3, ok: false, error: 'Note not found' });
  });

  it('reports a friendly error when the database cannot open', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.installOpfsSAHPoolVfs.mockRejectedValue(new Error('no OPFS'));

    const response = await send({
      id: 4,
      userId: 'user-4',
      op: 'listGroups',
    });

    expect(response).toEqual({
      id: 4,
      ok: false,
      error:
        'Local storage is unavailable. This browser cannot open the local notes database.',
    });
    logged.mockRestore();
  });

  it('stringifies a non-Error failure', async () => {
    mocks.listGroups.mockImplementation(() => {
      throw 'plain failure';
    });

    const response = await send({
      id: 5,
      userId: 'user-5',
      op: 'listGroups',
    });

    expect(response).toEqual({ id: 5, ok: false, error: 'plain failure' });
  });
});
