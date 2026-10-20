import { useEffect, useMemo, useState } from 'react';
import { api, STATUS_LABEL, type Dependency, type ScheduleResult } from '../api';
import { errorText, fmtDateShort } from '../ui';
import { EmptyState, ErrorState, Loading } from './States';
import Icon from './Icon';
import { Button, Card, Pill } from './ui';

const NODE_W = 168;
const NODE_H = 68;
const GAP_X = 78;
const GAP_Y = 18;
const PAD = 18;

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const trunc = (s: string, n = 22): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Network Diagram: node = tugas, panah = dependensi berlabel tipe + lag.
 * Layout per level (kedalaman dependensi), jalur kritis diwarnai merah.
 */
export default function NetworkTab({ projectId, version }: { projectId: number; version: number }) {
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.analysis.schedule(projectId), api.dependencies.list(projectId)])
      .then(([s, d]) => {
        setSchedule(s);
        setDeps(d);
        setError('');
      })
      .catch((e) => setError(errorText(e)));
  }, [projectId, version, reload]);

  const layout = useMemo(() => {
    if (!schedule || schedule.tasks.length === 0) return null;
    const ids = schedule.tasks.map((t) => t.id);
    const preds = new Map<number, number[]>();
    for (const id of ids) preds.set(id, []);
    const usable = deps.filter((d) => preds.has(d.predecessorId) && preds.has(d.successorId));
    for (const d of usable) preds.get(d.successorId)!.push(d.predecessorId);

    // level = jarak dependensi terpanjang dari akar (iterasi aman untuk DAG)
    const level = new Map<number, number>(ids.map((id) => [id, 0]));
    for (let pass = 0; pass < ids.length; pass++) {
      let changed = false;
      for (const d of usable) {
        const cur = level.get(d.successorId)!;
        const next = (level.get(d.predecessorId) ?? 0) + 1;
        if (next > cur) {
          level.set(d.successorId, next);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const columns = new Map<number, typeof schedule.tasks>();
    for (const t of schedule.tasks) {
      const lv = level.get(t.id) ?? 0;
      const arr = columns.get(lv);
      if (arr) arr.push(t);
      else columns.set(lv, [t]);
    }
    for (const arr of columns.values()) {
      arr.sort((a, b) => (a.es < b.es ? -1 : a.es > b.es ? 1 : a.id - b.id));
    }

    const pos = new Map<number, { x: number; y: number }>();
    let maxRows = 1;
    const maxLevel = Math.max(...columns.keys());
    for (const [lv, arr] of columns) {
      arr.forEach((t, i) => {
        pos.set(t.id, {
          x: PAD + lv * (NODE_W + GAP_X),
          y: PAD + i * (NODE_H + GAP_Y),
        });
      });
      maxRows = Math.max(maxRows, arr.length);
    }

    const width = PAD * 2 + (maxLevel + 1) * NODE_W + maxLevel * GAP_X;
    const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
    return { pos, width, height, levelCount: maxLevel + 1 };
  }, [schedule, deps]);

  if (error) return <ErrorState message={error} onRetry={() => setReload((r) => r + 1)} />;
  if (!schedule) return <Loading label="Memuat Network Diagram…" />;
  if (!layout) {
    return (
      <div className="card">
        <EmptyState
          icon="share"
          title="Belum ada tugas untuk ditampilkan"
          description="Tambahkan tugas dan dependensi pada tab 'Tugas & dependensi' — diagram urutan aktivitas akan muncul otomatis."
        />
      </div>
    );
  }

  const byId = new Map(schedule.tasks.map((t) => [t.id, t]));
  const edges = deps
    .filter((d) => layout.pos.has(d.predecessorId) && layout.pos.has(d.successorId))
    .map((d) => {
      const p = byId.get(d.predecessorId)!;
      const s = byId.get(d.successorId)!;
      const pp = layout.pos.get(d.predecessorId)!;
      const sp = layout.pos.get(d.successorId)!;
      const x1 = pp.x + NODE_W;
      const y1 = pp.y + NODE_H / 2;
      const x2 = sp.x;
      const y2 = sp.y + NODE_H / 2;
      const c = p.critical && s.critical;
      const midX = (x1 + x2) / 2;
      return {
        key: d.id,
        path: `M ${x1} ${y1} C ${x1 + 34} ${y1}, ${x2 - 34} ${y2}, ${x2} ${y2}`,
        critical: c,
        label: `${d.type}${d.lag !== 0 ? ` ${d.lag > 0 ? '+' : ''}${d.lag}` : ''}`,
        lx: midX,
        ly: (y1 + y2) / 2 - 5,
      };
    });

  const criticalCount = schedule.tasks.filter((t) => t.critical).length;
  const selectedTask = selected != null ? byId.get(selected) ?? null : null;
  const selectedDeps = selected != null ? deps.filter((d) => d.predecessorId === selected || d.successorId === selected) : [];

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Total tugas</span>
            <span className="kpi-icon">
              <Icon name="list-todo" size={16} />
            </span>
          </div>
          <span className="kpi-value">{schedule.tasks.length}</span>
          <span className="kpi-hint">Node pada diagram</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Level dependensi</span>
            <span className="kpi-icon violet">
              <Icon name="network" size={16} />
            </span>
          </div>
          <span className="kpi-value">{layout.levelCount}</span>
          <span className="kpi-hint">Kolom dari akar ke ujung</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Hubungan</span>
            <span className="kpi-icon amber">
              <Icon name="link" size={16} />
            </span>
          </div>
          <span className="kpi-value">{deps.length}</span>
          <span className="kpi-hint">Panah antar tugas</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Tugas kritis</span>
            <span className="kpi-icon red">
              <Icon name="alert-triangle" size={16} />
            </span>
          </div>
          <span className={`kpi-value ${criticalCount > 0 ? 'red' : 'mint'}`}>{criticalCount}</span>
          <span className="kpi-hint">Float ≤ 0</span>
        </div>
      </div>

      <Card
        title={
          <>
            <Icon name="share" size={16} /> Diagram jaringan aktivitas
          </>
        }
        subtitle="Kolom = level ketergantungan. Klik node untuk melihat detail tugas."
        action={
          selected != null ? (
            <Button size="sm" icon="x" onClick={() => setSelected(null)}>
              Tutup detail
            </Button>
          ) : undefined
        }
        bodyless
      >
        <div className="net-wrap">
          <svg width={layout.width} height={layout.height}>
            <defs>
              <marker id="net-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
              </marker>
              <marker id="net-arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#ef4444" />
              </marker>
            </defs>

            {edges.map((e) => (
              <g key={e.key}>
                <path
                  d={e.path}
                  className={`net-edge${e.critical ? ' critical' : ''}`}
                  markerEnd={`url(#${e.critical ? 'net-arrow-crit' : 'net-arrow'})`}
                />
                <text x={e.lx} y={e.ly} textAnchor="middle" className={`net-edge-label${e.critical ? ' critical' : ''}`}>
                  {e.label}
                </text>
              </g>
            ))}

            {schedule.tasks.map((t) => {
              const p = layout.pos.get(t.id)!;
              const isSel = selected === t.id;
              return (
                <g
                  key={t.id}
                  className={`net-node${t.critical ? ' critical' : ''}${isSel ? ' selected' : ''}`}
                  transform={`translate(${p.x},${p.y})`}
                  onClick={() => setSelected(isSel ? null : t.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect width={NODE_W} height={NODE_H} />
                  <text x={10} y={19} fontWeight={650}>
                    {trunc(t.name)}
                  </text>
                  <text x={10} y={36} className="sub">
                    {t.duration} hr · float {t.float}
                  </text>
                  <text x={10} y={53} className="sub">
                    {fmtDateShort(t.es)} → {fmtDateShort(t.ef)}
                  </text>
                  <circle
                    cx={NODE_W - 11}
                    cy={13}
                    r={4.5}
                    fill={
                      t.critical
                        ? '#ef4444'
                        : t.status === 'done'
                          ? '#10b981'
                          : t.status === 'review'
                            ? '#8b5cf6'
                            : t.status === 'todo'
                              ? '#94a3b8'
                              : '#2563eb'
                    }
                  />
                </g>
              );
            })}
          </svg>
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
            <i style={{ background: 'var(--danger)' }} /> Jalur kritis
          </span>
          <span className="muted">Label panah = tipe dependensi + lag</span>
        </div>
      </Card>

      {selectedTask && (
        <Card
          title={
            <>
              <Icon name="list-todo" size={16} /> {selectedTask.name}
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
              <span className="dr-key">Status</span>
              <span className="dr-val">
                <Pill tone={selectedTask.status === 'done' ? 'mint' : selectedTask.critical ? 'red' : 'blue'}>
                  {STATUS_LABEL[selectedTask.status]}
                </Pill>
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Durasi</span>
              <span className="dr-val">{selectedTask.duration} hari kerja</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Jadwal</span>
              <span className="dr-val">
                {fmtDateShort(selectedTask.es)} → {fmtDateShort(selectedTask.ef)}
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Kelonggaran</span>
              <span className="dr-val">{selectedTask.float} hari</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Ditugaskan ke</span>
              <span className="dr-val">{selectedTask.assigneeName ?? 'Belum ada assignee'}</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Hubungan</span>
              <span className="dr-val">{selectedDeps.length} dependensi</span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
