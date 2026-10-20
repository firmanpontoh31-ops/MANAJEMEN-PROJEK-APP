import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, PRIORITY_LABEL, STATUS_LABEL, type ActivityItem, type DashboardData } from '../api';
import Icon from '../components/Icon';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { Button, Card, DonutChart, PageHeader, Pill, ProgressBar, Segmented, type Tone } from '../components/ui';
import { daysUntil, errorText, fmtDateLong, greeting, relativeTime } from '../ui';

type DueTab = 'dueSoon' | 'overdue';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dueTab, setDueTab] = useState<DueTab>('dueSoon');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.dashboard(), api.activity(8)])
      .then(([d, a]) => {
        setData(d);
        setActivity(a.items);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Memuat dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const tasks = data.tasks;
  const donePct = tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0;
  const dueItems: typeof data.dueSoonTasks = dueTab === 'dueSoon' ? data.dueSoonTasks : data.overdueTasks;
  const dueEmptyTitle = dueTab === 'dueSoon' ? 'Tidak ada tugas mendekati tenggat' : 'Tidak ada tugas terlambat';
  const dueEmptyDesc =
    dueTab === 'dueSoon'
      ? 'Tugas dengan tenggat dalam 7 hari ke depan akan muncul di sini.'
      : 'Semua tenggat tugas masih terpenuhi.';

  const slices: Array<{ label: string; value: number; tone: Tone }> = [
    { label: STATUS_LABEL.todo, value: tasks.todo, tone: 'slate' },
    { label: STATUS_LABEL.in_progress, value: tasks.inProgress, tone: 'blue' },
    { label: STATUS_LABEL.review, value: tasks.review, tone: 'violet' },
    { label: STATUS_LABEL.done, value: tasks.done, tone: 'mint' },
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="eyebrow">
            <Icon name="sun" size={13} /> {greeting()}, Tim!
          </span>
        }
        title="Dashboard"
        subtitle={`Ringkasan ${data.projects.total} proyek dan ${tasks.total} tugas · ${fmtDateLong(data.today)}`}
        actions={
          <>
            <Button icon="refresh" onClick={load}>
              Muat ulang
            </Button>
            <Button variant="primary" icon="plus" onClick={() => navigate('/projects?baru=1')}>
              Tambah Proyek
            </Button>
          </>
        }
      />

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Proyek aktif</span>
            <span className="kpi-icon">
              <Icon name="folder" size={17} />
            </span>
          </div>
          <span className="kpi-value blue">{data.projects.active}</span>
          <span className="kpi-hint">
            {data.projects.planning} perencanaan · {data.projects.onHold} tertunda · {data.projects.completed} selesai
          </span>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas berjalan</span>
            <span className="kpi-icon violet">
              <Icon name="activity" size={17} />
            </span>
          </div>
          <span className="kpi-value">{tasks.inProgress}</span>
          <span className="kpi-hint">
            {tasks.todo} belum mulai · {tasks.review} menunggu review
          </span>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas selesai</span>
            <span className="kpi-icon mint">
              <Icon name="check-circle" size={17} />
            </span>
          </div>
          <span className="kpi-value mint">
            {tasks.done}
            <span className="unit"> ({donePct}%)</span>
          </span>
          <ProgressBar value={donePct} tone="mint" />
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas terlambat</span>
            <span className="kpi-icon red">
              <Icon name="alert-triangle" size={17} />
            </span>
          </div>
          <span className={`kpi-value ${tasks.overdue > 0 ? 'red' : 'mint'}`}>{tasks.overdue}</span>
          <span className="kpi-hint">
            {tasks.dueSoon > 0 ? `${tasks.dueSoon} lainnya tenggat dalam 7 hari` : 'Tidak ada tenggat dekat'}
          </span>
        </div>
      </div>

      <div className="grid-2">
        <Card
          title={
            <>
              <Icon name="chart-pie" size={16} /> Sebaran status tugas
            </>
          }
          subtitle={`${tasks.total} tugas pada seluruh proyek`}
          action={
            <Link className="btn btn-sm btn-secondary" to="/tasks">
              Kelola tugas <Icon name="chevron-right" size={14} />
            </Link>
          }
        >
          <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'nowrap' }}>
            <DonutChart slices={slices} centerValue={`${data.progress}%`} centerLabel="progres rata-rata" />
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
                              : s.tone === 'mint'
                                ? 'var(--mint)'
                                : 'var(--danger)',
                    }}
                  />
                  <span className="dl-name">{s.label}</span>
                  <span className="dl-value">{s.value}</span>
                </div>
              ))}
              {tasks.cancelled > 0 && (
                <div className="dl-item">
                  <span className="swatch" style={{ background: 'var(--surface-3)' }} />
                  <span className="dl-name">{STATUS_LABEL.cancelled}</span>
                  <span className="dl-value">{tasks.cancelled}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card
          title={
            <>
              <Icon name="clock" size={16} /> Tenggat
            </>
          }
          action={
            <Segmented
              value={dueTab}
              onChange={setDueTab}
              options={[
                { value: 'dueSoon', label: `Mendekati (${tasks.dueSoon})` },
                { value: 'overdue', label: `Terlambat (${tasks.overdue})` },
              ]}
            />
          }
        >
          {dueItems.length === 0 ? (
            <EmptyState icon="check-circle" title={dueEmptyTitle} description={dueEmptyDesc} />
          ) : (
            <div className="task-list">
              {dueItems.slice(0, 6).map((t) => {
                const days = daysUntil(t.dueDate, new Date(`${data.today}T00:00:00`));
                return (
                  <div className="task-row" key={t.id}>
                    <div className="tr-main">
                      <Link className="tr-name" to={`/projects/${t.projectId}?tab=tasks`}>
                        {t.name}
                      </Link>
                      <span className="tr-meta">
                        {t.projectName}
                        {t.assigneeName ? ` · ${t.assigneeName}` : ''}
                      </span>
                    </div>
                    <div className="tr-side">
                      <Pill tone={t.priority === 'critical' ? 'red' : t.priority === 'high' ? 'amber' : 'blue'}>
                        {PRIORITY_LABEL[t.priority]}
                      </Pill>
                      <span className={`due-chip ${days < 0 ? 'late' : days <= 3 ? 'warn' : ''}`}>
                        {days < 0 ? `Telat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : `${days} hari lagi`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2-even">
        <Card
          title={
            <>
              <Icon name="trending-up" size={16} /> Progres tiap proyek
            </>
          }
          subtitle="Persentase rata-rata progres tugas per proyek"
        >
          {data.recentProjects.length === 0 ? (
            <EmptyState
              icon="folder"
              title="Belum ada proyek"
              description="Buat proyek pertama untuk mulai merencanakan jadwal."
              action={
                <Button variant="primary" icon="plus" onClick={() => navigate('/projects?baru=1')}>
                  Tambah Proyek
                </Button>
              }
            />
          ) : (
            <div className="bar-list">
              {data.recentProjects.map((p) => (
                <div className="bar-item" key={p.id}>
                  <Link className="bar-name link-strong" to={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                  <span className="bar-meta">
                    {p.doneCount}/{p.taskCount} tugas · {p.progress}%
                  </span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, p.progress))}%`,
                        background: p.progress >= 100 ? 'var(--mint)' : 'var(--primary)',
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={
            <>
              <Icon name="activity" size={16} /> Aktivitas terbaru
            </>
          }
          subtitle="Proyek dan tugas yang terakhir diperbarui"
        >
          {activity.length === 0 ? (
            <EmptyState icon="activity" title="Belum ada aktivitas" description="Aktivitas akan muncul setelah data diubah." />
          ) : (
            <div className="activity">
              {activity.map((a) => (
                <div className="activity-item" key={`${a.kind}-${a.id}`}>
                  <span className={`activity-icon${a.kind === 'project' ? ' violet' : ''}`}>
                    <Icon name={a.kind === 'project' ? 'folder' : 'check-check'} size={15} />
                  </span>
                  <div>
                    <div className="activity-text">
                      {a.kind === 'project' ? (
                        <Link className="link-strong" to={`/projects/${a.id}`}>
                          {a.name}
                        </Link>
                      ) : (
                        <Link className="link-strong" to={`/projects/${a.projectId}?tab=tasks`}>
                          {a.name}
                        </Link>
                      )}{' '}
                      <span className="muted">
                        {a.kind === 'project' ? 'diperbarui' : `diperbarui di ${a.projectName}`}
                      </span>
                    </div>
                    <div className="activity-time">
                      {relativeTime(a.updatedAt)} · {STATUS_LABEL[a.status] ?? a.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
