import { WorkingCalendar } from './calendar.js';
import { topologicalOrder } from './graph.js';
import type { DependencyType } from '../types.js';

export interface SchedulableTask {
  id: number;
  name: string;
  startDate: string | null;
  duration: number;
}

export interface SchedDependency {
  predecessorId: number;
  successorId: number;
  type: DependencyType;
  lag: number;
}

export interface TaskSchedule {
  id: number;
  name: string;
  duration: number;
  baselineStart: string | null;
  /** Early Start: tanggal mulai tercepat (hari kerja). */
  es: string;
  /** Early Finish: tanggal selesai tercepat (hari kerja). */
  ef: string;
  /** Late Start: tanggal mulai terakhir tanpa menunda proyek. */
  ls: string;
  /** Late Finish: tanggal selesai terakhir tanpa menunda proyek. */
  lf: string;
  /** Total float dalam hari kerja (bisa negatif bila over-constrained). */
  float: number;
  critical: boolean;
}

export interface ScheduleResult {
  tasks: TaskSchedule[];
  byId: Map<number, TaskSchedule>;
  order: number[];
  startDate: string;
  finishDate: string;
  projectDurationWorkdays: number;
  warnings: string[];
}

/**
 * Batas waktu mulai paling awal bagi successor berdasarkan tipe dependensi.
 * Semua satuan hari kerja, lag bisa negatif.
 *  - FS: successor mulai setelah predecessor SELESAI  (+1 hari kerja + lag)
 *  - SS: successor mulai bersamaan dengan predecessor  (+lag)
 *  - FF: successor selesai bersamaan predecessor        (+lag)
 *  - SF: successor selesai bersamaan MULAI predecessor (+lag)
 */
export function earliestStartFor(
  type: DependencyType,
  lag: number,
  predEs: string,
  predEf: string,
  succDuration: number,
  cal: WorkingCalendar,
): string {
  switch (type) {
    case 'FS':
      return cal.shift(predEf, 1 + lag);
    case 'SS':
      return cal.shift(predEs, lag);
    case 'FF':
      return cal.shift(cal.shift(predEf, lag), -(succDuration - 1));
    case 'SF':
      return cal.shift(cal.shift(predEs, lag), -(succDuration - 1));
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

function maxOf(arr: string[]): string {
  let best = arr[0];
  for (const x of arr) if (x > best) best = x;
  return best;
}

function minOf(arr: string[]): string {
  let best = arr[0];
  for (const x of arr) if (x < best) best = x;
  return best;
}

/**
 * Perhitungan jadwal proyek:
 * 1. Forward pass  -> ES, EF (dengan kalender kerja + semua tipe dependensi + lag)
 * 2. Backward pass -> LS, LF (dibatasi tanggal selesai proyek)
 * 3. Total float = jumlah hari kerja di (ES, LS]; kritis bila float <= 0.
 *
 * Catatan: hierarki parent/subtugas TIDAK membuat constraint implisit;
 * setiap tugas (termasuk parent) dijadwalkan sebagai node sendiri.
 */
export function scheduleTasks(
  projectStart: string,
  tasks: SchedulableTask[],
  deps: SchedDependency[],
  cal: WorkingCalendar,
): ScheduleResult {
  const warnings: string[] = [];

  if (tasks.length === 0) {
    const start = cal.snapForward(projectStart);
    return {
      tasks: [],
      byId: new Map(),
      order: [],
      startDate: start,
      finishDate: start,
      projectDurationWorkdays: 0,
      warnings,
    };
  }

  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const usable = deps.filter((d) => byTask.has(d.predecessorId) && byTask.has(d.successorId));
  const order = topologicalOrder(
    tasks.map((t) => t.id),
    usable.map((d) => ({ from: d.predecessorId, to: d.successorId })),
  );

  const incoming = new Map<number, SchedDependency[]>();
  const outgoing = new Map<number, SchedDependency[]>();
  for (const d of usable) {
    push(incoming, d.successorId, d);
    push(outgoing, d.predecessorId, d);
  }

  // ---------- Forward pass ----------
  const es = new Map<number, string>();
  const ef = new Map<number, string>();
  const floorStart = cal.snapForward(projectStart);

  for (const id of order) {
    const t = byTask.get(id)!;
    const dur = Math.max(1, Math.round(t.duration));
    const candidates: string[] = [floorStart];
    if (t.startDate) candidates.push(cal.snapForward(t.startDate));
    for (const d of incoming.get(id) ?? []) {
      const pred = byTask.get(d.predecessorId)!;
      candidates.push(
        earliestStartFor(
          d.type,
          d.lag,
          es.get(pred.id)!,
          ef.get(pred.id)!,
          dur,
          cal,
        ),
      );
    }
    const start = maxOf(candidates);
    es.set(id, start);
    ef.set(id, cal.shift(start, dur - 1));
  }

  let startDate = es.get(order[0])!;
  let finishDate = ef.get(order[0])!;
  for (const id of order) {
    const s = es.get(id)!;
    const f = ef.get(id)!;
    if (s < startDate) startDate = s;
    if (f > finishDate) finishDate = f;
  }

  // ---------- Backward pass ----------
  const lf = new Map<number, string>();
  const ls = new Map<number, string>();

  for (const id of [...order].reverse()) {
    const t = byTask.get(id)!;
    const dur = Math.max(1, Math.round(t.duration));
    const candidates: string[] = [finishDate];
    for (const d of outgoing.get(id) ?? []) {
      const succ = byTask.get(d.successorId)!;
      const sEs = es.get(succ.id)!;
      const sLf = lf.get(succ.id)!;
      switch (d.type) {
        case 'FS':
          candidates.push(cal.shift(sEs, -(1 + d.lag)));
          break;
        case 'SS':
          candidates.push(cal.shift(cal.shift(sEs, -d.lag), dur - 1));
          break;
        case 'FF':
          candidates.push(cal.shift(sLf, -d.lag));
          break;
        case 'SF':
          candidates.push(cal.shift(cal.shift(sLf, -d.lag), dur - 1));
          break;
      }
    }
    const finish = minOf(candidates);
    lf.set(id, finish);
    ls.set(id, cal.shift(finish, -(dur - 1)));
  }

  // ---------- Float & jalur kritis ----------
  const resultTasks: TaskSchedule[] = [];
  const byId = new Map<number, TaskSchedule>();
  const sorted = [...order].sort((a, b) => (es.get(a)! < es.get(b)! ? -1 : es.get(a)! > es.get(b)! ? 1 : a - b));

  for (const id of sorted) {
    const t = byTask.get(id)!;
    const flt = cal.countWorkdays(es.get(id)!, ls.get(id)!);
    if (flt < 0) {
      warnings.push(
        `Tugas "${t.name}": tanggal mulai mandiri melewati batas ketergantungan (float ${flt} hari kerja)`,
      );
    }
    const ts: TaskSchedule = {
      id,
      name: t.name,
      duration: Math.max(1, Math.round(t.duration)),
      baselineStart: t.startDate,
      es: es.get(id)!,
      ef: ef.get(id)!,
      ls: ls.get(id)!,
      lf: lf.get(id)!,
      float: flt,
      critical: flt <= 0,
    };
    resultTasks.push(ts);
    byId.set(id, ts);
  }

  return {
    tasks: resultTasks,
    byId,
    order,
    startDate,
    finishDate,
    projectDurationWorkdays: cal.spanWorkdays(startDate, finishDate),
    warnings,
  };
}
