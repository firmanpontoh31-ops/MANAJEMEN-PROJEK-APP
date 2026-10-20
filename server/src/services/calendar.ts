import { ValidationError } from '../errors.js';

const DAY_MS = 86_400_000;
/** Batas iterasi agar kalender tanpa hari kerja tidak berputar tanpa henti. */
const MAX_STEPS = 366 * 50;

export function parseISODate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new ValidationError(`Format tanggal tidak valid: ${iso}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new ValidationError(`Tanggal tidak valid pada kalender: ${iso}`);
  }
  return ms;
}

export function toISODate(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Tambah hari kalender biasa (bisa negatif). */
export function addDays(iso: string, n: number): string {
  return toISODate(parseISODate(iso) + n * DAY_MS);
}

/** Perbandingan string ISO (aman untuk YYYY-MM-DD). */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export interface CalendarConfig {
  /** Hari kerja dalam seminggu: 0 = Minggu ... 6 = Sabtu */
  workingDays: number[];
  /** Daftar hari libur dalam format YYYY-MM-DD */
  holidays: string[];
}

/**
 * Kalender kerja: hari kerja mingguan + hari libur.
 * Semua perhitungan durasi jadwal dilakukan dalam satuan HARI KERJA.
 */
export class WorkingCalendar {
  private readonly working: Set<number>;
  private readonly holidays: Set<string>;

  constructor(config: CalendarConfig) {
    if (!config.workingDays || config.workingDays.length === 0) {
      throw new ValidationError('Kalender kerja harus memiliki minimal satu hari kerja');
    }
    this.working = new Set(config.workingDays);
    this.holidays = new Set(config.holidays ?? []);
  }

  isWorkingDay(iso: string): boolean {
    const dow = new Date(parseISODate(iso)).getUTCDay();
    return this.working.has(dow) && !this.holidays.has(iso);
  }

  /** Hari kerja pertama SETELAH tanggal tsb. */
  nextWorkingDay(iso: string): string {
    let cur = iso;
    for (let i = 0; i < MAX_STEPS; i++) {
      cur = addDays(cur, 1);
      if (this.isWorkingDay(cur)) return cur;
    }
    throw new ValidationError('Kalender kerja tidak memiliki hari kerja yang cukup (periksa hari libur)');
  }

  /** Geser ke hari kerja terdekat ke depan bila tanggal bukan hari kerja. */
  snapForward(iso: string): string {
    return this.isWorkingDay(iso) ? iso : this.nextWorkingDay(iso);
  }

  /**
   * Geser sebanyak `offset` hari kerja (tanda + = ke depan, - = ke belakang).
   * offset 0 mengembalikan tanggal apa adanya.
   */
  shift(iso: string, offset: number): string {
    if (offset === 0) return iso;
    const step = offset > 0 ? 1 : -1;
    let remaining = Math.abs(offset);
    let cur = iso;
    for (let i = 0; i < MAX_STEPS && remaining > 0; i++) {
      cur = addDays(cur, step);
      if (this.isWorkingDay(cur)) remaining--;
    }
    if (remaining > 0) {
      throw new ValidationError('Kalender kerja tidak memiliki hari kerja yang cukup (periksa hari libur)');
    }
    return cur;
  }

  /**
   * Jumlah hari kerja di interval terbuka (from, to].
   * Bila to < from hasilnya negatif. Dipakai untuk menghitung total float.
   */
  countWorkdays(from: string, to: string): number {
    if (from === to) return 0;
    const dir = to > from ? 1 : -1;
    let count = 0;
    let cur = from;
    for (let i = 0; i < MAX_STEPS; i++) {
      cur = addDays(cur, dir);
      if (this.isWorkingDay(cur)) count++;
      if (cur === to) return dir > 0 ? count : -count;
    }
    throw new ValidationError('Rentang tanggal terlalu panjang untuk dihitung');
  }

  /** Jumlah hari kerja inklusif [from, to]. */
  spanWorkdays(from: string, to: string): number {
    if (from > to) return 0;
    let count = 0;
    let cur = from;
    for (let i = 0; i < MAX_STEPS; i++) {
      if (this.isWorkingDay(cur)) count++;
      if (cur === to) return count;
      cur = addDays(cur, 1);
    }
    throw new ValidationError('Rentang tanggal terlalu panjang untuk dihitung');
  }
}
