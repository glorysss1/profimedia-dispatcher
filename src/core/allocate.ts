import { incompatibility } from './compat';
import { FlowNetwork } from './flow';
import type { Assignment, Author, Line } from './types';

export interface AllocateInput {
  authors: Author[];
  lines: Line[];
  /** Закреплённые назначения: остаются как есть и учитываются в лимитах и покрытии. */
  locked: Assignment[];
}

export interface Pair {
  authorId: string;
  lineId: string;
}

/** Порядок закрытия линий: приоритет, затем ранний дедлайн, затем название. */
export function sortLines(lines: Line[]): Line[] {
  return [...lines].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const da = a.deadline || '9999-99-99';
    const db = b.deadline || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    const t = a.title.localeCompare(b.title, 'ru');
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });
}

/**
 * Считает новые назначения (без закреплённых).
 *
 * Шаг 1. Линии закрываются по очереди в порядке sortLines, каждая добавочным
 *        увеличением потока. Уже набранный поток по прежним линиям при этом не
 *        уменьшается, поэтому покрытие максимально в лексикографическом порядке
 *        «высокий приоритет раньше».
 * Шаг 2. При тех же количествах по линиям выбирается самое ровное распределение:
 *        k-я единица нагрузки автора стоит 2k−1, то есть минимизируется сумма
 *        квадратов нагрузок.
 */
export function allocate({ authors, lines, locked }: AllocateInput): Pair[] {
  const liveAuthors = authors.filter((a) => !a.archived);
  const liveLines = sortLines(lines.filter((l) => !l.archived));
  const authorById = new Map(liveAuthors.map((a) => [a.id, a]));
  const lineById = new Map(liveLines.map((l) => [l.id, l]));

  const lockedPairs = new Set<string>();
  const lockedLoad = new Map<string, number>();
  const lockedValid = new Map<string, number>();
  for (const a of locked) {
    const author = authorById.get(a.authorId);
    const line = lineById.get(a.lineId);
    if (!author || !line) continue;
    const key = `${a.authorId}|${a.lineId}`;
    if (lockedPairs.has(key)) continue;
    lockedPairs.add(key);
    lockedLoad.set(a.authorId, (lockedLoad.get(a.authorId) ?? 0) + 1);
    if (incompatibility(author, line).length === 0) {
      lockedValid.set(a.lineId, (lockedValid.get(a.lineId) ?? 0) + 1);
    }
  }

  const candidates = liveAuthors.filter((a) => a.active);
  const freeSlots = (a: Author) => Math.max(0, a.maxPerWeek - (lockedLoad.get(a.id) ?? 0));
  const demand = (l: Line) => Math.max(0, l.minCount - (lockedValid.get(l.id) ?? 0));

  const edges: Array<{ line: Line; author: Author }> = [];
  for (const line of liveLines) {
    if (demand(line) === 0) continue;
    for (const author of candidates) {
      if (freeSlots(author) === 0) continue;
      if (lockedPairs.has(`${author.id}|${line.id}`)) continue;
      if (incompatibility(author, line).length > 0) continue;
      edges.push({ line, author });
    }
  }
  if (edges.length === 0) return [];

  const lineIndex = new Map(liveLines.map((l, i) => [l.id, 1 + i]));
  const authorIndex = new Map(candidates.map((a, i) => [a.id, 1 + liveLines.length + i]));
  const source = 0;
  const sink = 1 + liveLines.length + candidates.length;
  const nodeCount = sink + 1;

  // Шаг 1: максимальное покрытие в порядке приоритета.
  const net1 = new FlowNetwork(nodeCount);
  const sourceEdge = new Map<string, number>();
  for (const line of liveLines) {
    sourceEdge.set(line.id, net1.addEdge(source, lineIndex.get(line.id)!, 0, 0));
  }
  for (const e of edges) {
    net1.addEdge(lineIndex.get(e.line.id)!, authorIndex.get(e.author.id)!, 1, 0);
  }
  for (const a of candidates) {
    net1.addEdge(authorIndex.get(a.id)!, sink, freeSlots(a), 0);
  }
  const achieved = new Map<string, number>();
  for (const line of liveLines) {
    const need = demand(line);
    if (need === 0) continue;
    const se = sourceEdge.get(line.id)!;
    net1.setCapacity(se, need);
    net1.augment(source, sink, need);
    achieved.set(line.id, net1.flowOn(se));
  }

  // Шаг 2: те же количества по линиям, но самая ровная нагрузка.
  const net2 = new FlowNetwork(nodeCount);
  let totalNeed = 0;
  for (const line of liveLines) {
    const d = achieved.get(line.id) ?? 0;
    if (d === 0) continue;
    totalNeed += d;
    net2.addEdge(source, lineIndex.get(line.id)!, d, 0);
  }
  const pairEdges: Array<{ edge: number; pair: Pair }> = [];
  for (const e of edges) {
    if ((achieved.get(e.line.id) ?? 0) === 0) continue;
    const edge = net2.addEdge(lineIndex.get(e.line.id)!, authorIndex.get(e.author.id)!, 1, 0);
    pairEdges.push({ edge, pair: { authorId: e.author.id, lineId: e.line.id } });
  }
  for (const a of candidates) {
    const base = lockedLoad.get(a.id) ?? 0;
    for (let k = 0; k < freeSlots(a); k++) {
      net2.addEdge(authorIndex.get(a.id)!, sink, 1, 2 * (base + k) + 1);
    }
  }
  net2.augment(source, sink, totalNeed);

  return pairEdges.filter((p) => net2.flowOn(p.edge) > 0).map((p) => p.pair);
}
