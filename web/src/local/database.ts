import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';

export type Row = SqlValue[];

export interface LocalDatabase {
  run(sql: string, params?: SqlValue[]): void;
  all(sql: string, params?: SqlValue[]): Row[];
  transaction<T>(work: () => T): T;
}

export function sqliteDatabase(db: Database): LocalDatabase {
  return {
    run(sql, params = []) {
      db.exec({ sql, bind: params });
    },
    all(sql, params = []) {
      const rows: Row[] = [];
      db.exec({
        sql,
        bind: params,
        rowMode: 'array',
        callback: (row) => {
          rows.push(row);
        },
      });
      return rows;
    },
    transaction(work) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = work();
        db.exec('COMMIT');
        return result;
      } catch (cause) {
        db.exec('ROLLBACK');
        throw cause;
      }
    },
  };
}

// The schema mirrors the server's Note/Group models minus the user columns:
// every browser user gets a database file of their own.
export function migrate(db: LocalDatabase): void {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS note_groups (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, group_id)
    )
  `);
  db.run(
    'CREATE INDEX IF NOT EXISTS notes_created ON notes(created_at DESC, id DESC)',
  );
  db.run(
    'CREATE INDEX IF NOT EXISTS note_groups_by_group ON note_groups(group_id, note_id)',
  );
}
