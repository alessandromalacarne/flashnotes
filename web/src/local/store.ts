import type { Group, GroupWithCount, Note } from './notes-db';
import type { LocalOperation, WorkerRequest, WorkerResponse } from './protocol';
import { STORAGE_UNAVAILABLE } from './protocol';

export type { Group, GroupWithCount, Note };

const SIGNED_OUT = 'No signed-in user for local notes.';

let currentUserId: string | null = null;
let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve(value: unknown): void; reject(reason: unknown): void }
>();

// Authentication stays server-side, so the auth provider tells the store which
// user's database to open.
export function setLocalUser(userId: string | null): void {
  currentUserId = userId;
}

function failAll(cause: unknown): void {
  for (const entry of pending.values()) {
    entry.reject(cause);
  }
  pending.clear();
}

function receive(event: MessageEvent<WorkerResponse>): void {
  const response = event.data;
  const entry = pending.get(response.id);
  if (!entry) {
    return;
  }

  pending.delete(response.id);
  if (response.ok) {
    entry.resolve(response.result);
  } else {
    entry.reject(new Error(response.error));
  }
}

function getWorker(): Worker {
  if (worker) {
    return worker;
  }

  try {
    const created = new Worker(new URL('./sqlite-worker.ts', import.meta.url), {
      type: 'module',
    });
    created.onmessage = receive;
    created.onerror = () => {
      failAll(new Error(STORAGE_UNAVAILABLE));
      worker = null;
    };
    worker = created;
    return created;
  } catch {
    throw new Error(STORAGE_UNAVAILABLE);
  }
}

function call<T>(operation: LocalOperation): Promise<T> {
  const userId = currentUserId;
  if (!userId) {
    return Promise.reject(new Error(SIGNED_OUT));
  }

  let active: Worker;
  try {
    active = getWorker();
  } catch (cause) {
    return Promise.reject(cause);
  }

  return new Promise<T>((resolve, reject) => {
    const id = nextRequestId;
    nextRequestId += 1;
    pending.set(id, { resolve: (value) => resolve(value as T), reject });

    try {
      const request: WorkerRequest = { ...operation, id, userId };
      active.postMessage(request);
    } catch {
      pending.delete(id);
      worker = null;
      reject(new Error(STORAGE_UNAVAILABLE));
    }
  });
}

export function createNote(content: string): Promise<Note> {
  return call({ op: 'createNote', content });
}

export function listNotes(group: string): Promise<Note[]> {
  return call({ op: 'listNotes', group });
}

export function updateNote(noteId: string, content: string): Promise<Note> {
  return call({ op: 'updateNote', noteId, content });
}

export function deleteNote(noteId: string): Promise<void> {
  return call({ op: 'deleteNote', noteId });
}

export function listGroups(): Promise<GroupWithCount[]> {
  return call({ op: 'listGroups' });
}

export function deleteGroup(groupId: string): Promise<void> {
  return call({ op: 'deleteGroup', groupId });
}
