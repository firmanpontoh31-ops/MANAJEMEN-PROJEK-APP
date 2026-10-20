import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type Dependency,
  type DependencyType,
  type Member,
  type Task,
} from '../api';
import Icon from './Icon';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState, ErrorState, Loading } from './States';
import TaskFormModal from './TaskFormModal';
import { TaskKanban, TaskTable } from './TaskViews';
import { toast } from './Toast';
import { Button, Card, PageHeader, SearchInput, Segmented, Pill } from './ui';
import { errorText } from '../ui';

type ViewMode = 'table' | 'kanban';
type Panel = 'tasks' | 'dependencies';

const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];

export default function TasksTab({ projectId, onChange }: { projectId: number; onChange: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('table');
  const [panel, setPanel] = useState<Panel>('tasks');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Task | null>(null);
  const [creatingParent, setCreatingParent] = useState<number | null | undefined>(undefined);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [confirmDep, setConfirmDep] = useState<Dependency | null>(null);

  const [depForm, setDepForm] = useState({
    predecessorId: '',
    successorId: '',
    type: 'FS' as DependencyType,
    lag: '0',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.tasks.list(projectId),
      api.projects.members(projectId),
      api.dependencies.list(projectId),
    ])
      .then(([t, m, d]) => {
        setTasks(t);
        setMembers(m);
        setDeps(d);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const taskName = (id: number) => tasks.find((t) => t.id === id)?.name ?? `Tugas #${id}`;

  /* ------------------------------ Tugas ------------------------------ */

  const doDeleteTask = async () => {
    const t = confirmTask;
    if (!t) return;
    try {
      await api.tasks.remove(t.id);
      toast.success(`Tugas "${t.name}" dihapus.`);
      setConfirmTask(null);
      load();
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  /* --------------------------- Dependensi ---------------------------- */

  const addDep = async () => {
    if (!depForm.predecessorId || !depForm.successorId) {
      toast.error('Pilih predecessor dan successor terlebih dahulu.');
      return;
    }
    if (depForm.predecessorId === depForm.successorId) {
      toast.error('Predecessor dan successor tidak boleh tugas yang sama.');
      return;
    }
    try {
      await api.dependencies.create(projectId, {
        predecessorId: Number(depForm.predecessorId),
        successorId: Number(depForm.successorId),
        type: depForm.type,
        lag: Number(depForm.lag) || 0,
      });
      setDepForm({ predecessorId: '', successorId: '', type: 'FS', lag: '0' });
      load();
      onChange();
      toast.success('Dependensi ditambahkan.');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const updateDep = async (d: Dependency, patch: Partial<Dependency>) => {
    try {
      await api.dependencies.update(d.id, patch);
      load();
      onChange();
      toast.success('Dependensi diperbarui.');
    } catch (e) {
      toast.error(errorText(e));
      load(); // kembalikan nilai lama bila ditolak backend
    }
  };

  const doDeleteDep = async () => {
    const d = confirmDep;
    if (!d) return;
    try {
      await api.dependencies.remove(d.id);
      setConfirmDep(null);
      load();
      onChange();
      toast.success('Dependensi dihapus.');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (loading) return <Loading label="Memuat tugas & dependensi…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const subtaskCount = tasks.filter((t) => t.parentId != null).length;

  return (
    <>
      <PageHeader
        title="Tugas & dependensi"
        subtitle="Susun rencana kerja proyek: tugas induk, subtugas berjenjang, dan urutan kerja antar tugas."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Tabel', icon: 'table' },
                { value: 'kanban', label: 'Kanban', icon: 'kanban' },
              ]}
            />
            <Button variant="primary" icon="plus" onClick={() => setCreatingParent(null)}>
              Tugas baru
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <Segmented
          value={panel}
          onChange={setPanel}
          options={[
            { value: 'tasks', label: `Tugas (${tasks.length})`, icon: 'list-todo' },
            { value: 'dependencies', label: `Dependensi (${deps.length})`, icon: 'link' },
          ]}
        />
        {panel === 'tasks' && (
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari tugas…"
              ariaLabel="Cari tugas proyek"
            />
            <span className="toolbar-spacer" />
            <span className="small muted">
              {subtaskCount} subtugas · {deps.length} dependensi
            </span>
          </>
        )}
      </div>

      {panel === 'tasks' ? (
        tasks.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="list-todo"
              title="Belum ada tugas"
              description="Susun rencana kerja dengan menambahkan tugas induk, lalu subtugas di bawahnya."
              action={
                <Button variant="primary" icon="plus" onClick={() => setCreatingParent(null)}>
                  Tugas baru
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="search"
              title="Tidak ada tugas yang cocok"
              description="Ubah kata kunci pencarian untuk melihat tugas lain."
              action={<Button onClick={() => setSearch('')}>Atur ulang pencarian</Button>}
            />
          </div>
        ) : view === 'table' ? (
          <div className="card" style={{ padding: 0 }}>
            <TaskTable
              tasks={filtered}
              onEdit={setEditing}
              onDelete={setConfirmTask}
              onAddSubtask={(t) => setCreatingParent(t.id)}
            />
          </div>
        ) : (
          <TaskKanban tasks={filtered} showProject={false} onOpen={setEditing} />
        )
      ) : (
        <Card
          title={
            <>
              <Icon name="link" size={16} /> Dependensi antartugas
            </>
          }
          subtitle="FS (finish–start), SS (start–start), FF (finish–finish), SF (start–finish) dengan lag dalam hari kerja."
        >
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <div className="field">
              <label>Predecessor (sebelum)</label>
              <select
                value={depForm.predecessorId}
                onChange={(e) => setDepForm({ ...depForm, predecessorId: e.target.value })}
              >
                <option value="">— pilih tugas —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Successor (sesudah)</label>
              <select
                value={depForm.successorId}
                onChange={(e) => setDepForm({ ...depForm, successorId: e.target.value })}
              >
                <option value="">— pilih tugas —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tipe dependensi</label>
              <select
                value={depForm.type}
                onChange={(e) => setDepForm({ ...depForm, type: e.target.value as DependencyType })}
              >
                {DEP_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x} — {x === 'FS' ? 'Finish to Start' : x === 'SS' ? 'Start to Start' : x === 'FF' ? 'Finish to Finish' : 'Start to Finish'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Lag (hari kerja)</label>
              <input
                type="number"
                value={depForm.lag}
                onChange={(e) => setDepForm({ ...depForm, lag: e.target.value })}
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <Button variant="primary" icon="plus" onClick={addDep}>
                Tambah dependensi
              </Button>
            </div>
          </div>

          {deps.length === 0 ? (
            <EmptyState
              icon="link"
              title="Belum ada dependensi"
              description="Tanpa dependensi, semua tugas dijadwalkan bebas. Tambahkan urutan kerja agar Gantt dan CPM akurat."
            />
          ) : (
            <div className="table-wrap">
              <table className="data" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Predecessor</th>
                    <th />
                    <th>Successor</th>
                    <th>Tipe</th>
                    <th>Lag</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deps.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.predecessorName ?? taskName(d.predecessorId)}</td>
                      <td className="small muted">
                        <Icon name="arrow-right" size={14} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{d.successorName ?? taskName(d.successorId)}</td>
                      <td>
                        <Pill tone="violet">{d.type}</Pill>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 84, padding: '5px 9px' }}
                          value={d.lag}
                          onChange={(e) => updateDep(d, { lag: Number(e.target.value) || 0 })}
                          aria-label="Ubah lag dependensi"
                        />
                      </td>
                      <td className="actions">
                        <Button
                          size="sm"
                          variant="danger"
                          icon="trash"
                          onClick={() => setConfirmDep(d)}
                          title="Hapus dependensi"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {creatingParent !== undefined && (
        <TaskFormModal
          projectId={projectId}
          members={members}
          parentId={creatingParent}
          onClose={() => setCreatingParent(undefined)}
          onSaved={() => {
            load();
            onChange();
          }}
        />
      )}

      {editing && (
        <TaskFormModal
          projectId={projectId}
          members={members}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            onChange();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmTask != null}
        danger
        title="Hapus tugas?"
        message={
          <>
            Tugas <b>{confirmTask?.name}</b>
            {confirmTask && tasks.filter((x) => x.parentId === confirmTask.id).length > 0
              ? ` beserta ${tasks.filter((x) => x.parentId === confirmTask.id).length} subtugas`
              : ''}{' '}
            dan seluruh dependensinya akan dihapus permanen.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDeleteTask}
        onDismiss={() => setConfirmTask(null)}
      />

      <ConfirmDialog
        open={confirmDep != null}
        danger
        title="Hapus dependensi?"
        message={
          <>
            Ketergantungan <b>{confirmDep ? taskName(confirmDep.predecessorId) : ''}</b> menu{' '}
            <b>{confirmDep ? taskName(confirmDep.successorId) : ''}</b> akan dihapus, dan jadwal dihitung ulang.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDeleteDep}
        onDismiss={() => setConfirmDep(null)}
      />
    </>
  );
}
