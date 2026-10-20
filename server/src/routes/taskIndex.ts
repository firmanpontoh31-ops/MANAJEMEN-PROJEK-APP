import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { ValidationError } from '../errors.js';
import { toTask, type Row } from '../types.js';

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

function queryInt(raw: unknown, name: string): number | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`Query ${name} harus angka positif`);
  }
  return value;
}

function queryEnum(raw: unknown, name: string, allowed: string[]): string | null {
  if (raw == null || raw === '') return null;
  const value = String(raw);
  if (!allowed.includes(value)) {
    throw new ValidationError(`Query ${name} harus salah satu dari: ${allowed.join(', ')}`);
  }
  return value;
}

/**
 * Daftar tugas lintas proyek (untuk halaman Tugas: tabel & kanban).
 * Filter opsional: projectId, status, priority, assigneeId, q (cari nama).
 */
export function createTaskIndexRouter(db: DatabaseSync): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const projectId = queryInt(req.query.projectId, 'projectId');
    const assigneeId = queryInt(req.query.assigneeId, 'assigneeId');
    const status = queryEnum(req.query.status, 'status', TASK_STATUSES);
    const priority = queryEnum(req.query.priority, 'priority', PRIORITIES);
    const search = req.query.q == null || String(req.query.q).trim() === '' ? null : String(req.query.q).trim();

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (projectId != null) {
      where.push('t.projectId = ?');
      params.push(projectId);
    }
    if (status != null) {
      where.push('t.status = ?');
      params.push(status);
    }
    if (priority != null) {
      where.push('t.priority = ?');
      params.push(priority);
    }
    if (assigneeId != null) {
      where.push('t.assigneeId = ?');
      params.push(assigneeId);
    }
    if (search != null) {
      where.push('(t.name LIKE ? COLLATE NOCASE OR t.description LIKE ? COLLATE NOCASE)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const sql = `
      SELECT t.*, m.name AS assigneeName, p.name AS projectName, p.status AS projectStatus
      FROM tasks t
      JOIN projects p ON p.id = t.projectId
      LEFT JOIN members m ON m.id = t.assigneeId
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.name COLLATE NOCASE, t.parentId IS NOT NULL, t.id
    `;
    const rows = db.prepare(sql).all(...params) as Row[];

    res.json(
      rows.map((row) => ({
        ...toTask(row),
        assigneeName: row.assigneeName == null ? null : String(row.assigneeName),
        projectName: String(row.projectName),
        projectStatus: String(row.projectStatus),
      })),
    );
  });

  return r;
}
