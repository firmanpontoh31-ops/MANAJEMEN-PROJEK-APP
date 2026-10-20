import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fieldErrors, type CalendarData, type Holiday } from '../api';
import Icon from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { FieldError, toast } from '../components/Toast';
import { Button, Card, PageHeader, Tabs } from '../components/ui';
import { errorText, fmtDateLong } from '../ui';

type CalendarTab = 'workdays' | 'holidays' | 'month';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Holiday | null>(null);
  const [tab, setTab] = useState<CalendarTab>('workdays');
  const [monthOffset, setMonthOffset] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api.calendar
      .get()
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = async (dayOfWeek: number) => {
    if (!data) return;
    const current = new Set(data.workdays.filter((w) => w.isWorking).map((w) => w.dayOfWeek));
    if (current.has(dayOfWeek)) current.delete(dayOfWeek);
    else current.add(dayOfWeek);
    if (current.size === 0) {
      toast.error('Minimal harus ada satu hari kerja dalam seminggu.');
      return;
    }
    try {
      await api.calendar.setWorkdays([...current].sort((a, b) => a - b));
      load();
      toast.success('Hari kerja diperbarui — jadwal dihitung ulang otomatis.');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const addHoliday = async () => {
    setFieldErr({});
    if (!holiday.date || !holiday.name.trim()) {
      setFieldErr({
        date: !holiday.date ? 'Tanggal wajib dipilih' : '',
        name: !holiday.name.trim() ? 'Keterangan wajib diisi' : '',
      });
      return;
    }
    setSaving(true);
    try {
      await api.calendar.addHoliday(holiday);
      setHoliday({ date: '', name: '' });
      load();
      toast.success('Hari libur ditambahkan.');
    } catch (e) {
      setFieldErr(fieldErrors(e));
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    const h = confirmTarget;
    if (!h) return;
    try {
      await api.calendar.removeHoliday(h.id);
      setConfirmTarget(null);
      load();
      toast.success('Hari libur dihapus — jadwal dihitung ulang.');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  // Kalender bulan: grid 6 x 7
  const monthGrid = useMemo(() => {
    const now = new Date();
    const view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < firstDow; i++) {
      const d = new Date(year, month, -(firstDow - i - 1));
      cells.push({ date: isoOf(d), day: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: isoOf(new Date(year, month, day)), day, inMonth: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const last = cells[cells.length - 1];
      const d = new Date(`${last.date}T00:00:00`);
      d.setDate(d.getDate() + 1);
      cells.push({ date: isoOf(d), day: d.getDate(), inMonth: false });
      if (cells.length >= 42) break;
    }
    return { year, month, cells };
  }, [monthOffset]);

  const workingSet = useMemo(
    () => new Set((data?.workdays ?? []).filter((w) => w.isWorking).map((w) => w.dayOfWeek)),
    [data],
  );
  const holidayMap = useMemo(() => {
    const m = new Map<string, Holiday>();
    for (const h of data?.holidays ?? []) m.set(h.date, h);
    return m;
  }, [data]);

  if (loading && !data) return <Loading label="Memuat kalender kerja…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;

  const todayIso = isoOf(new Date());
  const workingCount = workingSet.size;
  const monthLabel = `${MONTH_NAMES[monthGrid.month]} ${monthGrid.year}`;

  return (
    <>
      <PageHeader
        title="Kalender kerja"
        subtitle="Hari kerja dan hari libur menjadi dasar seluruh perhitungan durasi: Gantt, PERT, dan CPM memakai satuan hari kerja."
        actions={
          <Button icon="refresh" onClick={load}>
            Muat ulang
          </Button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Hari kerja per minggu</span>
            <span className="kpi-icon">
              <Icon name="calendar" size={16} />
            </span>
          </div>
          <span className="kpi-value blue">{workingCount}</span>
          <span className="kpi-hint">dari 7 hari</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Hari libur terdaftar</span>
            <span className="kpi-icon red">
              <Icon name="flag" size={16} />
            </span>
          </div>
          <span className="kpi-value red">{data?.holidays.length ?? 0}</span>
          <span className="kpi-hint">tidak dihitung sebagai durasi</span>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Hari ini</span>
            <span className="kpi-icon violet">
              <Icon name="clock" size={16} />
            </span>
          </div>
          <span className="kpi-value" style={{ fontSize: 19 }}>
            {fmtDateLong(todayIso)}
          </span>
          <span className="kpi-hint">
            {workingSet.has(new Date(`${todayIso}T00:00:00`).getDay()) ? 'Hari kerja' : 'Hari libur'}
          </span>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'workdays', label: 'Hari kerja mingguan', icon: 'calendar' },
          { key: 'holidays', label: 'Hari libur', icon: 'flag' },
          { key: 'month', label: 'Kalender bulan', icon: 'calendar-clock' },
        ]}
      />

      {tab === 'workdays' && (
        <Card
          title={
            <>
              <Icon name="calendar" size={16} /> Hari kerja mingguan
            </>
          }
          subtitle="Klik hari untuk mengubah status hari kerja. Perubahan langsung memengaruhi perhitungan jadwal."
        >
          <div className="day-toggles">
            {data?.workdays.map((w) => (
              <button
                key={w.dayOfWeek}
                type="button"
                className={`day-toggle ${w.isWorking ? 'on' : 'off'}`}
                onClick={() => toggleDay(w.dayOfWeek)}
                title="Klik untuk mengubah hari kerja"
              >
                {w.label}
                <span className="small" style={{ display: 'block' }}>
                  {w.isWorking ? 'Hari kerja' : 'Libur'}
                </span>
              </button>
            ))}
          </div>
          <p className="small muted mt">
            Minimal satu hari kerja wajib aktif agar seluruh proyek tetap dapat dijadwalkan.
          </p>
        </Card>
      )}

      {tab === 'holidays' && (
        <Card
          title={
            <>
              <Icon name="flag" size={16} /> Hari libur
            </>
          }
          subtitle="Tanggal merah yang tidak dihitung sebagai hari kerja."
        >
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <div className="field">
              <label>
                Tanggal <span className="req">*</span>
              </label>
              <input
                type="date"
                value={holiday.date}
                onChange={(e) => setHoliday({ ...holiday, date: e.target.value })}
              />
              <FieldError message={fieldErr.date} />
            </div>
            <div className="field">
              <label>
                Keterangan <span className="req">*</span>
              </label>
              <input
                value={holiday.name}
                onChange={(e) => setHoliday({ ...holiday, name: e.target.value })}
                placeholder="mis. Hari Natal"
              />
              <FieldError message={fieldErr.name} />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <Button variant="primary" icon="plus" onClick={addHoliday} disabled={saving}>
                Tambah libur
              </Button>
            </div>
          </div>

          {data && data.holidays.length === 0 ? (
            <EmptyState
              icon="flag"
              title="Belum ada hari libur"
              description="Tambahkan tanggal merah agar jadwal lebih akurat."
              action={
                <Button variant="primary" icon="plus" onClick={addHoliday}>
                  Tambah libur
                </Button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Hari</th>
                    <th>Keterangan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.holidays.map((h) => (
                    <tr key={h.id}>
                      <td className="mono">{h.date.split('-').reverse().join('/')}</td>
                      <td className="small">
                        {new Date(`${h.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}
                      </td>
                      <td>{h.name}</td>
                      <td className="actions">
                        <Button
                          size="sm"
                          variant="danger"
                          icon="trash"
                          onClick={() => setConfirmTarget(h)}
                          title="Hapus hari libur"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'month' && (
        <Card
          title={
            <>
              <Icon name="calendar-clock" size={16} /> {monthLabel}
            </>
          }
          subtitle="Kotak biru = hari kerja, kotak merah = hari libur."
          action={
            <div className="row" style={{ gap: 6 }}>
              <Button size="sm" icon="chevron-left" onClick={() => setMonthOffset((m) => m - 1)} title="Bulan sebelumnya" />
              <Button size="sm" onClick={() => setMonthOffset(0)} title="Bulan ini">
                Bulan ini
              </Button>
              <Button size="sm" icon="chevron-right" onClick={() => setMonthOffset((m) => m + 1)} title="Bulan berikutnya" />
            </div>
          }
        >
          <div className="cal-grid" style={{ marginBottom: 8 }}>
            {DAY_SHORT.map((d) => (
              <div className="cal-head" key={d}>
                {d}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {monthGrid.cells.map((c) => {
              const dow = new Date(`${c.date}T00:00:00`).getDay();
              const isHoliday = holidayMap.has(c.date);
              const isWorking = workingSet.has(dow) && !isHoliday;
              return (
                <div
                  key={c.date}
                  className={`cal-cell${c.inMonth ? '' : ' empty'}${
                    c.inMonth && !isWorking ? ' off' : ''
                  }${c.date === todayIso ? ' today' : ''}`}
                >
                  <span className="cal-day">{c.day}</span>
                  {isHoliday && <span className="cal-holiday">{holidayMap.get(c.date)!.name}</span>}
                  {c.inMonth && isWorking && <span className="small muted">Hari kerja</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        danger
        title="Hapus hari libur?"
        message={
          <>
            <b>{confirmTarget?.name}</b> ({confirmTarget?.date?.split('-').reverse().join('/')}) akan dihapus dari
            kalender, dan jadwal proyek dihitung ulang.
          </>
        }
        confirmLabel="Ya, hapus"
        onConfirm={doDelete}
        onDismiss={() => setConfirmTarget(null)}
      />
    </>
  );
}

function isoOf(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
