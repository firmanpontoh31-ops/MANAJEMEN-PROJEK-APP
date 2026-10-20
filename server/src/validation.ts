import { z } from 'zod';
import type { Request } from 'express';
import { ValidationError } from './errors.js';

/** String tanggal ISO YYYY-MM-DD yang valid secara kalender. */
export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }, 'Tanggal tidak valid pada kalender');

export const optionalDate = dateStr.nullable().optional();

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;
export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;

export const projectCreate = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(200),
  description: z.string().max(2000).optional().default(''),
  startDate: dateStr,
  status: z.enum(PROJECT_STATUSES).optional().default('planning'),
});

export const projectUpdate = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(200).optional(),
  description: z.string().max(2000).optional(),
  startDate: dateStr.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const memberCreate = z.object({
  name: z.string().trim().min(1, 'Nama anggota wajib diisi').max(200),
  email: z
    .string()
    .trim()
    .max(200)
    .regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format email tidak valid')
    .optional()
    .default(''),
  role: z.string().trim().max(60).optional().default('member'),
});

export const memberUpdate = memberCreate.partial();

const progress = z.coerce.number().int().min(0, 'Progress minimal 0').max(100, 'Progress maksimal 100');

export const taskObject = z.object({
  name: z.string().trim().min(1, 'Nama tugas wajib diisi').max(200),
  description: z.string().max(2000).optional().default(''),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  startDate: optionalDate,
  duration: z.coerce.number().int().min(1, 'Durasi minimal 1 hari').max(3650).optional().default(1),
  dueDate: optionalDate,
  status: z.enum(TASK_STATUSES).optional().default('todo'),
  priority: z.enum(PRIORITIES).optional().default('medium'),
  progress: progress.optional().default(0),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  optimisticDays: z.coerce.number().min(0).max(3650).nullable().optional(),
  mostLikelyDays: z.coerce.number().min(0).max(3650).nullable().optional(),
  pessimisticDays: z.coerce.number().min(0).max(3650).nullable().optional(),
});

function taskCrossFieldChecks(
  v: Partial<z.infer<typeof taskObject>>,
  ctx: z.RefinementCtx,
): void {
  if (v.startDate && v.dueDate && v.dueDate < v.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dueDate'], message: 'Tenggat tidak boleh sebelum tanggal mulai' });
  }
  if (v.optimisticDays != null && v.mostLikelyDays != null && v.optimisticDays > v.mostLikelyDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['optimisticDays'], message: 'Estimasi optimis harus <= estimasi paling mungkin' });
  }
  if (v.mostLikelyDays != null && v.pessimisticDays != null && v.mostLikelyDays > v.pessimisticDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pessimisticDays'], message: 'Estimasi paling mungkin harus <= estimasi pesimis' });
  }
}

export const taskCreate = taskObject.superRefine(taskCrossFieldChecks);

export const taskUpdate = taskObject.partial().superRefine(taskCrossFieldChecks);

export const dependencyCreate = z.object({
  predecessorId: z.coerce.number().int().positive(),
  successorId: z.coerce.number().int().positive(),
  type: z.enum(DEPENDENCY_TYPES).optional().default('FS'),
  lag: z.coerce.number().int().min(-3650).max(3650).optional().default(0),
});

export const dependencyUpdate = dependencyCreate.partial();

export const workdaysUpdate = z.object({
  workdays: z
    .array(z.coerce.number().int().min(0, 'Hari 0 = Minggu').max(6, 'Hari 6 = Sabtu'))
    .min(1, 'Minimal harus ada satu hari kerja')
    .max(7)
    .refine((arr) => new Set(arr).size === arr.length, 'Daftar hari kerja mengandung duplikat'),
});

export const holidayCreate = z.object({
  date: dateStr,
  name: z.string().trim().min(1, 'Nama hari libur wajib diisi').max(200),
});

/** Parse & validasi body JSON; lempar ValidationError 400 bila gagal. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    throw new ValidationError(
      'Data tidak valid',
      result.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message })),
    );
  }
  return result.data;
}

/** Ambil & validasi parameter URL :id menjadi number. */
export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`Parameter ${name} harus berupa angka positif`);
  }
  return num;
}
