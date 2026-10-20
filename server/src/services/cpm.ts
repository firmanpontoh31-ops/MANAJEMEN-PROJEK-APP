import { WorkingCalendar } from './calendar.js';
import { earliestStartFor, type ScheduleResult, type SchedDependency } from './scheduling.js';

export interface CriticalPath {
  taskIds: number[];
  taskNames: string[];
  /** Panjang jalur dalam hari kerja (dari ES tugas pertama sampai EF tugas terakhir). */
  lengthWorkdays: number;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

/**
 * Critical Path Analysis:
 * 1. Ambil tugas berfloat <= 0 (jalur kritis) dari hasil scheduleTasks.
 * 2. Tentukan edge "driving": constraint dependensi tepat menentukan ES successor.
 * 3. Telusuri mundur dari tugas kritis yang EF-nya = tanggal selesai proyek
 *    untuk membentuk jalur kritis (urutan eksekusi pertama -> terakhir).
 */
export function findCriticalPaths(
  result: ScheduleResult,
  deps: SchedDependency[],
  taskNames: Map<number, string>,
  cal: WorkingCalendar,
): CriticalPath[] {
  const critical = new Set(result.tasks.filter((t) => t.critical).map((t) => t.id));
  if (critical.size === 0) return [];

  // Edge driving: pred -> succ membatasi ES succ secara langsung
  const driving = new Map<number, number[]>();
  for (const d of deps) {
    if (!critical.has(d.predecessorId) || !critical.has(d.successorId)) continue;
    const p = result.byId.get(d.predecessorId);
    const s = result.byId.get(d.successorId);
    if (!p || !s) continue;
    const constraint = earliestStartFor(d.type, d.lag, p.es, p.ef, s.duration, cal);
    if (constraint === s.es) push(driving, d.successorId, d.predecessorId);
  }

  const terminals = result.tasks.filter((t) => t.critical && t.ef === result.finishDate);
  const paths: CriticalPath[] = [];
  const seen = new Set<string>();

  const record = (ids: number[]): void => {
    const key = ids.join('>');
    if (seen.has(key)) return;
    seen.add(key);
    const first = result.byId.get(ids[0])!;
    const last = result.byId.get(ids[ids.length - 1])!;
    paths.push({
      taskIds: ids,
      taskNames: ids.map((id) => taskNames.get(id) ?? `Tugas #${id}`),
      lengthWorkdays: cal.spanWorkdays(first.es, last.ef),
    });
  };

  // Telusuri mundur; chain disusun dari awal -> akhir
  const walk = (id: number, chain: number[]): void => {
    const preds = driving.get(id) ?? [];
    if (preds.length === 0) {
      record(chain);
      return;
    }
    for (const p of preds) walk(p, [p, ...chain]);
  };

  for (const t of terminals) walk(t.id, [t.id]);

  // Gagal total tidak mungkin terjadi selama ada tugas kritis; tetap sediakan fallback
  if (paths.length === 0) {
    for (const t of terminals) record([t.id]);
  }

  paths.sort((a, b) => {
    if (b.lengthWorkdays !== a.lengthWorkdays) return b.lengthWorkdays - a.lengthWorkdays;
    return a.taskIds[0] - b.taskIds[0];
  });
  return paths;
}
