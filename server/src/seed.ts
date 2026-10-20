/**
 * Seed data contoh.
 * Membuat ulang file database (data/app.db) dengan data demo yang rapi:
 * 3 anggota, 2 proyek, WBS bertingkat, dependensi FS/SS/FF + lag, hari libur.
 *
 * Jalankan:  npm run seed   (dari root; server harus DIHENTIKAN dulu di Windows
 * karena file database dikunci saat dibuka proses server).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createDatabase } from './db.js';

const target = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'app.db');
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`${target}${suffix}`, { force: true });
}
console.log(`[seed] Database lama dihapus: ${target}`);

const db = createDatabase();

const insertMember = db.prepare('INSERT INTO members (name, email, role) VALUES (?, ?, ?)');
const budi = Number(insertMember.run('Budi Santoso', 'budi@mail.com', 'Frontend Developer').lastInsertRowid);
const siti = Number(insertMember.run('Siti Aminah', 'siti@mail.com', 'Backend Developer').lastInsertRowid);
const andi = Number(insertMember.run('Andi Wijaya', 'andi@mail.com', 'QA Engineer').lastInsertRowid);

const insertProject = db.prepare('INSERT INTO projects (name, description, startDate, status) VALUES (?, ?, ?, ?)');
const p1 = Number(
  insertProject.run(
    'Sistem Informasi Akademik',
    'Perencanaan & penjadwalan pengembangan sistem akademik kampus. Data demo menampilkan Gantt, Network, PERT, dan CPM.',
    '2026-11-02',
    'active',
  ).lastInsertRowid,
);
const p2 = Number(
  insertProject.run(
    'Aplikasi Absensi Mobile',
    'Proyek sekunder untuk menampilkan ringkasan multi-proyek pada dashboard.',
    '2026-12-01',
    'planning',
  ).lastInsertRowid,
);

const assign = db.prepare('INSERT OR IGNORE INTO project_members (projectId, memberId) VALUES (?, ?)');
for (const m of [budi, siti, andi]) assign.run(p1, m);
assign.run(p2, budi);

interface SeedTask {
  key: string;
  parent?: string;
  name: string;
  duration: number;
  start?: string | null;
  due?: string | null;
  status?: string;
  priority?: string;
  progress?: number;
  assignee?: number | null;
  o?: number | null;
  m?: number | null;
  p?: number | null;
  desc?: string;
}

const tasks: SeedTask[] = [
  { key: 're', name: 'Analisis Kebutuhan', duration: 5, start: '2026-11-02', status: 'done', priority: 'high', progress: 100, assignee: siti, o: 3, m: 5, p: 8, desc: 'Wawancara stakeholder & analisis kebutuhan fungsional' },
  { key: 're1', parent: 're', name: 'Wawancara Pengguna', duration: 2, start: '2026-11-02', status: 'done', progress: 100, assignee: andi },
  { key: 're2', parent: 're', name: 'Dokumen Requirement', duration: 3, status: 'done', progress: 100, assignee: siti, o: 2, m: 3, p: 5 },
  { key: 'des', name: 'Desain Sistem', duration: 4, status: 'in_progress', priority: 'high', progress: 60, assignee: budi, o: 2, m: 4, p: 7, desc: 'Arsitektur, ERD, dan desain antarmuka' },
  { key: 'des1', parent: 'des', name: 'ERD & Diagram Alur', duration: 2, status: 'in_progress', progress: 75, assignee: budi },
  { key: 'des2', parent: 'des', name: 'Desain UI/UX', duration: 2, status: 'in_progress', progress: 40, assignee: budi },
  { key: 'imp', name: 'Implementasi', duration: 8, status: 'todo', priority: 'critical', assignee: siti, o: 6, m: 8, p: 14 },
  { key: 'imp1', parent: 'imp', name: 'Modul Akademik', duration: 5, status: 'todo', assignee: siti },
  { key: 'imp2', parent: 'imp', name: 'Modul Presensi', duration: 3, status: 'todo', assignee: budi },
  { key: 'test', name: 'Pengujian', duration: 4, status: 'todo', priority: 'high', assignee: andi, o: 2, m: 4, p: 7 },
  { key: 'deploy', name: 'Deployment', duration: 2, status: 'todo', assignee: budi, o: 1, m: 2, p: 4 },
  { key: 'ci', name: 'Setup Repository & CI', duration: 2, start: '2026-10-13', due: '2026-10-15', status: 'todo', priority: 'medium', assignee: budi, desc: 'Tugas contoh terlambat (tenggat sudah lewat)' },
];

const insertTask = db.prepare(
  `INSERT INTO tasks (projectId, parentId, name, description, startDate, duration, dueDate, status, priority, progress, assigneeId, optimisticDays, mostLikelyDays, pessimisticDays)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const ids = new Map<string, number>();
for (const t of tasks) {
  const info = insertTask.run(
    p1,
    t.parent ? ids.get(t.parent) ?? null : null,
    t.name,
    t.desc ?? '',
    t.start ?? null,
    t.duration,
    t.due ?? null,
    t.status ?? 'todo',
    t.priority ?? 'medium',
    t.progress ?? 0,
    t.assignee ?? null,
    t.o ?? null,
    t.m ?? null,
    t.p ?? null,
  );
  ids.set(t.key, Number(info.lastInsertRowid));
}

const insertDep = db.prepare(
  'INSERT INTO dependencies (projectId, predecessorId, successorId, type, lag) VALUES (?, ?, ?, ?, ?)',
);
const tid = (key: string): number => {
  const v = ids.get(key);
  if (v == null) throw new Error(`Key tugas tidak ditemukan: ${key}`);
  return v;
};
// Rantai utama: Analisis -> Desain -> Implementasi (SS+lag) -> Pengujian -> Deploy
insertDep.run(p1, tid('re'), tid('des'), 'FS', 0);
insertDep.run(p1, tid('des'), tid('imp'), 'FS', 0);
insertDep.run(p1, tid('imp'), tid('test'), 'SS', 4); // pengujian mulai 4 hari kerja setelah implementasi mulai
insertDep.run(p1, tid('test'), tid('deploy'), 'FS', 0);
// FF: Desain UI selesai tidak sebelum Desain Sistem selesai
insertDep.run(p1, tid('des'), tid('des2'), 'FF', 0);

// Proyek 2 (sederhana, tanpa dependensi)
const t2a = Number(insertTask.run(p2, null, 'Penentuan Kebutuhan', '', '2026-12-01', 3, null, 'todo', 'medium', 0, budi, null, null, null).lastInsertRowid);
insertTask.run(p2, null, 'Prototype', '', null, 4, null, 'todo', 'low', 0, budi, null, null, null);
insertDep.run(p2, t2a, t2a + 1, 'FS', 0);

db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run('2026-11-17', 'Hari Libur Nasional (contoh)');

const counts = {
  projects: (db.prepare('SELECT COUNT(*) c FROM projects').get() as { c: number }).c,
  members: (db.prepare('SELECT COUNT(*) c FROM members').get() as { c: number }).c,
  tasks: (db.prepare('SELECT COUNT(*) c FROM tasks').get() as { c: number }).c,
  dependencies: (db.prepare('SELECT COUNT(*) c FROM dependencies').get() as { c: number }).c,
  holidays: (db.prepare('SELECT COUNT(*) c FROM holidays').get() as { c: number }).c,
};
console.log('[seed] Selesai:', JSON.stringify(counts));
db.close();
