import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA, DEFAULT_WORKDAYS } from './schema.js';

/**
 * Membuka (dan membuat bila perlu) database SQLite, menjalankan schema,
 * lalu melakukan seed kalender kerja default (Senin-Jumat) bila kosong.
 */
export function createDatabase(dbPath?: string): DatabaseSync {
  const target = dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'app.db');

  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  }

  const db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const row = db.prepare('SELECT COUNT(*) AS c FROM workdays').get() as { c: number };
  if (row.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO workdays (dayOfWeek, isWorking) VALUES (?, ?)');
    for (const w of DEFAULT_WORKDAYS) insert.run(w.dayOfWeek, w.isWorking);
  }

  return db;
}
