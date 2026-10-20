import { useEffect, useMemo, useState } from 'react';
import { api, STATUS_LABEL, type CalendarData, type Dependency, type ScheduleResult, type ScheduleTask } from '../api';
import { errorText, fmtDateShort } from '../ui';
import { EmptyState, ErrorState, Loading } from './States';
import Icon from './Icon';
import { Button, Card, Pill, ProgressBar } from './ui';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const LABEL_W = 230;
const HEADER_H = 41;
const ROW_H = 36;

type Zoom = 'ringkas' | 'normal' | 'luas';
const COL_W: Record<Zoom, number> = { ringkas: 16, normal: 28, luas: 44 };

const BAR_CLASS: Record<string, string> = {
  todo: 'todo',
  in_progress: '',
  review: 'review',
  done: 'done',
  cancelled: 'cancelled',
};

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmt(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function GanttTab({ projectId, version }: { projectId: number; version: number }) {
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [zoom, setZoom] = useState<Zoom>('normal');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.analysis.schedule(projectId),
      api.calendar.get(),
      api.dependencies.list(projectId),
    ])
      .then(([s, c, d]) => {
        setSchedule(s);
        setCalendar(c);
        setDeps(d);
        setError('');
      })
      .catch((e) => setError(errorText(e)));
  }, [projectId, version, reload]);

  const workingSet = useMemo(() => {
    const s = new Set<number>();
    for (const w of calendar?.workdays ?? []) if (w.isWorking) s.add(w.dayOfWeek);
    return s;
  }, [calendar]);

  const holidaySet = useMemo(() => new Set((calendar?.holidays ?? []).map((h) => h.date)), [calendar]);

  const colW = COL_W[zoom];

  const model = useMemo(() => {
    if (!schedule || schedule.tasks.length === 0) return null;
    const start = parse(schedule.startDate);
    const end = parse(schedule.finishDate);
    const days: string[] = [];
    const idx = new Map<string, number>();
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const iso = fmt(d);
      idx.set(iso, days.length);
      days.push(iso);
    }
    const months: Array<{ label: string; start: number; count: number }> = [];
    days.forEach((iso, i) => {
      const key = iso.slice(0, 7);
      const last = months[months.length - 1];
      if (last && last.label === key) last.count++;
      else months.push({ label: key, start: i, count: 1 });
    });
    const isOff = (iso: string) => {
      const dow = parse(iso).getDay();
      return !workingSet.has(dow) || holidaySet.has(iso);
    };
    return { days, idx, months, isOff, totalWidth: days.length * colW };
  }, [schedule, workingSet, holidaySet, colW]);

  // Baris yang ditampilkan (filter jalur kritis / sembunyikan selesai)
  const visibleTasks = useMemo(() => {
    if (!schedule) return [];
    return schedule.tasks.filter((t) => {
      if (onlyCritical && !t.critical) return false;
      if (hideDone && t.status === 'done') return false;
      return true;
    });
  }, [schedule, onlyCritical, hideDone]);

  const rowPos = useMemo(() => {
    const m = new Map<number, number>();
    visibleTasks.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [visibleTasks]);

  if (error) return <ErrorState message={error} onRetry={() => setReload((r) => r + 1)} />;
  if (!schedule) return <Loading label="Memuat Gantt Chart…" />;
  if (schedule.tasks.length === 0 || !model) {
    return (
      <div className="card">
        <EmptyState
          icon="activity"
          title="Belum ada tugas untuk ditampilkan"
          description="Tambahkan tugas pada tab 'Tugas & dependensi' — Gantt Chart akan menampilkan durasi dan urutannya otomatis."
        />
      </div>
    );
  }

  const barGeom = (t: ScheduleTask) => {
    const i = model.idx.get(t.es) ?? 0;
    const j = model.idx.get(t.ef) ?? i;
    return { left: i * colW, width: (j - i + 1) * colW };
  };

  const rowY = (id: number) => HEADER_H + (rowPos.get(id) ?? 0) * ROW_H + 18;

  const arrows = deps
    .filter((d) => rowPos.has(d.predecessorId) && rowPos.has(d.successorId))
    .map((d) => {
      const p = schedule.tasks.find((t) => t.id === d.predecessorId)!;
      const s = schedule.tasks.find((t) => t.id === d.successorId)!;
      const x1 = LABEL_W + (model.idx.get(p.ef) ?? 0) * colW + colW;
      const x2 = LABEL_W + (model.idx.get(s.es) ?? 0) * colW;
      const y1 = rowY(p.id);
      const y2 = rowY(s.id);
      const midX = x1 + 10;
      const endX = Math.max(x2 - 7, midX + 4);
      return {
        key: d.id,
        path: `M ${x1} ${y1} H ${midX} V ${y2} H ${endX}`,
        critical: p.critical && s.critical,
        label: `${d.type}${d.lag !== 0 ? ` ${d.lag > 0 ? '+' : ''}${d.lag}` : ''}`,
        labelX: midX + 3,
        labelY: (y1 + y2) / 2 + 3,
      };
    });

  const criticalCount = schedule.tasks.filter((t) => t.critical).length;
  const selectedTask = selected != null ? schedule.tasks.find((t) => t.id === selected) ?? null : null;

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Mulai proyek</span>
            <span className="kpi-icon">
              <Icon name="calendar" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 20 }}>
            {fmtDateShort(schedule.startDate)}
          </span>
          <span className="kpi-hint">Hari kerja pertama</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Perkiraan selesai</span>
            <span className="kpi-icon mint">
              <Icon name="check-circle" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 20 }}>
            {fmtDateShort(schedule.finishDate)}
          </span>
          <span className="kpi-hint">Berdasarkan durasi & dependensi</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Durasi proyek</span>
            <span className="kpi-icon violet">
              <Icon name="clock" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 20 }}>
            {schedule.projectDurationWorkdays}
            <span className="unit"> hari kerja</span>
          </span>
          <span className="kpi-hint">{schedule.taskCount} tugas terjadwal</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas kritis</span>
            <span className="kpi-icon red">
              <Icon name="alert-triangle" size={16} />
            </span>
          </div>
          <span className={`kpi-value ${criticalCount > 0 ? 'red' : 'mint'}`} style={{ fontSize: 20 }}>
            {criticalCount}
            <span className="unit"> / {schedule.taskCount}</span>
          </span>
          <span className="kpi-hint">Tidak boleh terlambat</span>
        </div>
      </div>

      {schedule.warnings.map((w, i) => (
        <div className="alert warn" key={i}>
          <Icon name="alert-triangle" size={15} /> {w}
        </div>
      ))}

      <Card
        title={
          <>
            <Icon name="activity" size={16} /> Timeline proyek
          </>
        }
        subtitle="Klik bar tugas untuk melihat detail jadwalnya."
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button
              size="sm"
              variant={onlyCritical ? 'primary' : 'default'}
              icon="target"
              onClick={() => setOnlyCritical((v) => !v)}
            >
              Jalur kritis
            </Button>
            <Button
              size="sm"
              variant={hideDone ? 'primary' : 'default'}
              icon="check"
              onClick={() => setHideDone((v) => !v)}
            >
              Sembunyikan selesai
            </Button>
            <div className="segmented">
              {(['ringkas', 'normal', 'luas'] as Zoom[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={zoom === z ? 'active' : ''}
                  onClick={() => setZoom(z)}
                  aria-pressed={zoom === z}
                >
                  {z === 'ringkas' ? 'Ringkas' : z === 'normal' ? 'Normal' : 'Luas'}
                </button>
              ))}
            </div>
          </div>
        }
        bodyless
      >
        <div className="gantt-wrap">
          <div className="gantt" style={{ width: LABEL_W + model.totalWidth }}>
            <div className="gantt-header">
              <div className="gantt-label">Tugas ({visibleTasks.length})</div>
              <div style={{ position: 'relative', width: model.totalWidth, height: 40 }}>
                {model.months.map((m) => (
                  <div
                    key={`${m.label}-${m.start}`}
                    className="gantt-month"
                    style={{ left: m.start * colW, width: m.count * colW }}
                  >
                    {MONTH_NAMES[Number(m.label.slice(5, 7)) - 1]} {m.label.slice(0, 4)}
                  </div>
                ))}
                {model.days.map((iso, i) => (
                  <div
                    key={iso}
                    className={`gantt-day${model.isOff(iso) ? ' off' : ''}${parse(iso).getDay() === 1 ? ' weekstart' : ''}`}
                    style={{ left: i * colW, width: colW }}
                  >
                    {zoom === 'ringkas' ? '' : Number(iso.slice(8, 10))}
                  </div>
                ))}
              </div>
            </div>

            {visibleTasks.map((t) => {
              const g = barGeom(t);
              const cls = BAR_CLASS[t.status] ?? '';
              const crit = t.critical;
              return (
                <div
                  className={`gantt-row${selected === t.id ? ' selected' : ''}`}
                  key={t.id}
                  style={{ height: ROW_H }}
                >
                  <div className="gantt-label" title={t.name}>
                    <span
                      className="dot"
                      style={{
                        background: crit
                          ? 'var(--danger)'
                          : t.status === 'done'
                            ? 'var(--mint)'
                            : t.status === 'review'
                              ? 'var(--violet)'
                              : t.status === 'todo'
                                ? 'var(--text-3)'
                                : 'var(--primary)',
                      }}
                    />
                    <span className="truncate">{t.name}</span>
                    {crit && <Pill tone="red">Kritis</Pill>}
                  </div>
                  <div className="gantt-track" style={{ width: model.totalWidth }}>
                    <button
                      type="button"
                      className={`gantt-bar${cls}${crit ? ' critical' : ''}${selected === t.id ? ' selected' : ''}`}
                      style={{ left: g.left, width: Math.max(g.width - 2, 12) }}
                      onClick={() => setSelected(selected === t.id ? null : t.id)}
                      title={`${t.name}\n${fmtDateShort(t.es)} → ${fmtDateShort(t.ef)} (${t.duration} hari kerja)\nFloat: ${t.float} hari${crit ? '\nKRITIS' : ''}`}
                    >
                      {g.width >= 58 ? `${t.duration} hr` : ''}
                    </button>
                  </div>
                </div>
              );
            })}

            <svg
              className="gantt-svg"
              width={LABEL_W + model.totalWidth}
              height={HEADER_H + visibleTasks.length * ROW_H}
            >
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
                </marker>
                <marker id="gantt-arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#ef4444" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <g key={a.key}>
                  <path
                    d={a.path}
                    className={`net-edge${a.critical ? ' critical' : ''}`}
                    markerEnd={`url(#${a.critical ? 'gantt-arrow-crit' : 'gantt-arrow'})`}
                  />
                  <text x={a.labelX} y={a.labelY} className={`net-edge-label${a.critical ? ' critical' : ''}`}>
                    {a.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="gantt-legend">
          <span>
            <i style={{ background: 'var(--primary)' }} /> Berjalan
          </span>
          <span>
            <i style={{ background: 'var(--violet)' }} /> Review
          </span>
          <span>
            <i style={{ background: 'var(--mint)' }} /> Selesai
          </span>
          <span>
            <i style={{ background: '#94a3b8' }} /> Belum mulai
          </span>
          <span>
            <i style={{ background: 'var(--danger)' }} /> Jalur kritis
          </span>
          <span className="muted">Kolom berarsir = akhir pekan / hari libur</span>
        </div>
      </Card>

      {selectedTask && (
        <Card
          title={
            <>
              <Icon name="list-todo" size={16} /> Detail tugas
            </>
          }
          action={
            <Button size="sm" icon="x" onClick={() => setSelected(null)}>
              Tutup
            </Button>
          }
        >
          <div className="detail-list">
            <div className="detail-row">
              <span className="dr-key">Nama tugas</span>
              <span className="dr-val">{selectedTask.name}</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Status</span>
              <span className="dr-val">
                <Pill tone={selectedTask.status === 'done' ? 'mint' : selectedTask.critical ? 'red' : 'blue'}>
                  {STATUS_LABEL[selectedTask.status]}
                </Pill>
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Mulai (ES) · Selesai (EF)</span>
              <span className="dr-val">
                {fmtDateShort(selectedTask.es)} → {fmtDateShort(selectedTask.ef)}
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Durasi</span>
              <span className="dr-val">{selectedTask.duration} hari kerja</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Kelonggaran (float)</span>
              <span className="dr-val">{selectedTask.float} hari</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Ditugaskan ke</span>
              <span className="dr-val">{selectedTask.assigneeName ?? 'Belum ada assignee'}</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Progres</span>
              <span className="dr-val" style={{ minWidth: 160 }}>
                <ProgressBar value={selectedTask.progress} tone={selectedTask.progress >= 100 ? 'mint' : 'blue'} />
                <b style={{ marginLeft: 8 }}>{selectedTask.progress}%</b>
              </span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
