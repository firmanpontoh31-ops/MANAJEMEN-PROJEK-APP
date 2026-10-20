import { describe, expect, it } from 'vitest';
import { WorkingCalendar } from '../services/calendar.js';
import {
  earliestStartFor,
  scheduleTasks,
  type SchedDependency,
  type SchedulableTask,
} from '../services/scheduling.js';
import { findCriticalPaths } from '../services/cpm.js';
import { hasCycle, topologicalOrder } from '../services/graph.js';
import { ConflictError } from '../errors.js';

const cal = new WorkingCalendar({ workingDays: [1, 2, 3, 4, 5], holidays: [] });

describe('earliestStartFor (4 tipe dependensi + lag)', () => {
  // Pred: ES 2026-11-02 (Senin), EF 2026-11-06 (Jumat), succ durasi 3
  const es = '2026-11-02';
  const ef = '2026-11-06';

  it('FS: successor mulai setelah predecessor selesai + lag', () => {
    expect(earliestStartFor('FS', 0, es, ef, 3, cal)).toBe('2026-11-09'); // Jumat+1 = Senin
    expect(earliestStartFor('FS', 2, es, ef, 3, cal)).toBe('2026-11-11'); // +3 hari kerja
  });

  it('SS: successor mulai bersamaan + lag', () => {
    expect(earliestStartFor('SS', 0, es, ef, 3, cal)).toBe('2026-11-02');
    expect(earliestStartFor('SS', 2, es, ef, 3, cal)).toBe('2026-11-04');
  });

  it('FF: successor selesai bersamaan + lag (dikonversi ke ES)', () => {
    // EF_succ = EF_pred + lag = 06 Nov; ES = mundur (dur-1)=2 hari kerja -> 04 Nov
    expect(earliestStartFor('FF', 0, es, ef, 3, cal)).toBe('2026-11-04');
  });

  it('SF: successor selesai bersamaan mulai predecessor + lag', () => {
    // EF_succ = ES_pred = 02 Nov; ES = mundur 1 hari kerja -> 30 Okt (Jumat)
    expect(earliestStartFor('SF', 0, es, ef, 2, cal)).toBe('2026-10-30');
  });
});

describe('scheduleTasks — forward pass', () => {
  it('rantai FS: ES/EF mengikuti urutan dependensi dan hari kerja', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: null, duration: 2 },
    ];
    const deps: SchedDependency[] = [{ predecessorId: 1, successorId: 2, type: 'FS', lag: 0 }];
    const r = scheduleTasks('2026-11-02', tasks, deps, cal);

    const a = r.byId.get(1)!;
    const b = r.byId.get(2)!;
    expect([a.es, a.ef]).toEqual(['2026-11-02', '2026-11-04']);
    expect([b.es, b.ef]).toEqual(['2026-11-05', '2026-11-06']); // mulai hari kerja setelah EF A
    expect(r.startDate).toBe('2026-11-02');
    expect(r.finishDate).toBe('2026-11-06');
    expect(r.projectDurationWorkdays).toBe(5);
  });

  it('lag FS 2 hari kerja menundakan successor', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: null, duration: 2 },
    ];
    const deps: SchedDependency[] = [{ predecessorId: 1, successorId: 2, type: 'FS', lag: 2 }];
    const b = scheduleTasks('2026-11-02', tasks, deps, cal).byId.get(2)!;
    expect(b.es).toBe('2026-11-09'); // 04 Nov + 1 + 2 hari kerja
    expect(b.ef).toBe('2026-11-10');
  });

  it('tanggal mulai mandiri menjadi floor, bukan mengabaikan dependensi', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: '2026-11-20', duration: 1 },
    ];
    const deps: SchedDependency[] = [{ predecessorId: 1, successorId: 2, type: 'FS', lag: 0 }];
    const b = scheduleTasks('2026-11-02', tasks, deps, cal).byId.get(2)!;
    expect(b.es).toBe('2026-11-20'); // floor mandiri lebih akhir dari constraint dependensi
  });
});

