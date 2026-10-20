/** Helper presentasi: warna status/prioritas, format tanggal, dan pesan error. */

export type Tone = 'blue' | 'violet' | 'mint' | 'amber' | 'red' | 'slate';

export const STATUS_TONE: Record<string, Tone> = {
  planning: 'violet',
  active: 'blue',
  on_hold: 'amber',
  completed: 'mint',
  cancelled: 'slate',
  todo: 'slate',
  in_progress: 'blue',
  review: 'violet',
  done: 'mint',
};

export const PRIORITY_TONE: Record<string, Tone> = {
  low: 'slate',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
};

export function statusBadge(status: string): string {
  return `pill pill-${STATUS_TONE[status] ?? 'slate'}`;
}

export function priorityBadge(priority: string): string {
  return `pill pill-${PRIORITY_TONE[priority] ?? 'slate'}`;
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Terjadi kesalahan yang tidak diketahui';
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
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

/** "Senin, 20 Oktober 2026" */
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "20/10/2026" */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '-';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

/** Waktu relatif sederhana: "baru saja", "3 jam lalu", "2 hari lalu". */
export function relativeTime(sqlDateTime: string | null | undefined): string {
  if (!sqlDateTime) return '-';
  const normalized = sqlDateTime.includes('T') ? sqlDateTime : sqlDateTime.replace(' ', 'T') + 'Z';
  const t = new Date(normalized).getTime();
  if (Number.isNaN(t)) return sqlDateTime;
  const diff = Date.now() - t;
  const menit = Math.round(diff / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return fmtDateShort(sqlDateTime.slice(0, 10));
}

/** Sapaan sesuai waktu lokal. */
export function greeting(now = new Date()): string {
  const jam = now.getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Sisa hari sampai tenggat (negatif = sudah lewat). */
export function daysUntil(iso: string, today = new Date()): number {
  const t = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((t - base) / 86_400_000);
}
