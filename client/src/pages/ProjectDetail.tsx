import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, STATUS_LABEL, type Project } from '../api';
import Icon, { type IconName } from '../components/Icon';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { Button, Card, Pill, ProgressBar, Tabs, type Tone } from '../components/ui';
import { errorText, fmtDateLong, fmtDateShort } from '../ui';
import OverviewTab from '../components/OverviewTab';
import TasksTab from '../components/TasksTab';
import GanttTab from '../components/GanttTab';
import NetworkTab from '../components/NetworkTab';
import AnalysisTab from '../components/AnalysisTab';
import MembersTab from '../components/MembersTab';

type TabKey = 'overview' | 'tasks' | 'gantt' | 'analysis' | 'network' | 'members';

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'overview', label: 'Ringkasan', icon: 'grid' },
  { key: 'tasks', label: 'Tugas & dependensi', icon: 'list-todo' },
  { key: 'gantt', label: 'Gantt chart', icon: 'activity' },
  { key: 'analysis', label: 'Jadwal · PERT · CPM', icon: 'calculator' },
  { key: 'network', label: 'Network diagram', icon: 'share' },
  { key: 'members', label: 'Anggota tim', icon: 'users' },
];

const PROJECT_TONE: Record<string, Tone> = {
  planning: 'violet',
  active: 'blue',
  on_hold: 'amber',
  completed: 'mint',
  cancelled: 'slate',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'overview';
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'overview';
  const setTab = (key: TabKey) => setSearchParams({ tab: key }, { replace: true });
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setError('Id proyek tidak valid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    api.projects
      .get(projectId)
      .then((p) => {
        setProject(p);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    load();
  }, [load]);

  if (loading) return <Loading label="Memuat proyek…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!project) return null;

  const progress = project.progress ?? 0;

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="breadcrumb">
            <Link to="/projects">Proyek</Link>
            <Icon name="chevron-right" size={12} />
            <span>Detail</span>
          </div>
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <Pill tone={PROJECT_TONE[project.status] ?? 'slate'} dot>
              {STATUS_LABEL[project.status]}
            </Pill>
            {project.leadName && (
              <span className="small muted">
                <Icon name="user-check" size={13} /> Penanggung jawab: {project.leadName}
              </span>
            )}
          </div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-sub">
            {project.description || 'Tanpa deskripsi.'}
          </p>
        </div>
        <div className="page-actions">
          <Button icon="refresh" onClick={load}>
            Muat ulang
          </Button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Progres proyek</span>
            <span className="kpi-icon">
              <Icon name="trending-up" size={16} />
            </span>
          </div>
          <span className="kpi-value blue">{progress}%</span>
          <ProgressBar value={progress} tone={progress >= 100 ? 'mint' : 'blue'} />
          <span className="kpi-hint">
            {project.doneCount ?? 0} dari {project.taskCount ?? 0} tugas selesai
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tanggal mulai</span>
            <span className="kpi-icon violet">
              <Icon name="calendar" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 18 }}>
            {fmtDateShort(project.startDate)}
          </span>
          <span className="kpi-hint">{fmtDateLong(project.startDate)}</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas terlambat</span>
            <span className="kpi-icon red">
              <Icon name="alert-triangle" size={16} />
            </span>
          </div>
          <span className={`kpi-value ${(project.overdueCount ?? 0) > 0 ? 'red' : 'mint'}`}>
            {project.overdueCount ?? 0}
          </span>
          <span className="kpi-hint">Tenggat sudah lewat</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Anggota tim</span>
            <span className="kpi-icon mint">
              <Icon name="users" size={16} />
            </span>
          </div>
          <span className="kpi-value">{project.memberCount ?? 0}</span>
          <span className="kpi-hint">Ditugaskan pada proyek ini</span>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={TABS} />

      {tab === 'overview' && <OverviewTab projectId={projectId} version={version} onChange={bump} />}
      {tab === 'tasks' && <TasksTab projectId={projectId} onChange={bump} />}
      {tab === 'gantt' && <GanttTab projectId={projectId} version={version} />}
      {tab === 'analysis' && <AnalysisTab projectId={projectId} version={version} />}
      {tab === 'network' && <NetworkTab projectId={projectId} version={version} />}
      {tab === 'members' && <MembersTab projectId={projectId} onChange={bump} />}
    </>
  );
}
