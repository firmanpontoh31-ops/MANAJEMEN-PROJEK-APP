import { useCallback, useEffect, useState } from 'react';
import { api, type Member } from '../api';
import Modal from './Modal';
import Icon from './Icon';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState, ErrorState, Loading } from './States';
import { toast } from './Toast';
import { Avatar, Button, Card, FormSection, PageHeader, Pill, Segmented } from './ui';

export default function MembersTab({ projectId, onChange }: { projectId: number; onChange: () => void }) {
  const [assigned, setAssigned] = useState<Member[]>([]);
  const [all, setAll] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [form, setForm] = useState({ name: '', email: '', role: '' });
  const [confirmTarget, setConfirmTarget] = useState<Member | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.projects.members(projectId), api.members.list()])
      .then(([a, b]) => {
        setAssigned(a);
        setAll(b);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    try {
      if (mode === 'existing') {
        if (selectedId === '') {
          toast.error('Pilih anggota terlebih dahulu.');
          return;
        }
        await api.projects.addMember(projectId, { memberId: selectedId });
      } else {
        if (!form.name.trim()) {
          toast.error('Nama anggota wajib diisi.');
          return;
        }
        await api.projects.addMember(projectId, form);
      }
      setAdding(false);
      setForm({ name: '', email: '', role: '' });
      setSelectedId('');
      load();
      onChange();
      toast.success('Anggota ditugaskan ke proyek.');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const doRemove = async () => {
    const m = confirmTarget;
    if (!m) return;
    try {
      await api.projects.removeMember(projectId, m.id);
      setConfirmTarget(null);
      load();
      onChange();
      toast.success(`Penugasan "${m.name}" dilepas dari proyek.`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const available = all.filter((m) => !assigned.some((a) => a.id === m.id));

  if (loading) return <Loading label="Memuat anggota proyek…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Anggota tim"
        subtitle="Tugaskan anggota proyek agar pekerjaan dapat dipersonalisasi dan beban kerja terlihat."
        actions={
          <Button variant="primary" icon="user-plus" onClick={() => setAdding(true)}>
            Tugaskan anggota
          </Button>
        }
      />

      <Card
        title={
          <>
            <Icon name="users" size={16} /> Anggota di proyek ini
          </>
        }
        subtitle={`${assigned.length} anggota terdaftar`}
      >
        {assigned.length === 0 ? (
          <EmptyState
            icon="users"
            title="Belum ada anggota di proyek ini"
            description="Tugaskan anggota tim agar tugas dapat dipersonalisasi dan beban kerja terlihat."
            action={
              <Button variant="primary" icon="user-plus" onClick={() => setAdding(true)}>
                Tugaskan anggota
              </Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Peran</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assigned.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                        <Avatar name={m.name} size="sm" />
                        <b>{m.name}</b>
                      </span>
                    </td>
                    <td>
                      <Pill tone="violet">{m.role || 'member'}</Pill>
                    </td>
                    <td className="small">{m.email || '-'}</td>
                    <td className="actions">
                      <Button
                        size="sm"
                        variant="danger"
                        icon="trash"
                        onClick={() => setConfirmTarget(m)}
                        title="Lepas dari proyek"
                      >
                        Lepas
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && (
        <Modal
          title="Tugaskan anggota"
          subtitle="Tambahkan anggota yang sudah ada atau buat anggota baru."
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button onClick={() => setAdding(false)}>Batal</Button>
              <Button variant="primary" icon="check" onClick={add}>
                Tugaskan
              </Button>
            </>
          }
        >
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'existing', label: 'Anggota yang ada', icon: 'users' },
              { value: 'new', label: 'Anggota baru', icon: 'user-plus' },
            ]}
          />

          <div style={{ marginTop: 16 }}>
            {mode === 'existing' ? (
              <div className="field">
                <label>Pilih anggota</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">— pilih —</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.role || 'member'}
                    </option>
                  ))}
                </select>
                {available.length === 0 && (
                  <span className="field-hint">
                    <Icon name="info" size={12} /> Semua anggota sudah ditugaskan ke proyek ini.
                  </span>
                )}
              </div>
            ) : (
              <FormSection title="Data anggota baru" icon="user-plus">
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Nama <span className="req">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Peran</label>
                    <input
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      placeholder="mis. Tester"
                    />
                  </div>
                </div>
              </FormSection>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        danger
        title="Lepas penugasan?"
        message={
          <>
            <b>{confirmTarget?.name}</b> tidak lagi ditugaskan pada proyek ini. Tugas yang ditugaskan kepadanya tetap
            ada (tanpa penugasan).
          </>
        }
        confirmLabel="Ya, lepas"
        onConfirm={doRemove}
        onDismiss={() => setConfirmTarget(null)}
      />
    </>
  );
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan yang tidak diketahui';
}
