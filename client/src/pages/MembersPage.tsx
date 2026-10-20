import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fieldErrors, type Member } from '../api';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { FieldError, toast } from '../components/Toast';
import { Avatar, Button, Card, FormSection, PageHeader, Pill, ProgressBar, SearchInput, Segmented } from '../components/ui';
import { errorText } from '../ui';

const EMPTY = { name: '', email: '', role: '' };

type ViewMode = 'card' | 'table';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Member | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('card');

  const load = useCallback(() => {
    setLoading(true);
    api.members
      .list()
      .then((m) => {
        setMembers(m);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY, role: 'member' });
    setEditingId(null);
    setFieldErr({});
  };

  const openEdit = (m: Member) => {
    setForm({ name: m.name, email: m.email, role: m.role });
    setEditingId(m.id);
    setFieldErr({});
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFieldErr({});
    try {
      if (editingId == null) {
        await api.members.create(form);
        toast.success(`Anggota "${form.name}" ditambahkan.`);
      } else {
        await api.members.update(editingId, form);
        toast.success(`Anggota "${form.name}" diperbarui.`);
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
    const m = confirmTarget;
    if (!m) return;
    try {
      await api.members.remove(m.id);
      toast.success(`Anggota "${m.name}" dihapus; penugasan tugasnya dilepas otomatis.`);
      setConfirmTarget(null);
      load();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.role ?? '').toLowerCase().includes(q),
    );
  }, [members, search]);

  const totals = useMemo(() => {
    const totalTasks = members.reduce((a, m) => a + (m.taskCount ?? 0), 0);
    const maxTasks = members.reduce((a, m) => Math.max(a, m.taskCount ?? 0), 0);
    const busiest = members.reduce<Member | null>(
      (best, m) => ((m.taskCount ?? 0) > (best?.taskCount ?? -1) ? m : best),
      null,
    );
    return { totalTasks, maxTasks, busiest };
  }, [members]);

  return (
    <>
      <PageHeader
        title="Sumber daya"
        subtitle="Kelola anggota tim lintas proyek beserta beban kerja yang sedang ditugaskan kepada mereka."
        actions={
          <Button variant="primary" icon="user-plus" onClick={openCreate}>
            Anggota baru
          </Button>
        }
      />

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Total anggota</span>
            <span className="kpi-icon">
              <Icon name="users" size={16} />
            </span>
          </div>
          <span className="kpi-value blue">{members.length}</span>
          <span className="kpi-hint">Tersedia untuk seluruh proyek</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas ditugaskan</span>
            <span className="kpi-icon violet">
              <Icon name="list-todo" size={16} />
            </span>
          </div>
          <span className="kpi-value">{totals.totalTasks}</span>
          <span className="kpi-hint">Seluruh tugas aktif di tim</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Beban terberat</span>
            <span className="kpi-icon amber">
              <Icon name="trending-up" size={16} />
            </span>
          </div>
          <span className="kpi-value amber" style={{ fontSize: 19 }}>
            {totals.busiest?.name ?? '—'}
          </span>
          <span className="kpi-hint">
            {totals.busiest ? `${totals.busiest.taskCount ?? 0} tugas` : 'Belum ada penugasan'}
          </span>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama, email, atau peran…"
          ariaLabel="Cari anggota tim"
        />
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
        <Loading label="Memuat anggota tim…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : members.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="users"
            title="Belum ada anggota tim"
            description="Tambahkan anggota agar tugas dapat ditugaskan kepada orang yang tepat."
            action={
              <Button variant="primary" icon="user-plus" onClick={openCreate}>
                Anggota baru
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Tidak ada anggota yang cocok"
            description="Ubah kata kunci pencarian untuk melihat anggota lain."
            action={<Button onClick={() => setSearch('')}>Atur ulang pencarian</Button>}
          />
        </div>
      ) : view === 'card' ? (
        <div className="project-grid">
          {filtered.map((m) => (
            <article className="project-card" key={m.id}>
              <div className="pc-top">
                <div className="row" style={{ gap: 11, flexWrap: 'nowrap', minWidth: 0 }}>
                  <Avatar name={m.name} />
                  <div style={{ minWidth: 0 }}>
                    <h3 className="pc-name">{m.name}</h3>
                    <div className="small muted truncate">{m.role || 'member'}</div>
                  </div>
                </div>
                <Pill tone="blue">{m.projectCount ?? 0} proyek</Pill>
              </div>

              <div className="pc-meta">
                <span>
                  <Icon name="mail" size={13} /> {m.email || 'tanpa email'}
                </span>
                <span>
                  <Icon name="list-todo" size={13} /> {m.taskCount ?? 0} tugas
                </span>
              </div>

              <div>
                <div className="row spread small muted" style={{ marginBottom: 6 }}>
                  <span>Beban kerja</span>
                  <span>
                    <b style={{ color: 'var(--text)' }}>{m.taskCount ?? 0}</b> tugas
                  </span>
                </div>
                <ProgressBar
                  value={totals.maxTasks > 0 ? ((m.taskCount ?? 0) / totals.maxTasks) * 100 : 0}
                  tone={(m.taskCount ?? 0) === totals.maxTasks && totals.maxTasks > 0 ? 'amber' : 'blue'}
                />
              </div>

              <div className="pc-foot">
                <span className="small muted">Terakhir ditambahkan</span>
                <span className="row" style={{ gap: 6 }}>
                  <Button size="sm" icon="pencil" onClick={() => openEdit(m)} title={`Ubah ${m.name}`}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon="trash"
                    onClick={() => setConfirmTarget(m)}
                    title={`Hapus ${m.name}`}
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
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Proyek</th>
                  <th style={{ width: 170 }}>Tugas ditugaskan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                        <Avatar name={m.name} size="sm" />
                        <b>{m.name}</b>
                      </span>
                    </td>
                    <td className="small">{m.email || '-'}</td>
                    <td>
                      <Pill tone="violet">{m.role || 'member'}</Pill>
                    </td>
                    <td className="small">{m.projectCount ?? 0}</td>
                    <td>
                      <div className="progress-cell">
                        <ProgressBar
                          value={totals.maxTasks > 0 ? ((m.taskCount ?? 0) / totals.maxTasks) * 100 : 0}
                          tone={(m.taskCount ?? 0) === totals.maxTasks && totals.maxTasks > 0 ? 'amber' : 'blue'}
                        />
                        <b>{m.taskCount ?? 0}</b>
                      </div>
                    </td>
                    <td className="actions">
                      <Button size="sm" icon="pencil" onClick={() => openEdit(m)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmTarget(m)}>
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
          title={editingId == null ? 'Anggota baru' : 'Edit anggota'}
          subtitle="Informasi ini dipakai untuk penugasan tugas di seluruh proyek."
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
          <FormSection title="Identitas anggota" icon="user-check">
            <div className="form-grid">
              <div className="field">
                <label>
                  Nama <span className="req">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. Budi Santoso"
                  autoFocus
                />
                <FieldError message={fieldErr.name} />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@contoh.com"
                />
                <FieldError message={fieldErr.email} />
              </div>
              <div className="field">
                <label>Peran / keahlian</label>
                <input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="mis. Frontend Developer"
                />
                <FieldError message={fieldErr.role} />
              </div>
            </div>
          </FormSection>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        danger
        title="Hapus anggota?"
        message={
          <>
            Anggota <b>{confirmTarget?.name}</b> akan dihapus. Seluruh penugasan tugasnya dilepas otomatis.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDelete}
        onDismiss={() => setConfirmTarget(null)}
      />
    </>
  );
}
