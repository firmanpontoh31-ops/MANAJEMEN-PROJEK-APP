import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { NotFoundError, ValidationError } from '../errors.js';
import { toMember, type Row } from '../types.js';
import { parseBody, idParam, memberCreate, memberUpdate } from '../validation.js';

const UPDATE_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  role: 'role',
};

/** Manajemen anggota tim (resource pool lintas proyek). */
export function createMembersRouter(db: DatabaseSync): Router {
  const r = Router();

  const mustGet = (id: number) => {
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new NotFoundError(`Anggota #${id} tidak ditemukan`);
    return toMember(row);
  };

  // LIST lengkap dengan jumlah proyek & tugas yang ditugaskan
  r.get('/', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT m.*,
           (SELECT COUNT(*) FROM project_members pm WHERE pm.memberId = m.id) AS projectCount,
           (SELECT COUNT(*) FROM tasks t WHERE t.assigneeId = m.id AND t.status <> 'cancelled') AS taskCount
         FROM members m
         ORDER BY m.name COLLATE NOCASE`,
      )
      .all() as Row[];
    res.json(
      rows.map((row) => ({
        ...toMember(row),
        projectCount: Number(row.projectCount ?? 0),
        taskCount: Number(row.taskCount ?? 0),
      })),
    );
  });

  r.get('/:id', (req, res) => {
    res.json(mustGet(idParam(req)));
  });

  r.post('/', (req, res) => {
    const data = parseBody(memberCreate, req);
    const info = db
      .prepare('INSERT INTO members (name, email, role) VALUES (?, ?, ?)')
      .run(data.name, data.email, data.role);
    res.status(201).json(mustGet(Number(info.lastInsertRowid)));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    const data = parseBody(memberUpdate, req);
    const cols: string[] = [];
    const values: Array<string | number> = [];
    for (const [key, col] of Object.entries(UPDATE_COLUMNS)) {
      const v = (data as Record<string, unknown>)[key];
      if (typeof v === 'string') {
        cols.push(`${col} = ?`);
        values.push(v);
      }
    }
    if (cols.length === 0) throw new ValidationError('Tidak ada data yang diubah');
    values.push(id);
    db.prepare(`UPDATE members SET ${cols.join(', ')} WHERE id = ?`).run(...values);
    res.json(mustGet(id));
  });

  // DELETE: penugasan tugas otomatis dilepas (FK assigneeId ON DELETE SET NULL)
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    mustGet(id);
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    res.json({ deleted: true, id });
  });

  return r;
}
