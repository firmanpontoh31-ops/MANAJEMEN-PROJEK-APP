import { describe, expect, it } from 'vitest';
import { computePert, hasPertEstimates, round2 } from '../services/pert.js';

describe('PERT', () => {
  it('TE = (O + 4M + P) / 6', () => {
    expect(computePert(2, 4, 6).te).toBeCloseTo(4, 10);
    expect(computePert(4, 6, 14).te).toBeCloseTo(7, 10);
    expect(computePert(0, 0, 0).te).toBe(0);
    expect(computePert(3, 3, 9).te).toBeCloseTo(4, 10); // (3+12+9)/6 = 4
  });

  it('SD = (P - O) / 6 dan Var = SD^2', () => {
    const e = computePert(4, 6, 14);
    expect(e.sd).toBeCloseTo(10 / 6, 10);
    expect(e.variance).toBeCloseTo((10 / 6) ** 2, 10);
    const same = computePert(5, 5, 5);
    expect(same.sd).toBe(0);
    expect(same.variance).toBe(0);
  });

  it('round2 membulatkan 2 desimal', () => {
    expect(round2(0.666666)).toBe(0.67);
    expect(round2(2.777777)).toBe(2.78);
    expect(round2(4)).toBe(4);
    expect(round2(1.795)).toBe(1.8);
  });

  it('hasPertEstimates mengecek ketersediaan ketiga nilai', () => {
    expect(hasPertEstimates(1, 2, 3)).toBe(true);
    expect(hasPertEstimates(null, 2, 3)).toBe(false);
    expect(hasPertEstimates(1, null, 3)).toBe(false);
    expect(hasPertEstimates(1, 2, null)).toBe(false);
    expect(hasPertEstimates(0, 0, 0)).toBe(true);
  });
});
