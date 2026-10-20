import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { idParam } from '../validation.js';
import { getProject, getCalendar, type Row } from '../services/context.js';
import { toTask, type Project, type Task } from '../types.js';
import {
  scheduleTasks,
  type ScheduleResult,
  type SchedulableTask,
  type SchedDependency,
} from '../services/scheduling.js';
import { findCriticalPaths } from '../services/cpm.js';
import { computePert, round2 } from '../services/pert.js';

type TaskWithAssignee = Task & { assigneeName: string | null };

interface Loaded {
  project: Project;
  cal: ReturnType<typeof getCalendar>;
  active: TaskWithAssignee[];
  cancelledCount: number;
  deps: SchedDependency[];
  result: ScheduleResult;
}

/** Muat proyek + tugas aktif + dependensi + hasil penjadwalan. */
function load(db: DatabaseSync, projectId: number): Loaded {
  const project = getProject(db, projectId);
  const cal = getCalendar(db);

  const rows = db
    .prepare(
      `SELECT t.*, m.name AS assigneeName
       FROM tasks t
       LEFT JOIN members m ON m.id = t.assigneeId
       WHERE t.projectId = ?
       ORDER BY t.id`,
    )
    .all(projectId) as Row[];

  const all: TaskWithAssignee[] = rows.map((row) => ({
    ...toTask(row),
    assigneeName: row.assigneeName == null ? null : String(row.assigneeName),
  }));

  const active = all.filter((t) => t.status !== 'cancelled');
  const activeIds = new Set(active.map((t) => t.id));

  const deps: SchedDependency[] = (
    db.prepare('SELECT * FROM dependencies WHERE projectId = ? ORDER BY id').all(projectId) as Row[]
  )
    .map((d) => ({
      predecessorId: Number(d.predecessorId),
      successorId: Number(d.successorId),
      type: String(d.type) as SchedDependency['type'],
      lag: Number(d.lag),
    }))
    .filter((d) => activeIds.has(d.predecessorId) && activeIds.has(d.successorId));

  const schedulable: SchedulableTask[] = active.map((t) => ({
    id: t.id,
    name: t.name,
    startDate: t.startDate,
    duration: t.duration,
  }));

  const result = scheduleTasks(project.startDate, schedulable, deps, cal);
  return { project, cal, active, cancelledCount: all.length - active.length, deps, result };
}

function decorateTasks(loaded: Loaded) {
  const meta = new Map(loaded.active.map((t) => [t.id, t]));
  return loaded.result.tasks.map((ts) => {
    const m = meta.get(ts.id)!;
    return {
      ...ts,
      parentId: m.parentId,
      status: m.status,
      priority: m.priority,
      progress: m.progress,
      dueDate: m.dueDate,
      assigneeId: m.assigneeId,
      assigneeName: m.assigneeName,
    };
  });
}

/**
 * Endpoint analisis jadwal:
 *  - /schedule : forward/backward pass (ES, EF, LS, LF, float) berbasis kalender kerja
 *  - /pert     : estimasi TE = (O + 4M + P) / 6 per tugas
 *  - /cpm      : jalur kritis, durasi minimum proyek, agregat PERT pada jalur kritis
 */
