// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { migrate, sqliteDatabase, type LocalDatabase } from './database';
import { createNote, listGroups, listNotes } from './notes-db';

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

function noteIds(group: string): string[] {
  return listNotes(db, group).map((note) => note.id);
}

describe('createNote', () => {
  it('strips trailing markers and links the groups', () => {
    const note = createNote(db, 'buy coffee @home');

    expect(note.content).toBe('buy coffee');
    expect(note.groups.map((group) => group.name)).toEqual(['home']);
    expect(listNotes(db, 'home')).toEqual([note]);
  });

  it('lowercases and deduplicates group names', () => {
    const note = createNote(db, 'buy coffee @HOME @home @Work');

    expect(note.groups.map((group) => group.name)).toEqual(['home', 'work']);
  });

  it('accepts markers on their own trailing lines', () => {
    const note = createNote(db, 'buy coffee\n@home\n@work');

    expect(note.content).toBe('buy coffee');
    expect(note.groups.map((group) => group.name)).toEqual(['home', 'work']);
  });

  it('accepts accented names', () => {
    const note = createNote(db, 'buy coffee @café');

    expect(note.groups.map((group) => group.name)).toEqual(['café']);
  });
});

describe('createNote validation', () => {
  it.each([
    ['buy coffee', 'Include at least one @group in the note'],
    ['@home buy coffee', 'Include at least one @group in the note'],
    ['buy coffee @home now', 'Include at least one @group in the note'],
    ['buy coffee @home, please', 'Include at least one @group in the note'],
    ['@home', 'The note needs text besides the @group'],
  ])('rejects %j and writes nothing', (raw, message) => {
    expect(() => createNote(db, raw)).toThrow(message);
    expect(listGroups(db)).toEqual([]);
  });

  it('rejects 33 groups and writes nothing', () => {
    const groups = Array.from({ length: 33 }, (_, index) => `@g${index}`);
    const raw = `text ${groups.join(' ')}`;

    expect(() => createNote(db, raw)).toThrow(
      'A note can reference at most 32 groups',
    );
    expect(listGroups(db)).toEqual([]);
  });

  it('accepts exactly 32 groups', () => {
    const groups = Array.from({ length: 32 }, (_, index) => `@g${index}`);
    const note = createNote(db, `text ${groups.join(' ')}`);

    expect(note.groups).toHaveLength(32);
  });

  it('rejects a 73-character group name', () => {
    const name = 'g'.repeat(73);

    expect(() => createNote(db, `text @${name}`)).toThrow(
      'Group names can have at most 72 characters',
    );
    expect(listGroups(db)).toEqual([]);
  });

  it('accepts a 72-character group name', () => {
    const name = 'g'.repeat(72);
    const note = createNote(db, `text @${name}`);

    expect(note.groups[0]!.name).toBe(name);
  });

  it('rejects raw content over 10,000 characters', () => {
    const raw = `${'a'.repeat(10_000)} @home`;

    expect(() => createNote(db, raw)).toThrow(
      'content must be shorter than or equal to 10000 characters',
    );
    expect(listGroups(db)).toEqual([]);
  });
});

describe('listNotes', () => {
  it('lists only the group, newest first', () => {
    db.run(
      'INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      [
        'older',
        'older',
        '2026-01-01T10:00:00.000Z',
        'newer',
        'newer',
        '2026-01-02T10:00:00.000Z',
        'other',
        'other',
        '2026-01-03T10:00:00.000Z',
      ],
    );
    db.run('INSERT INTO groups (id, name) VALUES (?, ?), (?, ?)', [
      'home',
      'home',
      'work',
      'work',
    ]);
    db.run(
      'INSERT INTO note_groups (note_id, group_id) VALUES (?, ?), (?, ?), (?, ?)',
      ['older', 'home', 'newer', 'home', 'other', 'work'],
    );

    expect(noteIds('home')).toEqual(['newer', 'older']);
  });

  it('matches the group ignoring case', () => {
    createNote(db, 'buy coffee @home');

    expect(noteIds('Home')).toHaveLength(1);
  });

  it('orders notes with the same createdAt by id descending', () => {
    db.run(
      'INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?), (?, ?, ?)',
      [
        'note-a',
        'a',
        '2026-01-01T00:00:00.000Z',
        'note-z',
        'z',
        '2026-01-01T00:00:00.000Z',
      ],
    );
    db.run('INSERT INTO groups (id, name) VALUES (?, ?)', ['home', 'home']);
    db.run(
      'INSERT INTO note_groups (note_id, group_id) VALUES (?, ?), (?, ?)',
      ['note-a', 'home', 'note-z', 'home'],
    );

    expect(noteIds('home')).toEqual(['note-z', 'note-a']);
  });
});

describe('listNotes group links', () => {
  it('returns every group of a note that carries several', () => {
    const note = createNote(db, 'shared @home @work');

    expect(listNotes(db, 'home')[0]!.groups.map((g) => g.name)).toEqual([
      'home',
      'work',
    ]);
    expect(listNotes(db, 'work')[0]!.groups.map((g) => g.name)).toEqual([
      'home',
      'work',
    ]);
    expect(note.groups).toHaveLength(2);
  });
});

describe('listGroups', () => {
  it('orders by note count, then name', () => {
    createNote(db, 'one @home');
    createNote(db, 'two @home');
    createNote(db, 'three @home');
    createNote(db, 'four @work');
    createNote(db, 'five @blog');

    expect(listGroups(db).map(({ name, count }) => ({ name, count }))).toEqual([
      { name: 'home', count: 3 },
      { name: 'blog', count: 1 },
      { name: 'work', count: 1 },
    ]);
  });
});
