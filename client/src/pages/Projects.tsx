import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, STATUS_LABEL, fieldErrors, type Project, type ProjectStatus } from '../api';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { FieldError, toast } from '../components/Toast';
import { Avatar, Button, FormSection, PageHeader, Pill, ProgressBar, SearchInput, Segmented, type Tone } from '../components/ui';
import { errorText, fmtDateLong, fmtDateShort, statusBadge } from '../ui';

const EMPTY_FORM = { name: '', description: '', startDate: '', status: 'planning' as ProjectStatus };

const STATUS_OPTIONS: Array<ProjectStatus> = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

const STATUS_TONE: Record<string, Tone> = {
  planning: 'violet',
  active: 'blue',
  on_hold: 'amber',
  completed: 'mint',
  cancelled: 'slate',
};

type ViewMode = 'card' | 'table';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Project | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ProjectStatus>('');
  const [view, setView] = useState<ViewMode>('card');

  const load = useCallback(() => {
    setLoading(true);
    api.projects
      .list()
      .then(setProjects)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ?baru=1 dari dashboard/topbar -> langsung buka form proyek baru
  useEffect(() => {
    if (searchParams.get('baru') === '1') {
      setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().slice(0, 10) });
      setEditingId(null);
      setFieldErr({});
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setFieldErr({});
  };

  const openEdit = (p: Project) => {
    setForm({ name: p.name, description: p.description, startDate: p.startDate, status: p.status });
    setEditingId(p.id);
    setFieldErr({});
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFieldErr({});
    try {
      if (editingId == null) {
        await api.projects.create(form);
        toast.success(`Proyek "${form.name}" dibuat.`);
      } else {
        await api.projects.update(editingId, form);
        toast.success(`Proyek "${form.name}" diperbarui.`);
      }
      setForm(null);
      load();
    } catch (e) {
      setFieldErr(fieldErrors(e));
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    const p = confirmTarget;
    if (!p) return;
    try {
      await api.projects.remove(p.id);
      toast.success(`Proyek "${p.name}" beserta tugas & dependensinya dihapus.`);
      setConfirmTarget(null);
      load();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.leadName ?? '').toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <>
      <PageHeader
        title="Proyek"
        subtitle="Buat, kelola, dan pantau proyek perangkat lunak beserta jadwal, tugas, dan timnya."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Tambah Proyek
          </Button>
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama proyek atau penanggung jawab…"
          ariaLabel="Cari proyek"
        />
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | ProjectStatus)}
          aria-label="Filter status proyek"
        >
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'card', label: 'Kartu', icon: 'grid' },
            { value: 'table', label: 'Tabel', icon: 'table' },
          ]}
        />
      </div>

      {loading ? (
        <Loading label="Memuat daftar proyek…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="folder"
            title="Belum ada proyek"
            description="Mulai dengan membuat proyek pertama, lalu tambahkan tugas, dependensi, dan jadwalnya."
            action={
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Tambah Proyek
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Tidak ada proyek yang cocok"
            description="Ubah kata kunci pencarian atau atur ulang filter status."
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              >
                Atur ulang filter
              </Button>
            }
          />
        </div>
      ) : view === 'card' ? (
        <div className="project-grid">
          {filtered.map((p) => (
            <article className="project-card" key={p.id}>
              <div className="pc-top">
                <div style={{ minWidth: 0 }}>
                  <h3 className="pc-name">
                    <Link className="link-strong" to={`/projects/${p.id}`}>
                      {p.name}
                    </Link>
                  </h3>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Mulai {fmtDateLong(p.startDate)}
                  </div>
                </div>
                <Pill tone={STATUS_TONE[p.status] ?? 'slate'} dot>
                  {STATUS_LABEL[p.status]}
                </Pill>
              </div>

              <p className="pc-desc">{p.description || 'Tanpa deskripsi'}</p>

              <div className="pc-meta">
                <span>
                  <Icon name="list-todo" size={13} /> {p.taskCount ?? 0} tugas
                </span>
                <span>
                  <Icon name="users" size={13} /> {p.memberCount ?? 0} anggota
                </span>
                {(p.overdueCount ?? 0) > 0 && (
                  <span style={{ color: 'var(--danger-600)' }}>
                    <Icon name="alert-triangle" size={13} /> {p.overdueCount} terlambat
                  </span>
                )}
              </div>

              <div>
                <div className="row spread small muted" style={{ marginBottom: 6 }}>
                  <span>Progres</span>
                  <span>
                    <b style={{ color: 'var(--text)' }}>{p.progress ?? 0}%</b> · {p.doneCount ?? 0}/{p.taskCount ?? 0} selesai
                  </span>
                </div>
                <ProgressBar value={p.progress ?? 0} tone={(p.progress ?? 0) >= 100 ? 'mint' : 'blue'} />
              </div>

              <div className="pc-foot">
                <span className="row small" style={{ gap: 8 }}>
                  {p.leadName ? (
                    <>
                      <Avatar name={p.leadName} size="sm" />
                      <span className="muted truncate" style={{ maxWidth: 130 }}>
                        {p.leadName}
                      </span>
                    </>
                  ) : (
                    <span className="muted small">Belum ada penanggung jawab</span>
                  )}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <Link className="btn btn-sm btn-secondary" to={`/projects/${p.id}`}>
                    <Icon name="eye" size={13} /> Kelola
                  </Link>
                  <Button size="sm" icon="pencil" onClick={() => openEdit(p)} title={`Ubah ${p.name}`}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon="trash"
                    onClick={() => setConfirmTarget(p)}
                    title={`Hapus ${p.name}`}
                  />
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Proyek</th>
                  <th>Status</th>
                  <th>Penanggung jawab</th>
                  <th>Mulai</th>
                  <th>Tugas</th>
                  <th style={{ width: 170 }}>Progres</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="link-strong" to={`/projects/${p.id}`}>
                        {p.name}
                      </Link>
                      <div className="small muted">{p.description || 'Tanpa deskripsi'}</div>
                    </td>
                    <td>
                      <span className={statusBadge(p.status)}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td className="small">
                      {p.leadName ? (
                        <span className="row" style={{ gap: 7 }}>
                          <Avatar name={p.leadName} size="sm" /> {p.leadName}
                        </span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="small">{fmtDateShort(p.startDate)}</td>
                    <td className="small">
                      {p.doneCount ?? 0}/{p.taskCount ?? 0}
                      {(p.overdueCount ?? 0) > 0 && (
                        <span className="pill pill-red" style={{ marginLeft: 8 }}>
                          {p.overdueCount} terlambat
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="progress-cell">
                        <ProgressBar value={p.progress ?? 0} tone={(p.progress ?? 0) >= 100 ? 'mint' : 'blue'} />
                        <b>{p.progress ?? 0}%</b>
                      </div>
                    </td>
                    <td className="actions">
                      <Link className="btn btn-sm btn-secondary" to={`/projects/${p.id}`}>
                        <Icon name="eye" size={13} /> Kelola
                      </Link>
                      <Button size="sm" icon="pencil" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmTarget(p)}>
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <Modal
          title={editingId == null ? 'Proyek baru' : 'Edit proyek'}
          subtitle={editingId == null ? 'Isi informasi dasar proyek.' : 'Perbarui informasi proyek.'}
          onClose={() => setForm(null)}
          footer={
            <>
              <Button onClick={() => setForm(null)}>Batal</Button>
              <Button variant="primary" icon="save" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </>
          }
        >
          <FormSection title="Informasi umum" icon="file-text">
            <div className="form-grid">
              <div className="field span-2">
                <label>
                  Nama proyek <span className="req">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. Sistem Informasi Akademik"
                  autoFocus
                />
                <FieldError message={fieldErr.name} />
              </div>
              <div className="field span-2">
                <label>Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tujuan dan ruang lingkup proyek…"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Penjadwalan & status" icon="calendar">
            <div className="form-grid">
              <div className="field">
                <label>
                  Tanggal mulai <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
                <FieldError message={fieldErr.startDate} />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                >
                  {STATUS_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {STATUS_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        danger
        title="Hapus proyek?"
        message={
          <>
            Proyek <b>{confirmTarget?.name}</b> beserta seluruh tugas, subtugas, dan dependensinya akan dihapus
            permanen. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDelete}
        onDismiss={() => setConfirmTarget(null)}
      />
    </>
  );
}
