export type LocalOperation =
  | { op: 'createNote'; content: string }
  | { op: 'listNotes'; group: string }
  | { op: 'updateNote'; noteId: string; content: string }
  | { op: 'deleteNote'; noteId: string }
  | { op: 'listGroups' }
  | { op: 'deleteGroup'; groupId: string };

export const STORAGE_UNAVAILABLE =
  'Local storage is unavailable. This browser cannot open the local notes database.';

export type WorkerRequest = LocalOperation & { id: number; userId: string };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