describe('scheduleTasks — backward pass, float, kritis', () => {
  it('tugas terakhir kritis, tugas bebas punya float positif', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: null, duration: 2 },
    ];
    const r = scheduleTasks('2026-11-02', tasks, [], cal);
    const a = r.byId.get(1)!;
    const b = r.byId.get(2)!;

    // A menentukan finish (11-04) -> float 0
    expect(a.lf).toBe('2026-11-04');
    expect(a.ls).toBe('2026-11-02');
    expect(a.float).toBe(0);
    expect(a.critical).toBe(true);

    // B bebas: LF = finish, LS = 11-03, float = 1 hari kerja
    expect(b.lf).toBe('2026-11-04');
    expect(b.ls).toBe('2026-11-03');
    expect(b.float).toBe(1);
    expect(b.critical).toBe(false);
  });

  it('LS/LF dari predecessor mengikuti constraint successor (FS)', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 5 },
      { id: 2, name: 'B', startDate: null, duration: 1 },
    ];
    const deps: SchedDependency[] = [{ predecessorId: 1, successorId: 2, type: 'FS', lag: 0 }];
    const r = scheduleTasks('2026-11-02', tasks, deps, cal);
    const a = r.byId.get(1)!;
    // B: ES 09 Nov (setelah EF A 06 Nov), EF 09 Nov; LF_A = 09 Nov - 1 = 06 Nov
    expect(a.ef).toBe('2026-11-06');
    expect(a.lf).toBe('2026-11-06');
    expect(a.float).toBe(0);
  });

  it('proyek tanpa tugas tidak melempar error', () => {
    const r = scheduleTasks('2026-11-02', [], [], cal);
    expect(r.tasks).toHaveLength(0);
    expect(r.projectDurationWorkdays).toBe(0);
    expect(r.startDate).toBe('2026-11-02');
  });

  it('dependensi siklik ditolak dengan ConflictError berisi id terlibat', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: null, duration: 1 },
      { id: 2, name: 'B', startDate: null, duration: 1 },
    ];
    const deps: SchedDependency[] = [
      { predecessorId: 1, successorId: 2, type: 'FS', lag: 0 },
      { predecessorId: 2, successorId: 1, type: 'FS', lag: 0 },
    ];
    try {
      scheduleTasks('2026-11-02', tasks, deps, cal);
      throw new Error('seharusnya melempar');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect((e as ConflictError).details).toMatchObject({ taskIds: [1, 2] });
    }
  });
});

describe('graph topologi', () => {
  it('mengurutkan DAG secara topologis', () => {
    expect(topologicalOrder([3, 1, 2], [{ from: 1, to: 2 }, { from: 2, to: 3 }])).toEqual([1, 2, 3]);
  });

  it('mendeteksi siklus', () => {
    expect(hasCycle([1, 2], [{ from: 1, to: 2 }])).toBe(false);
    expect(hasCycle([1, 2], [{ from: 1, to: 2 }, { from: 2, to: 1 }])).toBe(true);
  });
});

describe('findCriticalPaths (CPM)', () => {
  it('menemukan jalur kritis tunggal dan mengabaikan tugas bebas', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: null, duration: 2 },
      { id: 3, name: 'C', startDate: null, duration: 1 },
      { id: 4, name: 'D', startDate: null, duration: 2 }, // tugas bebas
    ];
    const deps: SchedDependency[] = [
      { predecessorId: 1, successorId: 2, type: 'FS', lag: 0 },
      { predecessorId: 2, successorId: 3, type: 'FS', lag: 0 },
    ];
    const r = scheduleTasks('2026-11-02', tasks, deps, cal);
    expect(r.byId.get(4)!.float).toBeGreaterThan(0);
    expect(r.byId.get(4)!.critical).toBe(false);

    const names = new Map<number, string>([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
      [4, 'D'],
    ]);
    const paths = findCriticalPaths(r, deps, names, cal);
    expect(paths).toHaveLength(1);
    expect(paths[0].taskIds).toEqual([1, 2, 3]);
    expect(paths[0].taskNames).toEqual(['A', 'B', 'C']);
    // 02,03,04,05,06,09 Nov = 6 hari kerja
    expect(paths[0].lengthWorkdays).toBe(6);
    expect(r.projectDurationWorkdays).toBe(6);
  });

  it('dua jalur paralel kritis menghasilkan dua jalur', () => {
    const tasks: SchedulableTask[] = [
      { id: 1, name: 'A', startDate: '2026-11-02', duration: 3 },
      { id: 2, name: 'B', startDate: null, duration: 3 },
      { id: 3, name: 'C', startDate: null, duration: 3 },
    ];
    const deps: SchedDependency[] = [
      { predecessorId: 1, successorId: 2, type: 'FS', lag: 0 },
      { predecessorId: 1, successorId: 3, type: 'FS', lag: 0 },
    ];
    const r = scheduleTasks('2026-11-02', tasks, deps, cal);
    const paths = findCriticalPaths(r, deps, new Map([[1, 'A'], [2, 'B'], [3, 'C']]), cal);
    expect(paths.map((p) => p.taskIds)).toEqual([
      [1, 2],
      [1, 3],
    ]);
    for (const p of paths) expect(p.lengthWorkdays).toBe(r.projectDurationWorkdays);
  });
});
