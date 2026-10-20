export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Task {
  id: number;
  projectId: number;
  parentId: number | null;
  name: string;
  description: string;
  startDate: string | null;
  duration: number;
  dueDate: string | null;
  status: TaskStatus;
  priority: Priority;
  progress: number;
  assigneeId: number | null;
  optimisticDays: number | null;
  mostLikelyDays: number | null;
  pessimisticDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: number;
  projectId: number;
  predecessorId: number;
  successorId: number;
  type: DependencyType;
  lag: number;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface WorkdaySetting {
  dayOfWeek: number;
  isWorking: boolean;
}

/* ---------- pemetaan row (snake_case) -> objek (camelCase) ---------- */

export type Row = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? '' : String(v));
const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const nn = (v: unknown): number | null => (v == null ? null : Number(v));

export function toProject(r: Row): Project {
  return {
    id: n(r.id),
    name: s(r.name),
    description: s(r.description),
    startDate: s(r.startDate),
    status: s(r.status) as ProjectStatus,
    createdAt: s(r.createdAt),
    updatedAt: s(r.updatedAt),
  };
}

export function toMember(r: Row): Member {
  return {
    id: n(r.id),
    name: s(r.name),
    email: s(r.email),
    role: s(r.role),
    createdAt: s(r.createdAt),
  };
}

export function toTask(r: Row): Task {
  return {
    id: n(r.id),
    projectId: n(r.projectId),
    parentId: r.parentId == null ? null : n(r.parentId),
    name: s(r.name),
    description: s(r.description),
    startDate: r.startDate == null ? null : s(r.startDate),
    duration: n(r.duration),
    dueDate: r.dueDate == null ? null : s(r.dueDate),
    status: s(r.status) as TaskStatus,
    priority: s(r.priority) as Priority,
    progress: n(r.progress),
    assigneeId: r.assigneeId == null ? null : n(r.assigneeId),
    optimisticDays: r.optimisticDays == null ? null : nn(r.optimisticDays),
    mostLikelyDays: r.mostLikelyDays == null ? null : nn(r.mostLikelyDays),
    pessimisticDays: r.pessimisticDays == null ? null : nn(r.pessimisticDays),
    createdAt: s(r.createdAt),
    updatedAt: s(r.updatedAt),
  };
}

export function toDependency(r: Row): Dependency {
  return {
    id: n(r.id),
    projectId: n(r.projectId),
    predecessorId: n(r.predecessorId),
    successorId: n(r.successorId),
    type: s(r.type) as DependencyType,
    lag: n(r.lag),
  };
}

export function toHoliday(r: Row): Holiday {
  return { id: n(r.id), date: s(r.date), name: s(r.name) };
}
