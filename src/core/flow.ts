/**
 * Сеть потока минимальной стоимости (последовательные кратчайшие пути, SPFA).
 * Объёмы крошечные (десятки узлов), поэтому важнее простота и детерминизм.
 */
export class FlowNetwork {
  private readonly adj: number[][];
  private readonly to: number[] = [];
  private readonly cap: number[] = [];
  private readonly cost: number[] = [];

  constructor(private readonly size: number) {
    this.adj = Array.from({ length: size }, () => []);
  }

  /** Добавляет ребро и обратное к нему. Возвращает индекс прямого ребра. */
  addEdge(from: number, toNode: number, capacity: number, cost: number): number {
    const id = this.to.length;
    this.to.push(toNode, from);
    this.cap.push(capacity, 0);
    this.cost.push(cost, -cost);
    this.adj[from]!.push(id);
    this.adj[toNode]!.push(id + 1);
    return id;
  }

  setCapacity(edge: number, capacity: number): void {
    this.cap[edge] = capacity;
  }

  /** Поток, прошедший по прямому ребру. */
  flowOn(edge: number): number {
    return this.cap[edge ^ 1]!;
  }

  /** Пускает до `limit` единиц потока из s в t по самым дешёвым путям. */
  augment(s: number, t: number, limit: number): number {
    let total = 0;
    while (total < limit) {
      const dist = new Array<number>(this.size).fill(Infinity);
      const inQueue = new Array<boolean>(this.size).fill(false);
      const prevEdge = new Array<number>(this.size).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      let head = 0;
      while (head < queue.length) {
        const u = queue[head++]!;
        inQueue[u] = false;
        for (const e of this.adj[u]!) {
          if (this.cap[e]! <= 0) continue;
          const v = this.to[e]!;
          const nd = dist[u]! + this.cost[e]!;
          if (nd < dist[v]!) {
            dist[v] = nd;
            prevEdge[v] = e;
            if (!inQueue[v]) {
              inQueue[v] = true;
              queue.push(v);
            }
          }
        }
      }
      if (dist[t] === Infinity) break;
      let push = limit - total;
      for (let v = t; v !== s; v = this.to[prevEdge[v]! ^ 1]!) {
        push = Math.min(push, this.cap[prevEdge[v]!]!);
      }
      for (let v = t; v !== s; v = this.to[prevEdge[v]! ^ 1]!) {
        const e = prevEdge[v]!;
        this.cap[e] = this.cap[e]! - push;
        this.cap[e ^ 1] = this.cap[e ^ 1]! + push;
      }
      total += push;
    }
    return total;
  }
}
