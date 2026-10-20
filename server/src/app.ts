import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from './errors.js';
import { createProjectsRouter } from './routes/projects.js';
import { createTasksRouter } from './routes/tasks.js';
import { createTaskIndexRouter } from './routes/taskIndex.js';
import { createMembersRouter } from './routes/members.js';
import { createCalendarRouter } from './routes/calendar.js';
import { createDependenciesRouter } from './routes/dependencies.js';
import { createAnalysisRouter } from './routes/analysis.js';
import { createDashboardRouter } from './routes/dashboard.js';

export function createApp(db: DatabaseSync): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/projects', createProjectsRouter(db));
  app.use('/api/projects', createTasksRouter(db));
  app.use('/api/tasks', createTaskIndexRouter(db)); // daftar tugas lintas proyek
  app.use('/api/tasks', createTasksRouter(db));
  app.use('/api/members', createMembersRouter(db));
  app.use('/api/calendar', createCalendarRouter(db));
  app.use('/api/projects', createDependenciesRouter(db));
  app.use('/api/dependencies', createDependenciesRouter(db));
  app.use('/api/projects', createAnalysisRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db));

  // 404 untuk endpoint API yang tidak dikenal
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
  });

  // Penanganan error terpusat -> JSON
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }

    // Body JSON rusak dari body-parser
    if (err instanceof SyntaxError && 'status' in err && Number((err as { status?: number }).status) === 400) {
      res.status(400).json({ error: 'Body JSON tidak valid' });
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) {
      res.status(409).json({ error: 'Data duplikat tidak diizinkan', details: msg });
      return;
    }
    if (/FOREIGN KEY constraint failed/i.test(msg)) {
      res.status(400).json({ error: 'Relasi data tidak valid (referensi tidak ditemukan)' });
      return;
    }
    if (/CHECK constraint failed/i.test(msg)) {
      res.status(400).json({ error: 'Nilai tidak diizinkan oleh aturan database', details: msg });
      return;
    }

    console.error('[server error]', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  });

  return app;
}
