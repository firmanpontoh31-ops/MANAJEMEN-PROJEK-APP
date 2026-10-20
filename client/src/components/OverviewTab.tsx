import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, PRIORITY_LABEL, STATUS_LABEL, type Dependency, type Member, type Task } from '../api';
import Icon from './Icon';
import { EmptyState, ErrorState, Loading } from './States';
import { Avatar, Button, Card, DonutChart, Pill, type Tone } from './ui';
import { daysUntil, errorText, fmtDateShort } from '../ui';

const STATUS_ORDER: Array<{ key: Task['status']; label: string; tone: Tone }> = [
  { key: 'todo', label: STATUS_LABEL.todo, tone: 'slate' },
  { key: 'in_progress', label: STATUS_LABEL.in_progress, tone: 'blue' },
  { key: 'review', label: STATUS_LABEL.review, tone: 'violet' },
  { key: 'done', label: STATUS_LABEL.done, tone: 'mint' },
];

/** Ringkasan proyek: sebaran status, tugas prioritas, dan info tim. */
export default function OverviewTab({
  projectId,
  version,
  onChange,
}: {
  projectId: number;
  version: number;
  onChange: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [projectId, version]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { todo: 0, in_progress: 0, review: 0, done: 0, cancelled: 0 };
    let progressSum = 0;
    let progressCount = 0;
    const today = new Date();
    const attention: Task[] = [];
    for (const t of tasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
      if (t.status !== 'cancelled') {
        progressSum += t.progress;
        progressCount++;
      }
      if (t.dueDate && t.status !== 'done' && t.status !== 'cancelled' && daysUntil(t.dueDate, today) <= 7) {
        attention.push(t);
      }
    }
    return {
      counts,
      progress: progressCount > 0 ? Math.round((progressSum / progressCount) * 10) / 10 : 0,
      attention: attention.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)),
    };
  }, [tasks]);

  if (loading) return <Loading label="Memuat ringkasan proyek…" />;
  if (error) return <ErrorState message={error} onRetry={onChange} />;

  const slices = STATUS_ORDER.map((s) => ({
    label: s.label,
    value: summary.counts[s.key] ?? 0,
    tone: s.tone,
  }));

  const workload = members
    .map((m) => ({
      member: m,
      count: tasks.filter((t) => t.assigneeId === m.id && t.status !== 'done' && t.status !== 'cancelled')
        .length,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="grid-2">
        <Card
          title={
            <>
              <Icon name="chart-pie" size={16} /> Sebaran status tugas
            </>
          }
          subtitle={`${tasks.length} tugas pada proyek ini`}
        >
          {tasks.length === 0 ? (
            <EmptyState
              icon="list-todo"
              title="Belum ada tugas"
              description="Tambahkan tugas pada tab Tugas & dependensi."
            />
          ) : (
            <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'nowrap' }}>
              <DonutChart slices={slices} centerValue={`${summary.progress}%`} centerLabel="progres rata-rata" />
              <div className="donut-legend" style={{ flex: 1 }}>
                {slices.map((s) => (
                  <div className="dl-item" key={s.label}>
                    <span
                      className="swatch"
                      style={{
                        background:
                          s.tone === 'slate'
                            ? '#94a3b8'
                            : s.tone === 'blue'
                              ? 'var(--primary)'
                              : s.tone === 'violet'
                                ? 'var(--violet)'
                                : 'var(--mint)',
                      }}
                    />
                    <span className="dl-name">{s.label}</span>
                    <span className="dl-value">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card
          title={
            <>
              <Icon name="users" size={16} /> Beban kerja tim
            </>
          }
          subtitle={`${members.length} anggota · ${deps.length} dependensi`}
        >
          {workload.length === 0 ? (
            <EmptyState
              icon="users"
              title="Belum ada anggota"
              description="Tugaskan anggota tim pada tab Anggota tim."
            />
          ) : (
            <div className="bar-list">
              {workload.map((w) => (
                <div className="bar-item" key={w.member.id}>
                  <span className="bar-name row" style={{ gap: 8 }}>
                    <Avatar name={w.member.name} size="sm" />
                    {w.member.name}
                  </span>
                  <span className="bar-meta">{w.count} tugas aktif</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width: `${Math.min(100, (w.count / Math.max(1, workload[0].count)) * 100)}%`,
                        background: w.count === workload[0].count && w.count > 0 ? 'var(--amber)' : 'var(--primary)',
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title={
          <>
            <Icon name="clock" size={16} /> Tugas yang perlu perhatian
          </>
        }
        subtitle="Tugas dengan tenggat paling lambat 7 hari ke depan."
        action={
          <Link className="btn btn-sm btn-secondary" to={`?tab=tasks`}>
            Kelola tugas <Icon name="chevron-right" size={14} />
          </Link>
        }
      >
        {summary.attention.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="Tidak ada tenggat mendesak"
            description="Seluruh tugas memiliki tenggat lebih dari 7 hari ke depan atau sudah selesai."
          />
        ) : (
          <div className="task-list">
            {summary.attention.map((t) => {
              const days = daysUntil(t.dueDate!, new Date());
              return (
                <div className="task-row" key={t.id}>
                  <div className="tr-main">
                    <span className="tr-name">{t.name}</span>
                    <span className="tr-meta">
                      Tenggat {fmtDateShort(t.dueDate)}
                      {t.assigneeName ? ` · ${t.assigneeName}` : ' · tanpa assignee'}
                    </span>
                  </div>
                  <div className="tr-side">
                    <Pill
                      tone={t.priority === 'critical' ? 'red' : t.priority === 'high' ? 'amber' : 'blue'}
                    >
                      {PRIORITY_LABEL[t.priority]}
                    </Pill>
                    <span className={`due-chip ${days < 0 ? 'late' : days <= 3 ? 'warn' : ''}`}>
                      {days < 0
                        ? `Telat ${Math.abs(days)} hari`
                        : days === 0
                          ? 'Hari ini'
                          : `${days} hari lagi`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title={
          <>
            <Icon name="trending-up" size={16} /> Progres tiap tugas
          </>
        }
        subtitle="Klik tab Gantt atau Jadwal untuk melihat timeline lengkap."
      >
        {tasks.length === 0 ? (
          <EmptyState icon="activity" title="Belum ada progres untuk ditampilkan" />
        ) : (
          <div className="bar-list">
            {tasks.slice(0, 12).map((t) => (
              <div className="bar-item" key={t.id}>
                <span className="bar-name truncate" style={{ maxWidth: 340 }}>
                  {t.name}
                </span>
                <span className="bar-meta">{t.progress}%</span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{
                      width: `${Math.min(100, t.progress)}%`,
                      background: t.progress >= 100 ? 'var(--mint)' : 'var(--primary)',
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="row" style={{ marginTop: 4 }}>
        <Button variant="secondary" icon="activity" onClick={onChange}>
          Segarkan data
        </Button>
      </div>
    </>
  );
}
