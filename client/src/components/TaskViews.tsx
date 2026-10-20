import { useMemo } from 'react';
import { PRIORITY_LABEL, STATUS_LABEL, type Task } from '../api';
import Icon from './Icon';
import { Avatar, Pill, ProgressBar } from './ui';
import { PRIORITY_TONE, STATUS_TONE, fmtDateShort } from '../ui';

export const KANBAN_COLUMNS: Task['status'][] = ['todo', 'in_progress', 'review', 'done'];

export interface TaskRow {
  task: Task;
  depth: number;
}

/** Mengurutkan tugas menjadi hierarki induk → subtugas (aman terhadap siklus). */
export function buildTaskTree(tasks: Task[]): TaskRow[] {
  const byParent = new Map<number | null, Task[]>();
  for (const t of tasks) {
    const arr = byParent.get(t.parentId);
    if (arr) arr.push(t);
    else byParent.set(t.parentId, [t]);
  }
  const out: TaskRow[] = [];
  const walk = (parent: number | null, depth: number, guard: number) => {
    if (guard > 200) return;
    for (const t of byParent.get(parent) ?? []) {
      out.push({ task: t, depth });
      walk(t.id, depth + 1, guard + 1);
    }
  };
  walk(null, 0, 0);
  const seen = new Set(out.map((r) => r.task.id));
  for (const t of tasks) if (!seen.has(t.id)) out.push({ task: t, depth: 0 });
  return out;
}

/* --------------------------------- Tabel -------------------------------- */

export function TaskTable({
  tasks,
  showProject = false,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  tasks: Task[];
  showProject?: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAddSubtask?: (t: Task) => void;
}) {
  const rows = useMemo(() => buildTaskTree(tasks), [tasks]);

  if (rows.length === 0) return null;

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Tugas</th>
            {showProject && <th>Proyek</th>}
            <th>Mulai</th>
            <th>Durasi</th>
            <th>Tenggat</th>
            <th>Status</th>
            <th>Prioritas</th>
            <th>Penugasan</th>
            <th style={{ width: 150 }}>Progres</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, depth }) => (
            <tr key={task.id}>
              <td>
                <div className="row" style={{ gap: 8, flexWrap: 'nowrap', paddingLeft: depth * 18 }}>
                  {depth > 0 && <Icon name="corner-down-right" size={13} className="muted" />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: depth > 0 ? 550 : 650 }}>{task.name}</div>
                    {task.description && (
                      <div className="small muted truncate" style={{ maxWidth: 320 }}>
                        {task.description}
                      </div>
                    )}
                    {(task.optimisticDays != null || task.mostLikelyDays != null) && (
                      <span className="pill pill-violet" style={{ marginTop: 4 }}>
                        PERT · O {task.optimisticDays ?? '-'} · M {task.mostLikelyDays ?? '-'} · P{' '}
                        {task.pessimisticDays ?? '-'}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              {showProject && <td className="small">{task.projectName ?? '-'}</td>}
              <td className="small">{task.startDate ? fmtDateShort(task.startDate) : 'Otomatis'}</td>
              <td className="small">{task.duration} hr</td>
              <td className="small">{task.dueDate ? fmtDateShort(task.dueDate) : '-'}</td>
              <td>
                <Pill tone={STATUS_TONE[task.status] ?? 'slate'} dot>
                  {STATUS_LABEL[task.status]}
                </Pill>
              </td>
              <td>
                <Pill tone={PRIORITY_TONE[task.priority] ?? 'slate'}>{PRIORITY_LABEL[task.priority]}</Pill>
              </td>
              <td className="small">
                {task.assigneeName ? (
                  <span className="row" style={{ gap: 7 }}>
                    <Avatar name={task.assigneeName} size="sm" /> {task.assigneeName}
                  </span>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>
                <div className="progress-cell">
                  <ProgressBar value={task.progress} tone={task.progress >= 100 ? 'mint' : 'blue'} />
                  <b>{task.progress}%</b>
                </div>
              </td>
              <td className="actions">
                {onAddSubtask && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onAddSubtask(task)}
                    title="Tambah subtugas"
                    aria-label={`Tambah subtugas di bawah ${task.name}`}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                )}
                <button
                  className="btn btn-sm"
                  onClick={() => onEdit(task)}
                  title="Ubah tugas"
                  aria-label={`Ubah ${task.name}`}
                >
                  <Icon name="pencil" size={13} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onDelete(task)}
                  title="Hapus tugas"
                  aria-label={`Hapus ${task.name}`}
                >
                  <Icon name="trash" size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- Kanban -------------------------------- */

const COLUMN_COLOR: Record<string, string> = {
  todo: 'var(--text-3)',
  in_progress: 'var(--primary)',
  review: 'var(--violet)',
  done: 'var(--mint)',
  cancelled: 'var(--border-strong)',
};

export function TaskKanban({
  tasks,
  showProject = true,
  onOpen,
}: {
  tasks: Task[];
  showProject?: boolean;
  onOpen: (t: Task) => void;
}) {
  const columns = useMemo(() => {
    const cancelled = tasks.filter((t) => t.status === 'cancelled');
    const cols = KANBAN_COLUMNS.map((status) => ({
      status,
      items: tasks.filter((t) => t.status === status),
    }));
    if (cancelled.length > 0) cols.push({ status: 'cancelled' as Task['status'], items: cancelled });
    return cols;
  }, [tasks]);

  return (
    <div className="kanban">
      {columns.map((col) => (
        <section className="kanban-col" key={col.status}>
          <header className="kanban-col-head">
            <span className="kch-title">
              <span className="pill-dot" style={{ color: COLUMN_COLOR[col.status] }} />
              {STATUS_LABEL[col.status]}
            </span>
            <span className="kanban-count">{col.items.length}</span>
          </header>
          <div className="kanban-list">
            {col.items.length === 0 ? (
              <p className="small muted" style={{ padding: '6px 2px' }}>
                Tidak ada tugas.
              </p>
            ) : (
              col.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="kanban-card"
                  onClick={() => onOpen(t)}
                  style={{ textAlign: 'left' }}
                >
                  <span className="kc-title">{t.name}</span>
                  {showProject && t.projectName && (
                    <span className="kc-project">
                      <Icon name="folder" size={12} /> {t.projectName}
                    </span>
                  )}
                  <span className="kc-foot">
                    <Pill tone={PRIORITY_TONE[t.priority] ?? 'slate'}>{PRIORITY_LABEL[t.priority]}</Pill>
                    {t.assigneeName ? (
                      <Avatar name={t.assigneeName} size="sm" />
                    ) : (
                      <span className="small muted">Tanpa assignee</span>
                    )}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <ProgressBar value={t.progress} tone={t.progress >= 100 ? 'mint' : 'blue'} />
                    <span className="small muted" style={{ minWidth: 30, textAlign: 'right' }}>
                      {t.progress}%
                    </span>
                  </span>
                  {t.dueDate && (
                    <span className="small muted">
                      <Icon name="calendar" size={12} /> Tenggat {fmtDateShort(t.dueDate)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
