/* Klien API terpusat untuk backend Express (proxy Vite /api -> :3001) */

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function fieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d && typeof d === 'object' && 'field' in d && 'message' in d) {
        out[String((d as { field: unknown }).field)] = String((d as { message: unknown }).message);
      }
    }
  }
  return out;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      ...options,
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan backend berjalan di port 3001.', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const body = data as { error?: string; details?: unknown } | null;
    throw new ApiError(body?.error ?? `Kesalahan HTTP ${res.status}`, res.status, body?.details);
  }
  return data as T;
}

/* ------------------------------- Tipe data ------------------------------- */

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
  taskCount?: number;
  doneCount?: number;
  overdueCount?: number;
  progress?: number;
  memberCount?: number;
  leadName?: string | null;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  projectCount?: number;
  taskCount?: number;
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
  assigneeName?: string | null;
  projectName?: string;
  projectStatus?: ProjectStatus;
  children?: Array<{ id: number; name: string; status: string; duration: number; progress: number }>;
}

/** Daftar tugas lintas proyek (halaman Tugas). */
export interface TaskFilters {
  projectId?: number;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: number;
  q?: string;
}

export interface ActivityItem {
  kind: 'task' | 'project';
  id: number;
  name: string;
  status: string;
  progress: number;
  projectId: number;
  projectName: string;
  updatedAt: string;
}

export interface Dependency {
  id: number;
  projectId: number;
  predecessorId: number;
  successorId: number;
  type: DependencyType;
  lag: number;
  predecessorName?: string | null;
  successorName?: string | null;
}

export interface WorkdaySetting {
  dayOfWeek: number;
  isWorking: boolean;
  label: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface CalendarData {
  workdays: WorkdaySetting[];
  holidays: Holiday[];
}

export interface ScheduleTask {
  id: number;
  name: string;
  duration: number;
  baselineStart: string | null;
  es: string;
  ef: string;
  ls: string;
  lf: string;
  float: number;
  critical: boolean;
  parentId: number | null;
  status: TaskStatus;
  priority: Priority;
  progress: number;
  dueDate: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
}

export interface ScheduleResult {
  projectId: number;
  projectName: string;
  calendarStart: string;
  startDate: string;
  finishDate: string;
  projectDurationWorkdays: number;
  taskCount: number;
  skippedCancelled: number;
  warnings: string[];
  tasks: ScheduleTask[];
}

export interface PertTask {
  id: number;
  name: string;
  duration: number;
  status: string;
  optimistic: number | null;
  mostLikely: number | null;
  pessimistic: number | null;
  te: number | null;
  sd: number | null;
  variance: number | null;
  hasEstimates: boolean;
}

export interface PertResult {
  projectId: number;
  projectName: string;
  formula: { expected: string; sd: string; variance: string };
  tasks: PertTask[];
  missingEstimates: Array<{ id: number; name: string }>;
  summary: {
    totalTasks: number;
    estimatedTasks: number;
    teSum: number;
    varianceSum: number;
    sd: number;
    optimisticSum: number;
    pessimisticSum: number;
  };
}

export interface CriticalPath {
  taskIds: number[];
  taskNames: string[];
  lengthWorkdays: number;
}

export interface CpmResult {
  projectId: number;
  projectName: string;
  startDate: string;
  finishDate: string;
  projectDurationWorkdays: number;
  criticalTaskCount: number;
  criticalPaths: CriticalPath[];
  pert: {
    pathTaskCount: number;
    estimatedOnPath: number;
    teSum: number;
    varianceSum: number;
    sd: number;
    optimisticSum: number;
    pessimisticSum: number;
    note: string;
  } | null;
  warnings: string[];
  tasks: ScheduleTask[];
}

export interface DashboardData {
  today: string;
  projects: {
    total: number;
    planning: number;
    active: number;
    onHold: number;
    completed: number;
    cancelled: number;
  };
  tasks: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    review: number;
    cancelled: number;
    overdue: number;
    dueSoon: number;
  };
  progress: number;
  dueSoonTasks: Array<{
    id: number;
    name: string;
    dueDate: string;
    progress: number;
    status: TaskStatus;
    priority: Priority;
    projectId: number;
    projectName: string;
    assigneeName: string | null;
  }>;
  overdueTasks: Array<{
    id: number;
    name: string;
    dueDate: string;
    progress: number;
    status: TaskStatus;
    priority: Priority;
    projectId: number;
    projectName: string;
    assigneeName: string | null;
  }>;
  recentProjects: Array<{
    id: number;
    name: string;
    status: ProjectStatus;
    startDate: string;
    taskCount: number;
    doneCount: number;
    progress: number;
  }>;
}

