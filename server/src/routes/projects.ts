import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../errors.js';
import { toProject, toMember, type Project, type Row } from '../types.js';
import { parseBody, idParam, projectCreate, projectUpdate, memberCreate } from '../validation.js';
import { todayLocal } from '../services/context.js';

const COUNTS_SQL = `
  (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id AND t.status <> 'cancelled') AS taskCount,
  (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id AND t.status = 'done') AS doneCount,
  (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id AND t.dueDate IS NOT NULL AND t.dueDate < ? AND t.status NOT IN ('done','cancelled')) AS overdueCount,
  (SELECT COALESCE(ROUND(AVG(t.progress), 1), 0) FROM tasks t WHERE t.projectId = p.id AND t.status <> 'cancelled') AS progress,
  (SELECT COUNT(*) FROM project_members pm WHERE pm.projectId = p.id) AS memberCount,
  (SELECT m.name FROM project_members pm JOIN members m ON m.id = pm.memberId
   WHERE pm.projectId = p.id
   ORDER BY CASE WHEN lower(m.role) IN ('lead','project lead','project manager','manajer proyek','pengelola proyek','pm') THEN 0 ELSE 1 END,
            m.id
   LIMIT 1) AS leadName
`;

const UPDATE_COLUMNS: Record<string, string> = {
  name: 'name',
  description: 'description',
  startDate: 'startDate',
  status: 'status',
};

const assignSchema = z.object({
  memberId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200).optional(),
});

function decorate(row: Row) {
  return {
    ...toProject(row),
    taskCount: Number(row.taskCount ?? 0),
    doneCount: Number(row.doneCount ?? 0),
    overdueCount: Number(row.overdueCount ?? 0),
    progress: Number(row.progress ?? 0),
    memberCount: Number(row.memberCount ?? 0),
    leadName: row.leadName == null ? null : String(row.leadName),
  };
}

export function createProjectsRouter(db: DatabaseSync): Router {
  const r = Router();

  const mustGet = (id: number): Project => {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new NotFoundError(`Proyek #${id} tidak ditemukan`);
    return toProject(row);
  };

  // LIST
  r.get('/', (_req, res) => {
    const rows = db
      .prepare(`SELECT p.*, ${COUNTS_SQL} FROM projects p ORDER BY p.updatedAt DESC, p.id DESC`)
      .all(todayLocal()) as Row[];
    res.json(rows.map(decorate));
  });

  // CREATE
  r.post('/', (req, res) => {
    const data = parseBody(projectCreate, req);
    const info = db
      .prepare('INSERT INTO projects (name, description, startDate, status) VALUES (?, ?, ?, ?)')
      .run(data.name, data.description, data.startDate, data.status);
    const created = mustGet(Number(info.lastInsertRowid));
    res.status(201).json(created);
  });

  // DETAIL
  r.get('/:id', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    const row = db
      .prepare(`SELECT p.*, ${COUNTS_SQL} FROM projects p WHERE p.id = ?`)
      .get(todayLocal(), id) as Row;
    res.json(decorate(row));
  });

  // UPDATE
  r.put('/:id', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    const data = parseBody(projectUpdate, req);
    const cols: string[] = [];
    const values: Array<string | number | null> = [];
    for (const [key, col] of Object.entries(UPDATE_COLUMNS)) {
      const v = (data as Record<string, unknown>)[key];
      if (typeof v === 'string') {
        cols.push(`${col} = ?`);
        values.push(v);
      }
    }
    if (cols.length === 0) throw new ValidationError('Tidak ada data yang diubah');
    values.push(id);
    db.prepare(`UPDATE projects SET ${cols.join(', ')}, updatedAt = datetime('now') WHERE id = ?`).run(
      ...values,
    );
    res.json(mustGet(id));
  });

  // DELETE
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ deleted: true, id });
  });

  // ---- Anggota tim & penugasan ----

  r.get('/:id/members', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    const rows = db
      .prepare(
        `SELECT m.* FROM members m
         JOIN project_members pm ON pm.memberId = m.id
         WHERE pm.projectId = ? ORDER BY m.name COLLATE NOCASE`,
      )
      .all(id) as Row[];
    res.json(rows.map(toMember));
  });

  r.post('/:id/members', (req, res) => {
    const projectId = idParam(req);
    mustGet(projectId);
    const data = parseBody(assignSchema, req);

    if (data.memberId == null && !data.name) {
      throw new ValidationError('Sertakan memberId untuk anggota lama, atau name untuk anggota baru');
    }

    let memberId = data.memberId;
    if (memberId == null) {
      const m = parseBody(memberCreate, req);
      const info = db
        .prepare('INSERT INTO members (name, email, role) VALUES (?, ?, ?)')
        .run(m.name, m.email, m.role);
      memberId = Number(info.lastInsertRowid);
    } else {
      getMemberOrThrow(db, memberId);
    }

    db.prepare('INSERT OR IGNORE INTO project_members (projectId, memberId) VALUES (?, ?)').run(
      projectId,
      memberId,
    );
    db.prepare('UPDATE projects SET updatedAt = datetime(\'now\') WHERE id = ?').run(projectId);

    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as Row;
    res.status(201).json(toMember(row));
  });

  r.delete('/:id/members/:memberId', (req, res) => {
    const projectId = idParam(req);
    mustGet(projectId);
    const memberId = idParam(req, 'memberId');
    const info = db
      .prepare('DELETE FROM project_members WHERE projectId = ? AND memberId = ?')
      .run(projectId, memberId);
    if (info.changes === 0) {
      throw new NotFoundError(`Anggota #${memberId} tidak terdaftar pada proyek #${projectId}`);
    }
    res.json({ deleted: true, projectId, memberId });
  });

  return r;
}

function getMemberOrThrow(db: DatabaseSync, id: number): void {
  const row = db.prepare('SELECT id FROM members WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new NotFoundError(`Anggota #${id} tidak ditemukan`);
}
