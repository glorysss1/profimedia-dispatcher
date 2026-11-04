import { allocate } from '../src/core/allocate';
import { analyze } from '../src/core/analyze';
import type { Assignment, PlanData } from '../src/core/types';

export const TODAY = '2026-11-04';

/** То же, что делает кнопка «Распределить»: закреплённые остаются, остальное считается заново. */
export function distribute(plan: PlanData): PlanData {
  const locked = plan.assignments.filter((a) => a.locked);
  const pairs = allocate({ authors: plan.authors, lines: plan.lines, locked });
  const fresh: Assignment[] = pairs.map((p, i) => ({
    id: `n${i}`,
    authorId: p.authorId,
    lineId: p.lineId,
    locked: false,
  }));
  return { ...plan, assignments: [...locked, ...fresh] };
}

export const run = (plan: PlanData) => {
  const result = distribute(plan);
  return { plan: result, analysis: analyze(result, TODAY) };
};

/** Детерминированный генератор для воспроизводимых случайных тестов. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