/* ------------------------------- Endpoint -------------------------------- */

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  dashboard: () => request<DashboardData>('/api/dashboard'),
  activity: (limit = 8) => request<{ items: ActivityItem[] }>(`/api/dashboard/activity?limit=${limit}`),
  projects: {
    list: () => request<Project[]>('/api/projects'),
    get: (id: number) => request<Project>(`/api/projects/${id}`),
    create: (body: Partial<Project>) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Project>) =>
      request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => request<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
    members: (id: number) => request<Member[]>(`/api/projects/${id}/members`),
    addMember: (id: number, body: { memberId?: number; name?: string; email?: string; role?: string }) =>
      request<Member>(`/api/projects/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
    removeMember: (id: number, memberId: number) =>
      request<{ deleted: boolean }>(`/api/projects/${id}/members/${memberId}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (projectId: number) => request<Task[]>(`/api/projects/${projectId}/tasks`),
    all: (filters: TaskFilters = {}) => {
      const params = new URLSearchParams();
      if (filters.projectId != null) params.set('projectId', String(filters.projectId));
      if (filters.status != null) params.set('status', filters.status);
      if (filters.priority != null) params.set('priority', filters.priority);
      if (filters.assigneeId != null) params.set('assigneeId', String(filters.assigneeId));
      if (filters.q) params.set('q', filters.q);
      const qs = params.toString();
      return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
    },
    get: (id: number) => request<Task>(`/api/tasks/${id}`),
    create: (projectId: number, body: Partial<Task>) =>
      request<Task>(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Task>) =>
      request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => request<{ deleted: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  },
  members: {
    list: () => request<Member[]>('/api/members'),
    create: (body: Partial<Member>) => request<Member>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Member>) =>
      request<Member>(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => request<{ deleted: boolean }>(`/api/members/${id}`, { method: 'DELETE' }),
  },
  calendar: {
    get: () => request<CalendarData>('/api/calendar'),
    setWorkdays: (workdays: number[]) =>
      request<{ workdays: WorkdaySetting[] }>('/api/calendar/workdays', {
        method: 'PUT',
        body: JSON.stringify({ workdays }),
      }),
    addHoliday: (body: { date: string; name: string }) =>
      request<Holiday>('/api/calendar/holidays', { method: 'POST', body: JSON.stringify(body) }),
    removeHoliday: (id: number) => request<{ deleted: boolean }>(`/api/calendar/holidays/${id}`, { method: 'DELETE' }),
  },
  dependencies: {
    list: (projectId: number) => request<Dependency[]>(`/api/projects/${projectId}/dependencies`),
    create: (projectId: number, body: Partial<Dependency>) =>
      request<Dependency>(`/api/projects/${projectId}/dependencies`, { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Dependency>) =>
      request<Dependency>(`/api/dependencies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => request<{ deleted: boolean }>(`/api/dependencies/${id}`, { method: 'DELETE' }),
  },
  analysis: {
    schedule: (projectId: number) => request<ScheduleResult>(`/api/projects/${projectId}/schedule`),
    pert: (projectId: number) => request<PertResult>(`/api/projects/${projectId}/pert`),
    cpm: (projectId: number) => request<CpmResult>(`/api/projects/${projectId}/cpm`),
  },
};

/* -------------------------------- Label ---------------------------------- */

export const STATUS_LABEL: Record<string, string> = {
  planning: 'Perencanaan',
  active: 'Aktif',
  on_hold: 'Tertunda',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  todo: 'Belum mulai',
  in_progress: 'Berjalan',
  review: 'Review',
  done: 'Selesai',
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis',
};

export const fmtDate = (iso: string | null | undefined): string => (iso ? iso.split('-').reverse().join('/') : '-');
