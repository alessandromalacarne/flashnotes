import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import wasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import { migrate, sqliteDatabase, type LocalDatabase } from './database';
import {
  createNote,
  deleteGroup,
  deleteNote,
  listGroups,
  listNotes,
  updateNote,
} from './notes-db';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { STORAGE_UNAVAILABLE } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

let sqlite: Promise<Sqlite3Static> | null = null;
const databases = new Map<string, Promise<LocalDatabase>>();

function loadSqlite(): Promise<Sqlite3Static> {
  sqlite ??= (
    sqlite3InitModule as (options?: {
      locateFile?: (file: string) => string;
    }) => Promise<Sqlite3Static>
  )({ locateFile: () => wasmUrl });
  return sqlite;
}

function segment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function openDatabase(userId: string): Promise<LocalDatabase> {
  try {
    const module = await loadSqlite();
    const pool = await module.installOpfsSAHPoolVfs({
      name: `flashnotes-${segment(userId)}`,
      directory: `.flashnotes/${segment(userId)}`,
    });
    const local = sqliteDatabase(new pool.OpfsSAHPoolDb('notes.sqlite3'));
    migrate(local);
    return local;
  } catch (cause) {
    console.error('Could not open the local notes database', cause);
    throw new Error(STORAGE_UNAVAILABLE);
  }
}

function databaseFor(userId: string): Promise<LocalDatabase> {
  let opening = databases.get(userId);
  if (!opening) {
    opening = openDatabase(userId);
    databases.set(userId, opening);
  }
  return opening;
}

async function handle(request: WorkerRequest): Promise<unknown> {
  const db = await databaseFor(request.userId);

  switch (request.op) {
    case 'createNote':
      return createNote(db, request.content);
    case 'listNotes':
      return listNotes(db, request.group);
    case 'updateNote':
      return updateNote(db, request.noteId, request.content);
    case 'deleteNote':
      deleteNote(db, request.noteId);
      return undefined;
    case 'listGroups':
      return listGroups(db);
    case 'deleteGroup':
      deleteGroup(db, request.groupId);
      return undefined;
  }
}

function failure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

scope.onmessage = (event) => {
  const request = event.data;

  handle(request)
    .then((result) => {
      scope.postMessage({ id: request.id, ok: true, result });
    })
    .catch((cause: unknown) => {
      scope.postMessage({ id: request.id, ok: false, error: failure(cause) });
    });
};
