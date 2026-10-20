import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { NotFoundError, ValidationError } from '../errors.js';
import { toTask, type Row, type Task } from '../types.js';
import { parseBody, idParam, taskCreate, taskUpdate } from '../validation.js';

const SELECT_WITH_ASSIGNEE = `
  SELECT t.*, m.name AS assigneeName
  FROM tasks t
  LEFT JOIN members m ON m.id = t.assigneeId
`;

const UPDATE_COLUMNS: Record<string, string> = {
  name: 'name',
  description: 'description',
  parentId: 'parentId',
  startDate: 'startDate',
  duration: 'duration',
  dueDate: 'dueDate',
  status: 'status',
  priority: 'priority',
  progress: 'progress',
  assigneeId: 'assigneeId',
  optimisticDays: 'optimisticDays',
  mostLikelyDays: 'mostLikelyDays',
  pessimisticDays: 'pessimisticDays',
};

function withAssignee(r: Row): Task & { assigneeName: string | null } {
  return { ...toTask(r), assigneeName: r.assigneeName == null ? null : String(r.assigneeName) };
}

export function createTasksRouter(db: DatabaseSync): Router {
  const r = Router();

  const mustGetTask = (id: number): Task => {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new NotFoundError(`Tugas #${id} tidak ditemukan`);
    return toTask(row);
  };

  const assertProjectExists = (projectId: number): void => {
    const row = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as Row | undefined;
    if (!row) throw new NotFoundError(`Proyek #${projectId} tidak ditemukan`);
  };

  const assertMemberExists = (memberId: number): void => {
    const row = db.prepare('SELECT id FROM members WHERE id = ?').get(memberId) as Row | undefined;
    if (!row) throw new NotFoundError(`Anggota #${memberId} tidak ditemukan`);
  };

  /** Validasi parentId: ada, satu proyek, bukan dirinya sendiri, tidak membentuk siklus hierarki. */
  const assertValidParent = (task: { id?: number; projectId: number }, parentId: number | null): void => {
    if (parentId == null) return;
    if (task.id != null && parentId === task.id) {
      throw new ValidationError('Tugas tidak boleh menjadi parent dirinya sendiri');
    }
    const parent = db.prepare('SELECT id, projectId FROM tasks WHERE id = ?').get(parentId) as Row | undefined;
    if (!parent) throw new NotFoundError(`Parent tugas #${parentId} tidak ditemukan`);
    if (Number(parent.projectId) !== task.projectId) {
      throw new ValidationError('Parent tugas harus berada dalam proyek yang sama');
    }
    // Cek siklus hierarki: naik dari parent sampai akar
    if (task.id != null) {
      let cur: number | null = parentId;
      let guard = 0;
      while (cur != null && guard++ < 5000) {
        if (cur === task.id) {
          throw new ValidationError('Parent tugas membentuk siklus hierarki');
        }
        const row = db.prepare('SELECT parentId FROM tasks WHERE id = ?').get(cur) as Row | undefined;
        if (!row) break;
        cur = row.parentId == null ? null : Number(row.parentId);
      }
    }
  };

  const ensureMemberAssignedToProject = (projectId: number, memberId: number): void => {
    db.prepare('INSERT OR IGNORE INTO project_members (projectId, memberId) VALUES (?, ?)').run(projectId, memberId);
  };

  // LIST tugas dalam proyek (flat, client menyusun pohon)
  r.get('/:projectId/tasks', (req, res) => {
    const projectId = idParam(req, 'projectId');
    assertProjectExists(projectId);
    const rows = db
      .prepare(`${SELECT_WITH_ASSIGNEE} WHERE t.projectId = ? ORDER BY t.id`)
      .all(projectId) as Row[];
    res.json(rows.map(withAssignee));
  });

  // CREATE tugas / subtugas
  r.post('/:projectId/tasks', (req, res) => {
    const projectId = idParam(req, 'projectId');
    assertProjectExists(projectId);
    const data = parseBody(taskCreate, req);

    assertValidParent({ projectId }, data.parentId ?? null);
    if (data.assigneeId != null) {
      assertMemberExists(data.assigneeId);
      ensureMemberAssignedToProject(projectId, data.assigneeId);
    }

    const info = db
      .prepare(
        `INSERT INTO tasks
           (projectId, parentId, name, description, startDate, duration, dueDate,
            status, priority, progress, assigneeId, optimisticDays, mostLikelyDays, pessimisticDays)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectId,
        data.parentId ?? null,
        data.name,
        data.description,
        data.startDate ?? null,
        data.duration,
        data.dueDate ?? null,
        data.status,
        data.priority,
        data.progress,
        data.assigneeId ?? null,
        data.optimisticDays ?? null,
        data.mostLikelyDays ?? null,
        data.pessimisticDays ?? null,
      );
    const created = mustGetTask(Number(info.lastInsertRowid));
    res.status(201).json(created);
  });

  // DETAIL
  r.get('/:id', (req, res) => {
    const id = idParam(req);
    const task = mustGetTask(id);
    const row = db.prepare(`${SELECT_WITH_ASSIGNEE} WHERE t.id = ?`).get(id) as Row;
    const children = db
      .prepare('SELECT id, name, status, duration, progress FROM tasks WHERE parentId = ? ORDER BY id')
      .all(id) as Row[];
    res.json({
      ...withAssignee(row),
      children: children.map((c) => ({
        id: Number(c.id),
        name: String(c.name),
        status: String(c.status),
        duration: Number(c.duration),
        progress: Number(c.progress),
      })),
    });
  });

  // UPDATE
  r.put('/:id', (req, res) => {
    const id = idParam(req);
    const task = mustGetTask(id);
    const data = parseBody(taskUpdate, req);

    if ('parentId' in data) {
      assertValidParent({ id, projectId: task.projectId }, data.parentId ?? null);
    }
    if (data.assigneeId != null) {
      assertMemberExists(data.assigneeId);
      ensureMemberAssignedToProject(task.projectId, data.assigneeId);
    }

    const cols: string[] = [];
    const values: Array<string | number | null> = [];
    for (const [key, col] of Object.entries(UPDATE_COLUMNS)) {
      const v = (data as Record<string, unknown>)[key];
      if (v === undefined) continue;
      if (v === null) {
        cols.push(`${col} = NULL`);
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number') {
        cols.push(`${col} = ?`);
        values.push(v);
      }
    }
    if (cols.length === 0) throw new ValidationError('Tidak ada data yang diubah');
    values.push(id);
    db.prepare(`UPDATE tasks SET ${cols.join(', ')}, updatedAt = datetime('now') WHERE id = ?`).run(...values);

    const row = db.prepare(`${SELECT_WITH_ASSIGNEE} WHERE t.id = ?`).get(id) as Row;
    res.json(withAssignee(row));
  });

  // DELETE (subtugas & dependensi ikut terhapus via ON DELETE CASCADE)
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    mustGetTask(id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ deleted: true, id });
  });

  return r;
}
