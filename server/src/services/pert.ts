export interface PertRaw {
  te: number;
  sd: number;
  variance: number;
}

/** Pembulatan 2 desimal untuk output. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Estimasi PERT:
 *   TE  = (O + 4M + P) / 6   (Time Expected)
 *   SD  = (P - O) / 6        (Standard Deviation)
 *   Var = SD^2               (Variance)
 */
export function computePert(optimistic: number, mostLikely: number, pessimistic: number): PertRaw {
  const te = (optimistic + 4 * mostLikely + pessimistic) / 6;
  const sd = (pessimistic - optimistic) / 6;
  return { te, sd, variance: sd * sd };
}

/** True bila ketiga estimasi tersedia dan numerik. */
export function hasPertEstimates(
  optimistic: number | null,
  mostLikely: number | null,
  pessimistic: number | null,
): boolean {
  return (
    optimistic != null && mostLikely != null && pessimistic != null &&
    Number.isFinite(optimistic) && Number.isFinite(mostLikely) && Number.isFinite(pessimistic)
  );
}
