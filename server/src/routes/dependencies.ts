import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import { toDependency, type Row } from '../types.js';
import { parseBody, idParam, dependencyCreate, dependencyUpdate } from '../validation.js';
import { hasCycle } from '../services/graph.js';

const SELECT_WITH_NAMES = `
  SELECT d.*,
         tp.name AS predecessorName, ts.name AS successorName
  FROM dependencies d
  LEFT JOIN tasks tp ON tp.id = d.predecessorId
  LEFT JOIN tasks ts ON ts.id = d.successorId
`;

function decorate(r: Row) {
  return {
    ...toDependency(r),
    predecessorName: r.predecessorName == null ? null : String(r.predecessorName),
    successorName: r.successorName == null ? null : String(r.successorName),
  };
}

export function createDependenciesRouter(db: DatabaseSync): Router {
  const r = Router();

  const mustGetDependency = (id: number) => {
    const row = db.prepare('SELECT * FROM dependencies WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new NotFoundError(`Dependensi #${id} tidak ditemukan`);
    return toDependency(row);
  };

  const assertProjectExists = (projectId: number): void => {
    const row = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as Row | undefined;
    if (!row) throw new NotFoundError(`Proyek #${projectId} tidak ditemukan`);
  };

  /** Cek kedua tugas ada & dalam proyek yang sama. */
  const assertTasksInProject = (projectId: number, taskIds: number[]): void => {
    for (const taskId of taskIds) {
      const row = db.prepare('SELECT id, projectId FROM tasks WHERE id = ?').get(taskId) as Row | undefined;
      if (!row) throw new NotFoundError(`Tugas #${taskId} tidak ditemukan`);
      if (Number(row.projectId) !== projectId) {
        throw new ValidationError(`Tugas #${taskId} bukan bagian dari proyek #${projectId}`);
      }
    }
  };

  /** True bila menambahkan edge from->to akan membentuk siklus. */
  const wouldCreateCycle = (projectId: number, from: number, to: number, excludeDepId?: number): boolean => {
    const rows = db
      .prepare(
        'SELECT id, predecessorId, successorId FROM dependencies WHERE projectId = ? AND id IS NOT ?',
      )
      .all(projectId, excludeDepId ?? null) as Row[];
    const nodes = (db.prepare('SELECT id FROM tasks WHERE projectId = ?').all(projectId) as Row[]).map((x) =>
      Number(x.id),
    );
    const edges = rows.map((x) => ({ from: Number(x.predecessorId), to: Number(x.successorId) }));
    edges.push({ from, to });
    return hasCycle(nodes, edges);
  };

  // LIST dependensi dalam proyek (lengkap dengan nama tugas)
  r.get('/:projectId/dependencies', (req, res) => {
    const projectId = idParam(req, 'projectId');
    assertProjectExists(projectId);
    const rows = db
      .prepare(`${SELECT_WITH_NAMES} WHERE d.projectId = ? ORDER BY d.id`)
      .all(projectId) as Row[];
    res.json(rows.map(decorate));
  });

  // CREATE
  r.post('/:projectId/dependencies', (req, res) => {
    const projectId = idParam(req, 'projectId');
    assertProjectExists(projectId);
    const data = parseBody(dependencyCreate, req);

    if (data.predecessorId === data.successorId) {
      throw new ValidationError('Sebuah tugas tidak boleh menjadi predecessor dirinya sendiri');
    }
    assertTasksInProject(projectId, [data.predecessorId, data.successorId]);

    const dup = db
      .prepare('SELECT id FROM dependencies WHERE projectId = ? AND predecessorId = ? AND successorId = ?')
      .get(projectId, data.predecessorId, data.successorId) as Row | undefined;
    if (dup) {
      throw new ConflictError(
        `Dependensi dari tugas #${data.predecessorId} ke #${data.successorId} sudah ada`,
      );
    }

    if (wouldCreateCycle(projectId, data.predecessorId, data.successorId)) {
      throw new ConflictError('Dependensi akan membentuk siklus antar tugas', {
        predecessorId: data.predecessorId,
        successorId: data.successorId,
      });
    }

    const info = db
      .prepare(
        'INSERT INTO dependencies (projectId, predecessorId, successorId, type, lag) VALUES (?, ?, ?, ?, ?)',
      )
      .run(projectId, data.predecessorId, data.successorId, data.type, data.lag);
    const row = db.prepare(`${SELECT_WITH_NAMES} WHERE d.id = ?`).get(Number(info.lastInsertRowid)) as Row;
    res.status(201).json(decorate(row));
  });

  // UPDATE tipe/lag
  r.put('/:id', (req, res) => {
    const id = idParam(req);
    const dep = mustGetDependency(id);
    const data = parseBody(dependencyUpdate, req);

    const cols: string[] = [];
    const values: Array<string | number> = [];
    if (data.type !== undefined) {
      cols.push('type = ?');
      values.push(data.type);
    }
    if (data.lag !== undefined) {
      cols.push('lag = ?');
      values.push(data.lag);
    }
    if (cols.length === 0) throw new ValidationError('Tidak ada data yang diubah');
    values.push(id);
    db.prepare(`UPDATE dependencies SET ${cols.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare(`${SELECT_WITH_NAMES} WHERE d.id = ?`).get(id) as Row;
    res.json(decorate(row));
  });

  // DELETE
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    mustGetDependency(id);
    db.prepare('DELETE FROM dependencies WHERE id = ?').run(id);
    res.json({ deleted: true, id });
  });

  return r;
}
