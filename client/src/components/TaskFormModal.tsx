import { useState } from 'react';
import {
  api,
  fieldErrors,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Member,
  type Priority,
  type Task,
  type TaskStatus,
} from '../api';
import Modal from './Modal';
import { Button, FormSection } from './ui';
import { FieldError, toast } from './Toast';
import { errorText } from '../ui';

interface TaskForm {
  name: string;
  description: string;
  startDate: string;
  duration: string;
  dueDate: string;
  status: TaskStatus;
  priority: Priority;
  progress: string;
  assigneeId: string;
  optimisticDays: string;
  mostLikelyDays: string;
  pessimisticDays: string;
}

const emptyForm = (): TaskForm => ({
  name: '',
  description: '',
  startDate: '',
  duration: '1',
  dueDate: '',
  status: 'todo',
  priority: 'medium',
  progress: '0',
  assigneeId: '',
  optimisticDays: '',
  mostLikelyDays: '',
  pessimisticDays: '',
});

const toForm = (t: Task): TaskForm => ({
  name: t.name,
  description: t.description,
  startDate: t.startDate ?? '',
  duration: String(t.duration),
  dueDate: t.dueDate ?? '',
  status: t.status,
  priority: t.priority,
  progress: String(t.progress),
  assigneeId: t.assigneeId == null ? '' : String(t.assigneeId),
  optimisticDays: t.optimisticDays == null ? '' : String(t.optimisticDays),
  mostLikelyDays: t.mostLikelyDays == null ? '' : String(t.mostLikelyDays),
  pessimisticDays: t.pessimisticDays == null ? '' : String(t.pessimisticDays),
});

const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/**
 * Formulir tugas (buat / ubah) — field dikelompokkan menjadi
 * Informasi umum, Jadwal, Penugasan, dan Estimasi PERT.
 */
export default function TaskFormModal({
  projectId,
  members,
  task,
  parentId = null,
  onClose,
  onSaved,
}: {
  projectId: number;
  members: Member[];
  task?: Task | null;
  parentId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TaskForm>(task ? toForm(task) : emptyForm());
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Saat mengedit, struktur hierarki (parentId) tidak boleh berubah diam-diam.
  const effectiveParentId = task ? task.parentId : parentId;

  const save = async () => {
    setSaving(true);
    setFieldErr({});
    const payload = {
      name: form.name,
      description: form.description,
      startDate: form.startDate || null,
      duration: Number(form.duration) || 1,
      dueDate: form.dueDate || null,
      status: form.status,
      priority: form.priority,
      progress: Number(form.progress) || 0,
      assigneeId: numOrNull(form.assigneeId),
      optimisticDays: numOrNull(form.optimisticDays),
      mostLikelyDays: numOrNull(form.mostLikelyDays),
      pessimisticDays: numOrNull(form.pessimisticDays),
      parentId: effectiveParentId,
    };
    try {
      if (!task) {
        await api.tasks.create(projectId, payload);
        toast.success(`Tugas "${form.name}" dibuat.`);
      } else {
        await api.tasks.update(task.id, payload);
        toast.success(`Tugas "${form.name}" diperbarui.`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setFieldErr(fieldErrors(e));
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={!task ? (parentId ? 'Subtugas baru' : 'Tugas baru') : 'Edit tugas'}
      subtitle={!task ? 'Lengkapi informasi tugas untuk menyusun rencana kerja.' : 'Perbarui detail tugas ini.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
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
              Nama tugas <span className="req">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Merancang basis data"
              autoFocus
            />
            <FieldError message={fieldErr.name} />
          </div>
          <div className="field span-2">
            <label>Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Rincian pekerjaan yang perlu diselesaikan…"
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
            >
              {(['todo', 'in_progress', 'review', 'done', 'cancelled'] as TaskStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Prioritas</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Jadwal" icon="calendar">
        <div className="form-grid">
          <div className="field">
            <label>Tanggal mulai (mandiri)</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <span className="field-hint">Kosongkan agar mengikuti jadwal dependensi.</span>
            <FieldError message={fieldErr.startDate} />
          </div>
          <div className="field">
            <label>
              Durasi (hari kerja) <span className="req">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
            <FieldError message={fieldErr.duration} />
          </div>
          <div className="field">
            <label>Tenggat</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <FieldError message={fieldErr.dueDate} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Penugasan" icon="user-check">
        <div className="form-grid">
          <div className="field">
            <label>Ditugaskan ke</label>
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            >
              <option value="">— tidak ada —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <FieldError message={fieldErr.assigneeId} />
          </div>
          <div className="field">
            <label>Progres (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => setForm({ ...form, progress: e.target.value })}
            />
            <FieldError message={fieldErr.progress} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Estimasi PERT (opsional)" icon="calculator">
        <div className="form-grid">
          <div className="field">
            <label>Optimis (O)</label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.optimisticDays}
              onChange={(e) => setForm({ ...form, optimisticDays: e.target.value })}
            />
            <FieldError message={fieldErr.optimisticDays} />
          </div>
          <div className="field">
            <label>Paling mungkin (M)</label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.mostLikelyDays}
              onChange={(e) => setForm({ ...form, mostLikelyDays: e.target.value })}
            />
            <FieldError message={fieldErr.mostLikelyDays} />
          </div>
          <div className="field">
            <label>Pesimis (P)</label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.pessimisticDays}
              onChange={(e) => setForm({ ...form, pessimisticDays: e.target.value })}
            />
            <FieldError message={fieldErr.pessimisticDays} />
          </div>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          TE = (O + 4M + P) / 6 — dipakai untuk mengukur ketidakpastian durasi proyek.
        </p>
      </FormSection>
    </Modal>
  );
}
