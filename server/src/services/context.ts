import type { DatabaseSync } from 'node:sqlite';
import { NotFoundError } from '../errors.js';
import { toProject, toTask, toDependency, toMember, type Project, type Task, type Dependency, type Member } from '../types.js';
import { WorkingCalendar } from './calendar.js';

export type Row = Record<string, unknown>;

/** Tanggal hari ini (waktu lokal) format YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getProject(db: DatabaseSync, id: number): Project {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new NotFoundError(`Proyek #${id} tidak ditemukan`);
  return toProject(row);
}

export function getMember(db: DatabaseSync, id: number): Member {
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new NotFoundError(`Anggota #${id} tidak ditemukan`);
  return toMember(row);
}

export function listTasks(db: DatabaseSync, projectId: number): Task[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE projectId = ? ORDER BY id')
    .all(projectId) as Row[];
  return rows.map(toTask);
}

export function listDependencies(db: DatabaseSync, projectId: number): Dependency[] {
  const rows = db
    .prepare('SELECT * FROM dependencies WHERE projectId = ? ORDER BY id')
    .all(projectId) as Row[];
  return rows.map(toDependency);
}

/** Ambil konfigurasi kalender kerja dari database lalu bangun WorkingCalendar. */
export function getCalendar(db: DatabaseSync): WorkingCalendar {
  const wdRows = db.prepare('SELECT dayOfWeek, isWorking FROM workdays').all() as Row[];
  const holRows = db.prepare('SELECT date FROM holidays ORDER BY date').all() as Row[];
  const workingDays: number[] = [];
  for (const r of wdRows) {
    if (Number(r.isWorking) === 1) workingDays.push(Number(r.dayOfWeek));
  }
  if (workingDays.length === 0) workingDays.push(1, 2, 3, 4, 5);
  return new WorkingCalendar({
    workingDays,
    holidays: holRows.map((r) => String(r.date)),
  });
}
