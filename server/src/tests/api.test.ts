import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '../db.js';
import { createApp } from '../app.js';

let server: Server;
let base = '';

interface Res {
  status: number;
  data: Record<string, unknown> | Record<string, unknown>[] | null;
}

async function req(method: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: Res['data'] = null;
  try {
    data = (await res.json()) as Res['data'];
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const asObj = (r: Res): Record<string, unknown> => r.data as Record<string, unknown>;

beforeAll(async () => {
  const db = createDatabase(':memory:');
  const app = createApp(db);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('API integrasi', () => {
  let projectId = 0;
  let taskA = 0;
  let taskB = 0;
  let taskC = 0;
  let memberId = 0;

  it('GET /api/health', async () => {
    const r = await req('GET', '/api/health');
    expect(r.status).toBe(200);
    expect(asObj(r).status).toBe('ok');
  });

  it('menolak proyek tidak valid (400 + detail field)', async () => {
    const r = await req('POST', '/api/projects', { name: '', startDate: '2026-13-45' });
    expect(r.status).toBe(400);
    const details = asObj(r).details as unknown[];
    expect(details.length).toBeGreaterThanOrEqual(2);
  });

  it('membuat proyek (201)', async () => {
    const r = await req('POST', '/api/projects', {
      name: 'Proyek Integrasi',
      startDate: '2026-11-02',
      status: 'active',
    });
    expect(r.status).toBe(201);
    projectId = Number(asObj(r).id);
    expect(projectId).toBeGreaterThan(0);
  });

  it('membuat rantai tugas A -> B -> C + subtugas', async () => {
    const a = await req('POST', `/api/projects/${projectId}/tasks`, {
      name: 'A',
      startDate: '2026-11-02',
      duration: 3,
    });
    expect(a.status).toBe(201);
    taskA = Number(asObj(a).id);

    const b = await req('POST', `/api/projects/${projectId}/tasks`, { name: 'B', duration: 2 });
    expect(b.status).toBe(201);
    taskB = Number(asObj(b).id);

    const c = await req('POST', `/api/projects/${projectId}/tasks`, { name: 'C', duration: 1 });
    expect(c.status).toBe(201);
    taskC = Number(asObj(c).id);

    const sub = await req('POST', `/api/projects/${projectId}/tasks`, {
      name: 'Sub A',
      parentId: taskA,
      duration: 1,
    });
    expect(sub.status).toBe(201);
    expect(asObj(sub).parentId).toBe(taskA);

    // parent tidak valid
    const bad = await req('POST', `/api/projects/${projectId}/tasks`, { name: 'X', parentId: 99999 });
    expect(bad.status).toBe(404);

    // hierarki siklik
    const cyc = await req('PUT', `/api/tasks/${taskA}`, { parentId: Number(asObj(sub).id) });
    expect(cyc.status).toBe(400);
  });

  it('mengelola anggota & penugasan', async () => {
    const m = await req('POST', '/api/members', { name: 'QA Engineer', email: 'qa@mail.com', role: 'QA' });
    expect(m.status).toBe(201);
    memberId = Number(asObj(m).id);

    // invalid email
    const bad = await req('POST', '/api/members', { name: 'X', email: 'not-an-email' });
    expect(bad.status).toBe(400);

    const a1 = await req('POST', `/api/projects/${projectId}/members`, { memberId });
    expect(a1.status).toBe(201);
    const a2 = await req('POST', `/api/projects/${projectId}/members`, { memberId });
    expect(a2.status).toBe(201); // idempoten

    const up = await req('PUT', `/api/tasks/${taskB}`, { assigneeId: memberId });
    expect(up.status).toBe(200);
    expect(asObj(up).assigneeName).toBe('QA Engineer');

    // hapus anggota -> penugasan tugas dilepas otomatis
    const del = await req('DELETE', `/api/members/${memberId}`);
    expect(del.status).toBe(200);
    const after = await req('GET', `/api/tasks/${taskB}`);
    expect(asObj(after).assigneeId).toBeNull();
  });

  it('dependensi: duplikat, siklus, self ditolak; rantai diterima', async () => {
    const d1 = await req('POST', `/api/projects/${projectId}/dependencies`, {
      predecessorId: taskA,
      successorId: taskB,
      type: 'FS',
      lag: 0,
    });
    expect(d1.status).toBe(201);

    const dup = await req('POST', `/api/projects/${projectId}/dependencies`, {
      predecessorId: taskA,
      successorId: taskB,
    });
    expect(dup.status).toBe(409);

    const self = await req('POST', `/api/projects/${projectId}/dependencies`, {
      predecessorId: taskA,
      successorId: taskA,
    });
    expect(self.status).toBe(400);

    const d2 = await req('POST', `/api/projects/${projectId}/dependencies`, {
      predecessorId: taskB,
      successorId: taskC,
      type: 'FS',
    });
    expect(d2.status).toBe(201);

    // siklus 2 arah harus ditolak
    const cyc = await req('POST', `/api/projects/${projectId}/dependencies`, {
      predecessorId: taskB,
      successorId: taskA,
    });
    expect(cyc.status).toBe(409);
  });

  it('GET schedule menghitung ES/EF/LS/LF/float sesuai harapan', async () => {
    const r = await req('GET', `/api/projects/${projectId}/schedule`);
    expect(r.status).toBe(200);
    const data = asObj(r);
    expect(data.startDate).toBe('2026-11-02');
    expect(data.finishDate).toBe('2026-11-09');
    expect(data.projectDurationWorkdays).toBe(6);

    const tasks = data.tasks as Array<Record<string, unknown>>;
    const byName = new Map(tasks.map((t) => [String(t.name), t]));

    const a = byName.get('A')!;
    expect([a.es, a.ef, a.ls, a.lf]).toEqual(['2026-11-02', '2026-11-04', '2026-11-02', '2026-11-04']);
    expect(a.float).toBe(0);
    expect(a.critical).toBe(true);

    const b = byName.get('B')!;
    expect([b.es, b.ef]).toEqual(['2026-11-05', '2026-11-06']);
    expect(b.critical).toBe(true);

    const c = byName.get('C')!;
    expect([c.es, c.ef]).toEqual(['2026-11-09', '2026-11-09']);
    expect(c.critical).toBe(true);

    // subtugas bebas -> float positif
    const sub = byName.get('Sub A')!;
    expect(sub.critical).toBe(false);
    expect(Number(sub.float)).toBeGreaterThan(0);
  });

  it('GET pert menghitung TE = (O + 4M + P) / 6', async () => {
    const up = await req('PUT', `/api/tasks/${taskA}`, {
      optimisticDays: 2,
      mostLikelyDays: 4,
      pessimisticDays: 6,
    });
    expect(up.status).toBe(200);

    const r = await req('GET', `/api/projects/${projectId}/pert`);
    expect(r.status).toBe(200);
    const data = asObj(r);
    const tasks = data.tasks as Array<Record<string, unknown>>;
    const a = tasks.find((t) => t.name === 'A')!;
    expect(a.te).toBe(4);
    expect(a.sd).toBeCloseTo(0.67, 2);
    expect(a.variance).toBeCloseTo(0.44, 2);

    // validasi urutan estimasi
    const bad = await req('PUT', `/api/tasks/${taskA}`, { optimisticDays: 9, mostLikelyDays: 5 });
    expect(bad.status).toBe(400);
  });

  it('GET cpm menemukan jalur kritis A -> B -> C', async () => {
    const r = await req('GET', `/api/projects/${projectId}/cpm`);
    expect(r.status).toBe(200);
    const data = asObj(r);
    expect(data.projectDurationWorkdays).toBe(6);
    const paths = data.criticalPaths as Array<{ taskIds: number[]; taskNames: string[] }>;
    expect(paths).toHaveLength(1);
    expect(paths[0].taskNames).toEqual(['A', 'B', 'C']);
    const pert = data.pert as Record<string, unknown>;
    expect(pert.estimatedOnPath).toBe(1);
    expect(pert.teSum).toBe(4);
  });

  it('hari libur menggeser jadwal lalu dikembalikan', async () => {
    const add = await req('POST', '/api/calendar/holidays', { date: '2026-11-03', name: 'Libur Uji' });
    expect(add.status).toBe(201);
    const dup = await req('POST', '/api/calendar/holidays', { date: '2026-11-03', name: 'Duplikat' });
    expect(dup.status).toBe(409);

    const s1 = await req('GET', `/api/projects/${projectId}/schedule`);
    // A: 02 Nov + 3 hari kerja melewati libur 03 Nov -> EF 06 Nov; finish 10 Nov
    expect(asObj(s1).finishDate).toBe('2026-11-10');

    const holidaysRes = await req('GET', '/api/calendar/holidays');
    const holidays = holidaysRes.data as unknown as Array<Record<string, unknown>>;
    const id = Number(holidays[0].id);
    const del = await req('DELETE', `/api/calendar/holidays/${id}`);
    expect(del.status).toBe(200);

    const s2 = await req('GET', `/api/projects/${projectId}/schedule`);
    expect(asObj(s2).finishDate).toBe('2026-11-09');
  });

  it('validasi kalender: minimal satu hari kerja', async () => {
    const r = await req('PUT', '/api/calendar/workdays', { workdays: [] });
    expect(r.status).toBe(400);
    const ok = await req('PUT', '/api/calendar/workdays', { workdays: [1, 2, 3, 4, 5] });
    expect(ok.status).toBe(200);
  });

  it('dashboard meringkas proyek, tugas, tenggat mendekat & terlambat', async () => {
    // tugas dengan tenggat 3 hari dari hari ini -> masuk jendela 'mendekati tenggat'
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const p2 = (v: number) => String(v).padStart(2, '0');
    const iso = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const created = await req('POST', `/api/projects/${projectId}/tasks`, {
      name: 'Tugas Mendekat',
      duration: 1,
      dueDate: iso,
    });
    expect(created.status).toBe(201);

    const r = await req('GET', `/api/dashboard?projectId=${projectId}`);
    expect(r.status).toBe(200);
    const data = asObj(r);
    expect(data.projects).toMatchObject({ total: 1 });
    const tasks = data.tasks as Record<string, number>;
    expect(tasks.total).toBe(5); // A, B, C, Sub A, Tugas Mendekat
    expect(tasks.dueSoon).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.dueSoonTasks)).toBe(true);
    expect((data.dueSoonTasks as Array<Record<string, unknown>>).some((x) => x.name === 'Tugas Mendekat')).toBe(true);
    expect(Array.isArray(data.overdueTasks)).toBe(true);
    expect(Array.isArray((data as Record<string, unknown>).recentProjects)).toBe(true);
  });

  it('penanganan error: 404 endpoint, 404 entitas, JSON rusak 400', async () => {
    const e1 = await req('GET', '/api/tidak-ada');
    expect(e1.status).toBe(404);
    const e2 = await req('GET', '/api/projects/999999');
    expect(e2.status).toBe(404);
    const e3 = await req('GET', '/api/projects/999999/schedule');
    expect(e3.status).toBe(404);

    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{rusak-json',
    });
    expect(res.status).toBe(400);
  });

  it('delete proyek menghapus tugas & dependensi (cascade)', async () => {
    const p = await req('POST', '/api/projects', { name: 'Proyek Singkat', startDate: '2026-12-01' });
    const pid = Number(asObj(p).id);
    const t1 = await req('POST', `/api/projects/${pid}/tasks`, { name: 'Induk', duration: 2 });
    const t1id = Number(asObj(t1).id);
    await req('POST', `/api/projects/${pid}/tasks`, { name: 'Anak', parentId: t1id, duration: 1 });

    const before = await req('GET', `/api/projects/${pid}/tasks`);
    expect((before.data as unknown as unknown[]).length).toBe(2);

    const del = await req('DELETE', `/api/projects/${pid}`);
    expect(del.status).toBe(200);

    const after = await req('GET', `/api/projects/${pid}/tasks`);
    expect(after.status).toBe(404); // proyek sudah tidak ada, tugas ikut terhapus
  });
});
