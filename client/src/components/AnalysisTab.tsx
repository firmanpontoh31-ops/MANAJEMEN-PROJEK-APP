import { useEffect, useMemo, useState } from 'react';
import { api, PRIORITY_LABEL, STATUS_LABEL, type CpmResult, type PertResult, type ScheduleResult } from '../api';
import { errorText, fmtDateShort } from '../ui';
import { EmptyState, ErrorState, Loading } from './States';
import Icon from './Icon';
import { Button, Card, Pill, ProgressBar, Tabs } from './ui';

type AnalysisTabKey = 'schedule' | 'pert' | 'cpm';

export default function AnalysisTab({ projectId, version }: { projectId: number; version: number }) {
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [pert, setPert] = useState<PertResult | null>(null);
  const [cpm, setCpm] = useState<CpmResult | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<AnalysisTabKey>('schedule');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.analysis.schedule(projectId),
      api.analysis.pert(projectId),
      api.analysis.cpm(projectId),
    ])
      .then(([s, p, c]) => {
        setSchedule(s);
        setPert(p);
        setCpm(c);
        setError('');
      })
      .catch((e) => setError(errorText(e)));
  }, [projectId, version, reload]);

  const selectedTask = useMemo(
    () => (selected != null ? schedule?.tasks.find((t) => t.id === selected) ?? null : null),
    [selected, schedule],
  );

  if (error) return <ErrorState message={error} onRetry={() => setReload((r) => r + 1)} />;
  if (!schedule || !pert || !cpm) return <Loading label="Memuat analisis jadwal…" />;

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
            {fmtDateShort(cpm.startDate)}
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
            {fmtDateShort(cpm.finishDate)}
          </span>
          <span className="kpi-hint">Hasil perhitungan CPM</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Durasi minimum</span>
            <span className="kpi-icon violet">
              <Icon name="clock" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 20 }}>
            {cpm.projectDurationWorkdays}
            <span className="unit"> hari kerja</span>
          </span>
          <span className="kpi-hint">Jalur terpanjang proyek</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Jalur kritis</span>
            <span className="kpi-icon red">
              <Icon name="alert-triangle" size={16} />
            </span>
          </div>
          <span className={`kpi-value ${cpm.criticalTaskCount > 0 ? 'red' : 'mint'}`} style={{ fontSize: 20 }}>
            {cpm.criticalTaskCount}
            <span className="unit"> tugas</span>
          </span>
          <span className="kpi-hint">{cpm.criticalPaths.length} jalur ditemukan</span>
        </div>
      </div>

      {cpm.warnings.map((w, i) => (
        <div className="alert warn" key={i}>
          <Icon name="alert-triangle" size={15} /> {w}
        </div>
      ))}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'schedule', label: 'Jadwal & float', icon: 'activity' },
          { key: 'pert', label: 'PERT', icon: 'calculator' },
          { key: 'cpm', label: 'CPM & jalur kritis', icon: 'target' },
        ]}
      />

      {tab === 'schedule' && (
        <Card
          title={
            <>
              <Icon name="activity" size={16} /> Jadwal & kelonggaran per tugas
            </>
          }
          subtitle="Klik baris untuk melihat rincian perhitungan."
        >
          {schedule.tasks.length === 0 ? (
            <EmptyState icon="activity" title="Belum ada tugas terjadwal" description="Tambahkan tugas pada tab Tugas." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Tugas</th>
                    <th>Durasi</th>
                    <th>ES</th>
                    <th>EF</th>
                    <th>LS</th>
                    <th>LF</th>
                    <th>Float</th>
                    <th>Status</th>
                    <th>Prioritas</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.tasks.map((t) => (
                    <tr
                      key={t.id}
                      className={t.critical ? 'row-critical' : undefined}
                      onClick={() => setSelected(selected === t.id ? null : t.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        {t.name}
                        <div className="small muted">{t.assigneeName ?? 'tanpa penugasan'}</div>
                      </td>
                      <td>{t.duration} hr</td>
                      <td className="mono">{fmtDateShort(t.es)}</td>
                      <td className="mono">{fmtDateShort(t.ef)}</td>
                      <td className="mono">{fmtDateShort(t.ls)}</td>
                      <td className="mono">{fmtDateShort(t.lf)}</td>
                      <td>
                        <Pill tone={t.float <= 0 ? 'red' : t.float < 3 ? 'amber' : 'mint'}>{t.float} hr</Pill>
                      </td>
                      <td>
                        <Pill tone={t.status === 'done' ? 'mint' : t.critical ? 'red' : 'blue'}>
                          {STATUS_LABEL[t.status]}
                        </Pill>
                      </td>
                      <td>
                        <Pill tone={t.priority === 'critical' ? 'red' : t.priority === 'high' ? 'amber' : 'slate'}>
                          {PRIORITY_LABEL[t.priority]}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted mt">
            ES = mulai paling awal · EF = selesai paling awal · LS = mulai paling akhir · LF = selesai paling akhir ·
            Float = kelonggaran total (hari kerja) · kritis bila float ≤ 0
          </p>
        </Card>
      )}

      {tab === 'pert' && (
        <Card
          title={
            <>
              <Icon name="calculator" size={16} /> PERT — Program Evaluation &amp; Review Technique
            </>
          }
          subtitle="Perkiraan durasi harapan dan tingkat ketidakpastian tiap tugas."
          action={<span className="chip mono">{pert.formula.expected}</span>}
        >
          <div className="kv" style={{ marginBottom: 16 }}>
            <div>
              <div className="k">Tugas berevaluasi</div>
              <div className="v">
                {pert.summary.estimatedTasks}/{pert.summary.totalTasks}
              </div>
            </div>
            <div>
              <div className="k">Σ durasi harapan (TE)</div>
              <div className="v">{pert.summary.teSum} hr</div>
            </div>
            <div>
              <div className="k">Σ varian</div>
              <div className="v">{pert.summary.varianceSum}</div>
            </div>
            <div>
              <div className="k">Simpangan baku (√ΣVar)</div>
              <div className="v">{pert.summary.sd}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tugas</th>
                  <th>O</th>
                  <th>M</th>
                  <th>P</th>
                  <th>TE</th>
                  <th>SD</th>
                  <th>Varian</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {pert.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="mono">{t.optimistic ?? '-'}</td>
                    <td className="mono">{t.mostLikely ?? '-'}</td>
                    <td className="mono">{t.pessimistic ?? '-'}</td>
                    <td className="mono">
                      <b>{t.te ?? '-'}</b>
                    </td>
                    <td className="mono">{t.sd ?? '-'}</td>
                    <td className="mono">{t.variance ?? '-'}</td>
                    <td>
                      {t.hasEstimates ? (
                        <Pill tone="mint">Lengkap</Pill>
                      ) : (
                        <Pill tone="amber">Belum ada estimasi</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pert.missingEstimates.length > 0 && (
            <div className="alert warn mt">
              <Icon name="alert-triangle" size={15} />
              {pert.missingEstimates.length} tugas belum memiliki estimasi O/M/P:{' '}
              {pert.missingEstimates.map((m) => m.name).join(', ')}
            </div>
          )}
        </Card>
      )}

      {tab === 'cpm' && (
        <>
          <Card
            title={
              <>
                <Icon name="target" size={16} /> Jalur kritis proyek
              </>
            }
            subtitle="Rangkaian tugas dengan kelonggaran nol — keterlambatan di sini menggeser seluruh proyek."
          >
            {cpm.criticalPaths.length === 0 ? (
              <EmptyState
                icon="check-circle"
                title="Tidak ada jalur kritis"
                description="Semua tugas memiliki kelonggaran lebih dari nol, sehingga proyek punya ruang lebih longgar."
              />
            ) : (
              cpm.criticalPaths.map((p, i) => (
                <div className="mb" key={i} style={{ marginBottom: 14 }}>
                  <div className="small muted" style={{ marginBottom: 6 }}>
                    Jalur {i + 1} — {p.lengthWorkdays} hari kerja · {p.taskNames.length} tugas
                  </div>
                  <div className="chips">
                    {p.taskNames.map((n, j) => (
                      <span key={j} className="chip crit">
                        {j > 0 && <span className="arrow">→</span>}
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}

            {cpm.pert && (
              <div className="kv mt">
                <div>
                  <div className="k">TE jalur kritis</div>
                  <div className="v">{cpm.pert.teSum} hr</div>
                </div>
                <div>
                  <div className="k">Varian jalur</div>
                  <div className="v">{cpm.pert.varianceSum}</div>
                </div>
                <div>
                  <div className="k">SD proyek √ΣVar</div>
                  <div className="v">{cpm.pert.sd}</div>
                </div>
                <div>
                  <div className="k">Rentang (ΣO – ΣP)</div>
                  <div className="v" style={{ fontSize: 15 }}>
                    {cpm.pert.optimisticSum} – {cpm.pert.pessimisticSum}
                  </div>
                </div>
              </div>
            )}
            {cpm.pert && <p className="small muted mt">{cpm.pert.note}</p>}
          </Card>

          <Card
            title={
              <>
                <Icon name="list-todo" size={16} /> Rincian tugas kritis
              </>
            }
          >
            {cpm.tasks.filter((t) => t.critical).length === 0 ? (
              <EmptyState icon="info" title="Tidak ada tugas kritis" description="Semua tugas memiliki float lebih dari 0." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Tugas</th>
                      <th>Durasi</th>
                      <th>ES</th>
                      <th>EF</th>
                      <th>Float</th>
                      <th>Progres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cpm.tasks
                      .filter((t) => t.critical)
                      .map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td>{t.duration} hr</td>
                          <td className="mono">{fmtDateShort(t.es)}</td>
                          <td className="mono">{fmtDateShort(t.ef)}</td>
                          <td>
                            <Pill tone="red">{t.float} hr</Pill>
                          </td>
                          <td style={{ minWidth: 150 }}>
                            <ProgressBar value={t.progress} tone={t.progress >= 100 ? 'mint' : 'blue'} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {selectedTask && tab === 'schedule' && (
        <Card
          title={
            <>
              <Icon name="list-todo" size={16} /> Rincian {selectedTask.name}
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
              <span className="dr-key">Durasi</span>
              <span className="dr-val">{selectedTask.duration} hari kerja</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Mulai (ES) · Selesai (EF)</span>
              <span className="dr-val">
                {fmtDateShort(selectedTask.es)} → {fmtDateShort(selectedTask.ef)}
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Mulai (LS) · Selesai (LF)</span>
              <span className="dr-val">
                {fmtDateShort(selectedTask.ls)} → {fmtDateShort(selectedTask.lf)}
              </span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Kelonggaran (float)</span>
              <span className="dr-val">{selectedTask.float} hari kerja</span>
            </div>
            <div className="detail-row">
              <span className="dr-key">Status</span>
              <span className="dr-val">
                <Pill tone={selectedTask.status === 'done' ? 'mint' : selectedTask.critical ? 'red' : 'blue'}>
                  {STATUS_LABEL[selectedTask.status]}
                </Pill>
              </span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
