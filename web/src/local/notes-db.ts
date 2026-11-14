import { extractGroups, stripGroups } from '../lib/extract-groups';
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS_PER_NOTE,
  MAX_NOTE_LENGTH,
} from '../lib/note-limits';
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

const NOTE_COLUMNS = 'id, content, created_at';

// Same validation order and messages as api/src/notes/notes.service.ts.
function parseNote(raw: string): ParsedNote {
  if (raw.length > MAX_NOTE_LENGTH) {
    throw new Error(
      `content must be shorter than or equal to ${MAX_NOTE_LENGTH} characters`,
    );
  }

  const groupNames = extractGroups(raw);

  if (groupNames.length === 0) {
    throw new Error('Include at least one @group in the note');
  }
  if (groupNames.length > MAX_GROUPS_PER_NOTE) {
    throw new Error(
      `A note can reference at most ${MAX_GROUPS_PER_NOTE} groups`,
    );
  }
  if (groupNames.some((name) => name.length > MAX_GROUP_NAME_LENGTH)) {
    throw new Error(
      `Group names can have at most ${MAX_GROUP_NAME_LENGTH} characters`,
    );
  }

  const content = stripGroups(raw);

  if (content.length === 0) {
    throw new Error('The note needs text besides the @group');
  }

  return { content, groupNames };
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
  const { content, groupNames } = parseNote(raw);

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
  const { content, groupNames } = parseNote(raw);

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

export function deleteGroup(db: LocalDatabase, groupId: string): void {
  db.transaction(() => {
    if (db.all('SELECT 1 FROM groups WHERE id = ?', [groupId]).length === 0) {
      throw new Error('Group not found');
    }

    db.run('DELETE FROM note_groups WHERE group_id = ?', [groupId]);
    db.run('DELETE FROM groups WHERE id = ?', [groupId]);
  });
}
