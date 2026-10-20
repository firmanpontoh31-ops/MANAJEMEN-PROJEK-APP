import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { todayLocal, type Row } from '../services/context.js';

/** Tambah n hari pada tanggal ISO (untuk jendela 'mendekati tenggat'). */
function plusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v: number) => String(v).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

function mapTaskRow(t: Row) {
  return {
    id: Number(t.id),
    name: String(t.name),
    dueDate: String(t.dueDate),
    progress: Number(t.progress),
    status: String(t.status),
    priority: String(t.priority),
    projectId: Number(t.projectId),
    projectName: String(t.projectName),
    assigneeName: t.assigneeName == null ? null : String(t.assigneeName),
  };
}

/**
 * Dashboard: ringkasan proyek, jumlah tugas, progres, dan tugas terlambat.
 * Tugas terlambat = dueDate < hari ini dan status bukan done/cancelled.
 */
export function createDashboardRouter(db: DatabaseSync): Router {
  const r = Router();

  /**
   * Aktivitas terbaru: proyek & tugas yang terakhir diperbarui.
   * Dipakai untuk panel "Aktivitas terbaru" di dashboard.
   */
  r.get('/activity', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 8) || 8, 1), 30);
    const taskRows = db
      .prepare(
        `SELECT t.id, t.name, t.status, t.progress, t.updatedAt, t.projectId, p.name AS projectName
         FROM tasks t
         JOIN projects p ON p.id = t.projectId
         ORDER BY t.updatedAt DESC, t.id DESC
         LIMIT ?`,
      )
      .all(limit) as Row[];
    const projectRows = db
      .prepare(
        `SELECT id, name, status, updatedAt FROM projects ORDER BY updatedAt DESC, id DESC LIMIT ?`,
      )
      .all(limit) as Row[];

    const items = [
      ...taskRows.map((t) => ({
        kind: 'task' as const,
        id: Number(t.id),
        name: String(t.name),
        status: String(t.status),
        progress: Number(t.progress ?? 0),
        projectId: Number(t.projectId),
        projectName: String(t.projectName),
        updatedAt: String(t.updatedAt),
      })),
      ...projectRows.map((p) => ({
        kind: 'project' as const,
        id: Number(p.id),
        name: String(p.name),
        status: String(p.status),
        progress: 0,
        projectId: Number(p.id),
        projectName: String(p.name),
        updatedAt: String(p.updatedAt),
      })),
    ]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .slice(0, limit);

    res.json({ items });
  });

  r.get('/', (req, res) => {
    const projectIdRaw = req.query.projectId;
    const today = todayLocal();
    const hasProject = projectIdRaw != null && projectIdRaw !== '';
    const projectId = hasProject ? Number(projectIdRaw) : null;

    if (hasProject && (!Number.isInteger(projectId) || (projectId as number) <= 0)) {
      res.status(400).json({ error: 'Query projectId harus angka positif' });
      return;
    }

    // Ringkasan tugas (placeholder: 1=today overdue, 2=today dueSoon mulai, 3=horizon, 4=projectId)
    const horizon = plusDays(today, 7);
    const taskRow = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
           SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todo,
           SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
           SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < ? AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) AS overdue,
           SUM(CASE WHEN dueDate IS NOT NULL AND dueDate >= ? AND dueDate <= ? AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) AS dueSoon,
           COALESCE(ROUND(AVG(CASE WHEN status <> 'cancelled' THEN progress END), 1), 0) AS progress
         FROM tasks ${hasProject ? 'WHERE projectId = ?' : ''}`,
      )
      .get(...(hasProject ? [today, today, horizon, projectId] : [today, today, horizon])) as Row;

    // Ringkasan proyek
    const projectRow = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) AS planning,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) AS onHold,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
         FROM projects ${hasProject ? 'WHERE id = ?' : ''}`,
      )
      .get(...(hasProject ? [projectId] : [])) as Row;

    const overdueWhere = hasProject ? 'AND t.projectId = ?' : '';
    const overdueRows = db
      .prepare(
        `SELECT t.id, t.name, t.dueDate, t.progress, t.status, t.priority, t.projectId, p.name AS projectName,
                m.name AS assigneeName
         FROM tasks t
         JOIN projects p ON p.id = t.projectId
         LEFT JOIN members m ON m.id = t.assigneeId
         WHERE t.dueDate IS NOT NULL AND t.dueDate < ? AND t.status NOT IN ('done','cancelled')
         ${overdueWhere}
         ORDER BY t.dueDate ASC
         LIMIT 20`,
      )
      .all(...(hasProject ? [today, projectId] : [today])) as Row[];

    // Tugas mendekati tenggat: hari ini <= tenggat <= +7 hari
    const dueSoonRows = db
      .prepare(
        `SELECT t.id, t.name, t.dueDate, t.progress, t.status, t.priority, t.projectId, p.name AS projectName,
                m.name AS assigneeName
         FROM tasks t
         JOIN projects p ON p.id = t.projectId
         LEFT JOIN members m ON m.id = t.assigneeId
         WHERE t.dueDate IS NOT NULL AND t.dueDate >= ? AND t.dueDate <= ? AND t.status NOT IN ('done','cancelled')
         ${overdueWhere}
         ORDER BY t.dueDate ASC
         LIMIT 20`,
      )
      .all(...(hasProject ? [today, horizon, projectId] : [today, horizon])) as Row[];

    const recentRows = db
      .prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id AND t.status <> 'cancelled') AS taskCount,
           (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id AND t.status = 'done') AS doneCount,
           (SELECT COALESCE(ROUND(AVG(t.progress),1),0) FROM tasks t WHERE t.projectId = p.id AND t.status <> 'cancelled') AS progress
         FROM projects p
         ${hasProject ? 'WHERE p.id = ?' : ''}
         ORDER BY p.updatedAt DESC, p.id DESC
         LIMIT 6`,
      )
      .all(...(hasProject ? [projectId] : [])) as Row[];

    res.json({
      today,
      projects: {
        total: Number(projectRow.total ?? 0),
        planning: Number(projectRow.planning ?? 0),
        active: Number(projectRow.active ?? 0),
        onHold: Number(projectRow.onHold ?? 0),
        completed: Number(projectRow.completed ?? 0),
        cancelled: Number(projectRow.cancelled ?? 0),
      },
      tasks: {
        total: Number(taskRow.total ?? 0),
        done: Number(taskRow.done ?? 0),
        inProgress: Number(taskRow.inProgress ?? 0),
        todo: Number(taskRow.todo ?? 0),
        review: Number(taskRow.review ?? 0),
        cancelled: Number(taskRow.cancelled ?? 0),
        overdue: Number(taskRow.overdue ?? 0),
        dueSoon: Number(taskRow.dueSoon ?? 0),
      },
      progress: Number(taskRow.progress ?? 0),
      dueSoonTasks: dueSoonRows.map(mapTaskRow),
      overdueTasks: overdueRows.map(mapTaskRow),
      recentProjects: recentRows.map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        status: String(p.status),
        startDate: String(p.startDate),
        taskCount: Number(p.taskCount ?? 0),
        doneCount: Number(p.doneCount ?? 0),
        progress: Number(p.progress ?? 0),
      })),
    });
  });

  return r;
}
