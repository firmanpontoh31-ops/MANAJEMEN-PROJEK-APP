import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { ConflictError, NotFoundError } from '../errors.js';
import { toHoliday, type Row } from '../types.js';
import { parseBody, idParam, workdaysUpdate, holidayCreate } from '../validation.js';

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Kalender kerja: hari kerja mingguan + daftar hari libur. */
export function createCalendarRouter(db: DatabaseSync): Router {
  const r = Router();

  const readWorkdays = () => {
    const rows = db.prepare('SELECT dayOfWeek, isWorking FROM workdays ORDER BY dayOfWeek').all() as Row[];
    const workingSet = new Set(rows.filter((x) => Number(x.isWorking) === 1).map((x) => Number(x.dayOfWeek)));
    // Pastikan ada 7 baris (0..6) walau tabel lama
    const all: Array<{ dayOfWeek: number; isWorking: boolean; label: string }> = [];
    for (let d = 0; d < 7; d++) {
      const row = rows.find((x) => Number(x.dayOfWeek) === d);
      const isWorking = row ? Number(row.isWorking) === 1 : workingSet.has(d);
      all.push({ dayOfWeek: d, isWorking, label: DAY_NAMES_ID[d] });
    }
    return all;
  };

  const readHolidays = () =>
    (db.prepare('SELECT * FROM holidays ORDER BY date').all() as Row[]).map(toHoliday);

  // GET kalender lengkap
  r.get('/', (_req, res) => {
    res.json({ workdays: readWorkdays(), holidays: readHolidays() });
  });

  // PUT hari kerja (array dayOfWeek yang bekerja)
  r.put('/workdays', (req, res) => {
    const data = parseBody(workdaysUpdate, req);
    const set = new Set(data.workdays);
    db.exec('BEGIN');
    try {
      for (let d = 0; d < 7; d++) {
        db.prepare('UPDATE workdays SET isWorking = ? WHERE dayOfWeek = ?').run(set.has(d) ? 1 : 0, d);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json({ workdays: readWorkdays() });
  });

  // ---- Hari libur ----

  r.get('/holidays', (_req, res) => {
    res.json(readHolidays());
  });

  r.post('/holidays', (req, res) => {
    const data = parseBody(holidayCreate, req);
    const exists = db.prepare('SELECT id FROM holidays WHERE date = ?').get(data.date) as Row | undefined;
    if (exists) throw new ConflictError(`Hari libur pada ${data.date} sudah ada`);
    const info = db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run(data.date, data.name);
    const row = db.prepare('SELECT * FROM holidays WHERE id = ?').get(Number(info.lastInsertRowid)) as Row;
    res.status(201).json(toHoliday(row));
  });

  r.delete('/holidays/:id', (req, res) => {
    const id = idParam(req);
    const info = db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
    if (info.changes === 0) throw new NotFoundError(`Hari libur #${id} tidak ditemukan`);
    res.json({ deleted: true, id });
  });

  return r;
}
