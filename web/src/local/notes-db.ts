import { parseNote } from '@flashnotes/core';
import type { LocalDatabase } from './database';
import { newId } from './ids';

export interface Group {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  groups: Group[];
}

export interface GroupWithCount extends Group {
  count: number;
}

interface ParsedNote {
  content: string;
  groupNames: string[];
}

// The demo starts from the same set in every browser: seven notes split across
// home (2), work (2) and ideas (3).
export const DEMO_NOTES = [
  'buy coffee @home',
  'call the dentist @home',
  'send the weekly report @work',
  'review the pull request @work',
  'read the article on note-taking @ideas',
  'sketch the landing page @ideas',
  'plan the launch @ideas',
];

const NOTE_COLUMNS = 'id, content, created_at';

// The same validation and messages the API applies, from the shared core.
function parse(raw: string): ParsedNote {
  const parsed = parseNote(raw);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed;
}

function ensureGroup(db: LocalDatabase, name: string): string {
  db.run(
    'INSERT INTO groups (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
    [newId(), name],
  );
  const [row] = db.all('SELECT id FROM groups WHERE name = ?', [name]);
  return String(row![0]);
}

function groupsForNotes(
  db: LocalDatabase,
  noteIds: string[],
): Map<string, Group[]> {
  const groups = new Map<string, Group[]>();
  for (const noteId of noteIds) {
    groups.set(noteId, []);
  }
  if (noteIds.length === 0) {
    return groups;
  }

  const placeholders = noteIds.map(() => '?').join(', ');
  const rows = db.all(
    `SELECT note_groups.note_id, groups.id, groups.name
     FROM note_groups
     JOIN groups ON groups.id = note_groups.group_id
     WHERE note_groups.note_id IN (${placeholders})
     ORDER BY groups.name ASC`,
    noteIds,
  );

  for (const row of rows) {
    const noteId = String(row[0]);
    groups.get(noteId)?.push({ id: String(row[1]), name: String(row[2]) });
  }

  return groups;
}

function readNote(db: LocalDatabase, id: string): Note | null {
  const [row] = db.all(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`, [id]);
  if (!row) {
    return null;
  }

  const noteId = String(row[0]);
  return {
    id: noteId,
    content: String(row[1]),
    createdAt: String(row[2]),
    groups: groupsForNotes(db, [noteId]).get(noteId) ?? [],
  };
}

function noteExists(db: LocalDatabase, id: string): boolean {
  return db.all('SELECT 1 FROM notes WHERE id = ?', [id]).length > 0;
}

function removeOrphanGroups(db: LocalDatabase): void {
  db.run(
    'DELETE FROM groups WHERE id NOT IN (SELECT DISTINCT group_id FROM note_groups)',
  );
}

function linkGroups(db: LocalDatabase, noteId: string, names: string[]): void {
  for (const name of names) {
    const groupId = ensureGroup(db, name);
    db.run('INSERT INTO note_groups (note_id, group_id) VALUES (?, ?)', [
      noteId,
      groupId,
    ]);
  }
}

export function createNote(db: LocalDatabase, raw: string): Note {
  const { content, groupNames } = parse(raw);

  return db.transaction(() => {
    const id = newId();
    const createdAt = new Date().toISOString();
    db.run('INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?)', [
      id,
      content,
      createdAt,
    ]);
    linkGroups(db, id, groupNames);

    return readNote(db, id)!;
  });
}

export function listNotes(db: LocalDatabase, group: string): Note[] {
  const rows = db.all(
    `SELECT notes.id, notes.content, notes.created_at
     FROM notes
     JOIN note_groups ON note_groups.note_id = notes.id
     JOIN groups ON groups.id = note_groups.group_id
     WHERE groups.name = ?
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [group.toLowerCase()],
  );

  const ids = rows.map((row) => String(row[0]));
  const groups = groupsForNotes(db, ids);

  return rows.map((row) => {
    const id = String(row[0]);
    return {
      id,
      content: String(row[1]),
      createdAt: String(row[2]),
      groups: groups.get(id) ?? [],
    };
  });
}

export function updateNote(
  db: LocalDatabase,
  noteId: string,
  raw: string,
): Note {
  const { content, groupNames } = parse(raw);

  return db.transaction(() => {
    if (!noteExists(db, noteId)) {
      throw new Error('Note not found');
    }

    db.run('UPDATE notes SET content = ? WHERE id = ?', [content, noteId]);
    db.run('DELETE FROM note_groups WHERE note_id = ?', [noteId]);
    linkGroups(db, noteId, groupNames);
    removeOrphanGroups(db);

    return readNote(db, noteId)!;
  });
}

export function deleteNote(db: LocalDatabase, noteId: string): void {
  db.transaction(() => {
    if (!noteExists(db, noteId)) {
      throw new Error('Note not found');
    }

    db.run('DELETE FROM note_groups WHERE note_id = ?', [noteId]);
    db.run('DELETE FROM notes WHERE id = ?', [noteId]);
    removeOrphanGroups(db);
  });
}

export function listGroups(db: LocalDatabase): GroupWithCount[] {
  const rows = db.all(
    `SELECT groups.id, groups.name, COUNT(note_groups.note_id) AS note_count
     FROM groups
     LEFT JOIN note_groups ON note_groups.group_id = groups.id
     GROUP BY groups.id, groups.name
     ORDER BY note_count DESC, groups.name ASC`,
  );

  return rows.map((row) => ({
    id: String(row[0]),
    name: String(row[1]),
    count: Number(row[2]),
  }));
}

export function clearAllData(db: LocalDatabase): void {
  db.transaction(() => {
    db.run('DELETE FROM note_groups');
    db.run('DELETE FROM notes');
    db.run('DELETE FROM groups');
  });
}

export function seedDemoData(db: LocalDatabase): void {
  clearAllData(db);
  for (const raw of DEMO_NOTES) {
    createNote(db, raw);
  }
}

export function deleteGroup(db: LocalDatabase, groupId: string): void {
  db.transaction(() => {
    if (db.all('SELECT 1 FROM groups WHERE id = ?', [groupId]).length === 0) {
      throw new Error('Group not found');
    }

    db.run('DELETE FROM note_groups WHERE group_id = ?', [groupId]);
    db.run('DELETE FROM groups WHERE id = ?', [groupId]);
  });
}
