import { ConflictError } from '../errors.js';

export interface GraphEdge {
  from: number;
  to: number;
}

/**
 * Deteksi siklus dengan Kahn (topological sort).
 * Mengembalikan urutan topologis, atau melempar ConflictError berisi
 * daftar id tugas yang terlibat siklus bila graph tidak DAG.
 */
export function topologicalOrder(nodes: number[], edges: GraphEdge[]): number[] {
  const indegree = new Map<number, number>();
  const adjacency = new Map<number, number[]>();

  for (const n of nodes) {
    indegree.set(n, 0);
    adjacency.set(n, []);
  }

  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue; // entitas sudah terhapus
    adjacency.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  // Proses node berindegree 0 dengan id terkecil agar deterministik
  const ready = nodes.filter((n) => indegree.get(n) === 0).sort((a, b) => a - b);
  const order: number[] = [];

  while (ready.length > 0) {
    const cur = ready.shift()!;
    order.push(cur);
    for (const next of adjacency.get(cur) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) {
        ready.push(next);
        ready.sort((a, b) => a - b);
      }
    }
  }

  if (order.length !== nodes.length) {
    const involved = nodes.filter((n) => !order.includes(n));
    throw new ConflictError('Dependensi antar tugas membentuk siklus', { taskIds: involved });
  }

  return order;
}

/** True bila graph (nodes+edges) mengandung siklus. */
export function hasCycle(nodes: number[], edges: GraphEdge[]): boolean {
  try {
    topologicalOrder(nodes, edges);
    return false;
  } catch (err) {
    if (err instanceof ConflictError) return true;
    throw err;
  }
}
