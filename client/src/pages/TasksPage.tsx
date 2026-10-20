import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Member,
  type Priority,
  type Project,
  type Task,
  type TaskStatus,
} from '../api';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../components/States';
import TaskFormModal from '../components/TaskFormModal';
import { TaskKanban, TaskTable } from '../components/TaskViews';
import { toast } from '../components/Toast';
import { Button, PageHeader, SearchInput, Segmented } from '../components/ui';
import { errorText } from '../ui';

type ViewMode = 'table' | 'kanban';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'critical'];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [view, setView] = useState<ViewMode>('table');

  const [editing, setEditing] = useState<Task | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<number | null>(null);
  const [pickProject, setPickProject] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Task | null>(null);
  const [projectMembers, setProjectMembers] = useState<Member[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.tasks.all({
        projectId: projectId ? Number(projectId) : undefined,
        status: (status || undefined) as TaskStatus | undefined,
        priority: (priority || undefined) as Priority | undefined,
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        q: search.trim() || undefined,
      }),
      api.projects.list(),
      api.members.list(),
    ])
      .then(([t, p, m]) => {
        setTasks(t);
        setProjects(p);
        setMembers(m);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [projectId, status, priority, assigneeId, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Muat anggota proyek terpilih untuk form tugas
  useEffect(() => {
    const pid = editing?.projectId ?? creatingProjectId ?? (projectId ? Number(projectId) : null);
    if (pid == null) {
      setProjectMembers([]);
      return;
    }
    api.projects
      .members(pid)
      .then(setProjectMembers)
      .catch(() => setProjectMembers([]));
  }, [editing, creatingProjectId, projectId]);

  const doDelete = async () => {
    const t = confirmTarget;
    if (!t) return;
    try {
      await api.tasks.remove(t.id);
      toast.success(`Tugas "${t.name}" dihapus.`);
      setConfirmTarget(null);
      load();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { todo: 0, in_progress: 0, review: 0, done: 0, cancelled: 0 };
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const hasFilter =
    search.trim() !== '' || projectId !== '' || status !== '' || priority !== '' || assigneeId !== '';

  const resetFilters = () => {
    setSearch('');
    setProjectId('');
    setStatus('');
    setPriority('');
    setAssigneeId('');
  };

  const openKanbanTask = (t: Task) => {
    setEditing(t);
  };

  // Saat membuat tugas baru, proyek wajib dipilih lebih dulu.
  const startCreate = () => {
    if (projectId) {
      setCreatingProjectId(Number(projectId));
      return;
    }
    setPickProject(true);
  };

  return (
    <>
      <PageHeader
        title="Tugas"
        subtitle="Kelola seluruh tugas lintas proyek: saring, tampilkan sebagai tabel atau papan, lalu perbarui progress pekerjaan tim."
        actions={
          <>
            <Button icon="refresh" onClick={load}>
              Muat ulang
            </Button>
            <Button variant="primary" icon="plus" onClick={startCreate}>
              Tugas baru
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama atau deskripsi tugas…"
          ariaLabel="Cari tugas"
        />
        <select
          className="select"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Filter proyek"
        >
          <option value="">Semua proyek</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status tugas"
        >
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
        <select
          className="select"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filter prioritas tugas"
        >
          <option value="">Semua prioritas</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          aria-label="Filter anggota"
        >
          <option value="">Semua anggota</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'table', label: 'Tabel', icon: 'table' },
            { value: 'kanban', label: 'Kanban', icon: 'kanban' },
          ]}
        />
      </div>

      {hasFilter && (
        <div className="row spread" style={{ marginBottom: 12 }}>
          <span className="small muted">
            Menampilkan {tasks.length} tugas berdasarkan filter aktif.
          </span>
          <Button size="sm" icon="x" onClick={resetFilters}>
            Atur ulang filter
          </Button>
        </div>
      )}

      {loading ? (
        <Loading label="Memuat tugas…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="list-todo"
            title={hasFilter ? 'Tidak ada tugas yang cocok' : 'Belum ada tugas'}
            description={
              hasFilter
                ? 'Ubah kata kunci atau atur ulang filter untuk melihat tugas lain.'
                : 'Tambahkan tugas pertama untuk mulai menyusun rencana kerja proyek.'
            }
            action={
              hasFilter ? (
                <Button onClick={resetFilters}>Atur ulang filter</Button>
              ) : (
                <Button variant="primary" icon="plus" onClick={startCreate}>
                  Tugas baru
                </Button>
              )
            }
          />
        </div>
      ) : view === 'table' ? (
        <div className="card" style={{ padding: 0 }}>
          <TaskTable
            tasks={tasks}
            showProject
            onEdit={setEditing}
            onDelete={setConfirmTarget}
          />
        </div>
      ) : (
        <TaskKanban tasks={tasks} showProject onOpen={openKanbanTask} />
      )}

      {pickProject && (
        <Modal
          title="Pilih proyek"
          subtitle="Tugas baru harus menempel pada satu proyek."
          size="sm"
          onClose={() => setPickProject(false)}
          footer={
            <Button onClick={() => setPickProject(false)}>Batal</Button>
          }
        >
          {projects.length === 0 ? (
            <EmptyState
              icon="folder"
              title="Belum ada proyek"
              description="Buat proyek terlebih dahulu sebelum menambahkan tugas."
              action={
                <Link className="btn btn-primary" to="/projects">
                  Ke daftar proyek
                </Link>
              }
            />
          ) : (
            <div className="field">
              <label>Proyek</label>
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setCreatingProjectId(Number(e.target.value));
                  setPickProject(false);
                }}
              >
                <option value="">— pilih proyek —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Modal>
      )}

      {creatingProjectId != null && (
        <TaskFormModal
          projectId={creatingProjectId}
          members={projectMembers}
          onClose={() => setCreatingProjectId(null)}
          onSaved={load}
        />
      )}

      {editing && (
        <TaskFormModal
          projectId={editing.projectId}
          members={projectMembers}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        danger
        title="Hapus tugas?"
        message={
          <>
            Tugas <b>{confirmTarget?.name}</b>
            {confirmTarget && tasks.some((x) => x.parentId === confirmTarget.id)
              ? ` beserta ${tasks.filter((x) => x.parentId === confirmTarget.id).length} subtugas`
              : ''}{' '}
            akan dihapus permanen beserta dependensinya.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDelete}
        onDismiss={() => setConfirmTarget(null)}
      />

      <p className="small muted" style={{ marginTop: 18 }}>
        <Icon name="info" size={13} /> Klik kartu pada mode Kanban untuk membuka detail tugas.
      </p>
    </>
  );
}
