// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { migrate, sqliteDatabase, type LocalDatabase } from './database';
import {
  createNote,
  deleteGroup,
  deleteNote,
  listGroups,
  listNotes,
  updateNote,
} from './notes-db';

let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>;
let raw: InstanceType<typeof sqlite3.oo1.DB>;
let db: LocalDatabase;

beforeEach(async () => {
  sqlite3 ??= await sqlite3InitModule();
  raw = new sqlite3.oo1.DB(':memory:');
  db = sqliteDatabase(raw);
  migrate(db);
});

afterEach(() => {
  raw.close();
});

describe('updateNote', () => {
  it('rewrites content and groups, keeps createdAt and drops orphans', () => {
    const note = createNote(db, 'buy coffee @home');

    const updated = updateNote(db, note.id, 'buy tea @work');

    expect(updated.content).toBe('buy tea');
    expect(updated.createdAt).toBe(note.createdAt);
    expect(updated.groups.map((group) => group.name)).toEqual(['work']);
    expect(listNotes(db, 'home')).toEqual([]);
    expect(listGroups(db).map((group) => group.name)).toEqual(['work']);
  });

  it('adds a new group while keeping the old one', () => {
    const note = createNote(db, 'buy coffee @home');

    const updated = updateNote(db, note.id, 'buy tea @home @work');

    expect(updated.groups.map((group) => group.name)).toEqual(['home', 'work']);
  });

  it('updates group counts', () => {
    createNote(db, 'one @home');
    const second = createNote(db, 'two @home');

    updateNote(db, second.id, 'moved @work');

    expect(listGroups(db).map(({ name, count }) => ({ name, count }))).toEqual([
      { name: 'home', count: 1 },
      { name: 'work', count: 1 },
    ]);
  });

  it('rejects an update without a group and keeps the note intact', () => {
    const note = createNote(db, 'buy coffee @home');

    expect(() => updateNote(db, note.id, 'buy tea')).toThrow(
      'Include at least one @group in the note',
    );
    expect(listNotes(db, 'home')).toEqual([note]);
  });

  it('rejects raw content over 10,000 characters', () => {
    const note = createNote(db, 'buy coffee @home');

    expect(() =>
      updateNote(db, note.id, `${'a'.repeat(10_000)} @home`),
    ).toThrow('content must be shorter than or equal to 10000 characters');
    expect(listNotes(db, 'home')).toEqual([note]);
  });

  it('rolls back when the write fails', () => {
    const note = createNote(db, 'buy coffee @home');
    const failing: LocalDatabase = {
      ...db,
      run(sql, params) {
        if (sql.startsWith('UPDATE notes')) {
          throw new Error('disk full');
        }
        db.run(sql, params);
      },
    };

    expect(() => updateNote(failing, note.id, 'buy tea @work')).toThrow(
      'disk full',
    );
    expect(listNotes(db, 'home')).toEqual([note]);
  });
});

describe('deleteNote', () => {
  it('removes the note and its orphaned group', () => {
    createNote(db, 'buy coffee @home');
    const keep = createNote(db, 'keep @work');

    const doomed = listNotes(db, 'home')[0]!;
    deleteNote(db, doomed.id);

    expect(listNotes(db, 'home')).toEqual([]);
    expect(listGroups(db).map((group) => group.name)).toEqual(['work']);
    expect(listNotes(db, 'work')).toEqual([keep]);
  });
});

describe('deleteGroup', () => {
  it('removes the group but keeps its notes', () => {
    const note = createNote(db, 'buy coffee @home @work');
    const home = listGroups(db).find((group) => group.name === 'home')!;

    deleteGroup(db, home.id);

    expect(listGroups(db).map((group) => group.name)).toEqual(['work']);
    const [remaining] = listNotes(db, 'work');
    expect(remaining!.id).toBe(note.id);
    expect(remaining!.content).toBe('buy coffee');
    expect(remaining!.groups.map((group) => group.name)).toEqual(['work']);
  });
});

describe('unknown ids', () => {
  it.each([
    [
      'update',
      () => updateNote(db, 'missing-note', 'text @home'),
      'Note not found',
    ],
    ['delete note', () => deleteNote(db, 'missing-note'), 'Note not found'],
    ['delete group', () => deleteGroup(db, 'missing-group'), 'Group not found'],
  ])('%s is rejected without writing', (_name, operation, message) => {
    createNote(db, 'buy coffee @home');

    expect(operation).toThrow(message);
    expect(listNotes(db, 'home')).toHaveLength(1);
    expect(listGroups(db).map((group) => group.name)).toEqual(['home']);
  });
});

describe('user isolation', () => {
  it('treats another database note id as not found', () => {
    const ana = createNote(db, 'ana note @home');

    const otherRaw = new sqlite3.oo1.DB(':memory:');
    const other = sqliteDatabase(otherRaw);
    migrate(other);
    try {
      expect(() => updateNote(other, ana.id, 'stolen @work')).toThrow(
        'Note not found',
      );
      expect(listNotes(db, 'home')[0]!.content).toBe('ana note');
    } finally {
      otherRaw.close();
    }
  });
});
