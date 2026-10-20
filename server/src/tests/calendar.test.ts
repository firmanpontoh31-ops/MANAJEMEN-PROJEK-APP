import { describe, expect, it } from 'vitest';
import { WorkingCalendar, addDays, compareDates } from '../services/calendar.js';

// 2026-11-02 = Senin; 2026-11-07 = Sabtu; 2026-11-09 = Senin
const cal = new WorkingCalendar({
  workingDays: [1, 2, 3, 4, 5],
  holidays: ['2026-11-04'],
});

describe('WorkingCalendar', () => {
  it('mengenali hari kerja, akhir pekan, dan hari libur', () => {
    expect(cal.isWorkingDay('2026-11-02')).toBe(true); // Senin
    expect(cal.isWorkingDay('2026-11-07')).toBe(false); // Sabtu
    expect(cal.isWorkingDay('2026-11-08')).toBe(false); // Minggu
    expect(cal.isWorkingDay('2026-11-04')).toBe(false); // libur (Rabu)
  });

  it('shift ke depan melewati akhir pekan', () => {
    expect(cal.shift('2026-11-02', 1)).toBe('2026-11-03');
    expect(cal.shift('2026-11-06', 1)).toBe('2026-11-09'); // Jumat -> Senin
  });

  it('shift ke depan melewati hari libur', () => {
    // Selasa +1 hari kerja melewati libur Rabu -> Kamis
    expect(cal.shift('2026-11-03', 1)).toBe('2026-11-05');
    expect(cal.shift('2026-11-03', 2)).toBe('2026-11-06');
  });

  it('shift ke belakang', () => {
    expect(cal.shift('2026-11-05', -1)).toBe('2026-11-03'); // lewati libur Rabu
    expect(cal.shift('2026-11-09', -1)).toBe('2026-11-06'); // Senin -> Jumat
  });

  it('shift 0 mengembalikan tanggal yang sama', () => {
    expect(cal.shift('2026-11-04', 0)).toBe('2026-11-04'); // tanggal libur pun dipertahankan
  });

  it('snapForward memindahkan tanggal non-kerja ke hari kerja berikutnya', () => {
    expect(cal.snapForward('2026-11-07')).toBe('2026-11-09'); // Sabtu -> Senin
    expect(cal.snapForward('2026-11-04')).toBe('2026-11-05'); // libur -> Kamis
    expect(cal.snapForward('2026-11-02')).toBe('2026-11-02'); // sudah kerja
  });

  it('countWorkdays menghitung interval terbuka (from, to]', () => {
    expect(cal.countWorkdays('2026-11-02', '2026-11-02')).toBe(0);
    expect(cal.countWorkdays('2026-11-02', '2026-11-03')).toBe(1);
    // 03(✓) 04(libur✗) 05(✓) 06(✓) = 3 hari kerja
    expect(cal.countWorkdays('2026-11-02', '2026-11-06')).toBe(3);
    expect(cal.countWorkdays('2026-11-06', '2026-11-02')).toBe(-3);
  });

  it('spanWorkdays menghitung inklusif [from, to]', () => {
    // 02 03 (04 libur) 05 06 = 4 hari kerja
    expect(cal.spanWorkdays('2026-11-02', '2026-11-06')).toBe(4);
    expect(cal.spanWorkdays('2026-11-02', '2026-11-02')).toBe(1);
    expect(cal.spanWorkdays('2026-11-06', '2026-11-02')).toBe(0);
  });

  it('menolak kalender tanpa hari kerja', () => {
    expect(() => new WorkingCalendar({ workingDays: [], holidays: [] })).toThrow();
  });
});

describe('util tanggal', () => {
  it('addDays bekerja lintas bulan', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('compareDates mengurutkan ISO', () => {
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
  });
});