export function createAnalysisRouter(db: DatabaseSync): Router {
  const r = Router();

  r.get('/:projectId/schedule', (req, res) => {
    const projectId = idParam(req, 'projectId');
    const loaded = load(db, projectId);

    res.json({
      projectId,
      projectName: loaded.project.name,
      calendarStart: loaded.project.startDate,
      startDate: loaded.result.startDate,
      finishDate: loaded.result.finishDate,
      projectDurationWorkdays: loaded.result.projectDurationWorkdays,
      taskCount: loaded.active.length,
      skippedCancelled: loaded.cancelledCount,
      warnings: loaded.result.warnings,
      tasks: decorateTasks(loaded),
    });
  });

  /**
   * PERT: estimasi durasi per tugas.
   *   TE = (O + 4M + P) / 6, SD = (P - O) / 6, Var = SD^2
   */
  r.get('/:projectId/pert', (req, res) => {
    const projectId = idParam(req, 'projectId');
    const project = getProject(db, projectId);

    const rows = db
      .prepare(
        `SELECT id, name, duration, status, optimisticDays, mostLikelyDays, pessimisticDays
         FROM tasks WHERE projectId = ? AND status <> 'cancelled' ORDER BY id`,
      )
      .all(projectId) as Row[];

    const tasks = [];
    const missing: Array<{ id: number; name: string }> = [];
    let teSum = 0;
    let varSum = 0;
    let oSum = 0;
    let pSum = 0;

    for (const row of rows) {
      const id = Number(row.id);
      const name = String(row.name);
      const o = row.optimisticDays == null ? null : Number(row.optimisticDays);
      const m = row.mostLikelyDays == null ? null : Number(row.mostLikelyDays);
      const p = row.pessimisticDays == null ? null : Number(row.pessimisticDays);

      if (o != null && m != null && p != null) {
        const est = computePert(o, m, p);
        teSum += est.te;
        varSum += est.variance;
        oSum += o;
        pSum += p;
        tasks.push({
          id,
          name,
          duration: Number(row.duration),
          status: String(row.status),
          optimistic: o,
          mostLikely: m,
          pessimistic: p,
          te: round2(est.te),
          sd: round2(est.sd),
          variance: round2(est.variance),
          hasEstimates: true,
        });
      } else {
        missing.push({ id, name });
        tasks.push({
          id,
          name,
          duration: Number(row.duration),
          status: String(row.status),
          optimistic: o,
          mostLikely: m,
          pessimistic: p,
          te: null,
          sd: null,
          variance: null,
          hasEstimates: false,
        });
      }
    }

    res.json({
      projectId,
      projectName: project.name,
      formula: { expected: 'TE = (O + 4M + P) / 6', sd: 'SD = (P - O) / 6', variance: 'Var = SD^2' },
      tasks,
      missingEstimates: missing,
      summary: {
        totalTasks: tasks.length,
        estimatedTasks: tasks.length - missing.length,
        teSum: round2(teSum),
        varianceSum: round2(varSum),
        sd: round2(Math.sqrt(varSum)),
        optimisticSum: round2(oSum),
        pessimisticSum: round2(pSum),
      },
    });
  });

  r.get('/:projectId/cpm', (req, res) => {
    const projectId = idParam(req, 'projectId');
    const loaded = load(db, projectId);
    const { result, deps, cal } = loaded;

    const names = new Map(loaded.active.map((t) => [t.id, t.name]));
    const paths = findCriticalPaths(result, deps, names, cal);

    // Agregat PERT pada jalur kritis terpanjang (bila estimasi tersedia)
    const primary = paths.length > 0 ? paths[0] : null;
    let pert: Record<string, unknown> | null = null;
    if (primary) {
      const byId = new Map(loaded.active.map((t) => [t.id, t]));
      let teSum = 0;
      let varSum = 0;
      let oSum = 0;
      let pSum = 0;
      let estimated = 0;
      for (const id of primary.taskIds) {
        const t = byId.get(id);
        if (!t) continue;
        const { optimisticDays: o, mostLikelyDays: m, pessimisticDays: p } = t;
        if (o != null && m != null && p != null) {
          const est = computePert(o, m, p);
          teSum += est.te;
          varSum += est.variance;
          oSum += o;
          pSum += p;
          estimated++;
        }
      }
      pert = {
        pathTaskCount: primary.taskIds.length,
        estimatedOnPath: estimated,
        teSum: round2(teSum),
        varianceSum: round2(varSum),
        sd: round2(Math.sqrt(varSum)),
        optimisticSum: round2(oSum),
        pessimisticSum: round2(pSum),
        note: estimated > 0 ? 'Agregat PERT dihitung pada jalur kritis terpanjang' : 'Estimasi PERT belum tersedia pada jalur kritis',
      };
    }

    res.json({
      projectId,
      projectName: loaded.project.name,
      startDate: result.startDate,
      finishDate: result.finishDate,
      projectDurationWorkdays: result.projectDurationWorkdays,
      criticalTaskCount: result.tasks.filter((t) => t.critical).length,
      criticalPaths: paths,
      pert,
      warnings: result.warnings,
      tasks: decorateTasks(loaded),
    });
  });

  return r;
}
