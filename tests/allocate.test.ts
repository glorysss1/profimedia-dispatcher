import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analyze';
import { incompatibility } from '../src/core/compat';
import { CATEGORIES, FORMATS, SUBJECTS } from '../src/core/constants';
import { SCENARIOS, demoPlan } from '../src/core/demo';
import type { Author, Line, PlanData } from '../src/core/types';
import { TODAY, distribute, rng, run } from './helpers';

describe('сценарии из демо-набора', () => {
  for (const s of SCENARIOS) {
    it(`${s.title}: ожидается «${s.expect}»`, () => {
      const { analysis } = run(s.data);
      expect(analysis.complete).toBe(s.expect === 'complete');
      // Алгоритм сам никогда не создаёт конфликтов, нехватка — только про покрытие.
      expect(analysis.issues.filter((i) => i.kind === 'conflict')).toEqual([]);
      if (s.expect === 'shortage') {
        expect(analysis.issues.some((i) => i.kind === 'shortage')).toBe(true);
        expect(analysis.coveredLines).toBeLessThan(analysis.totalLines);
      }
    });
  }

  it('демо: 5 линий покрыто, назначено 14 из 14', () => {
    const { analysis } = run(demoPlan());
    expect(analysis.coveredLines).toBe(5);
    expect(analysis.assignedValid).toBe(14);
    expect(analysis.requiredTotal).toBe(14);
  });

  it('нехватка называет конкретные числа и причину', () => {
    const s = SCENARIOS.find((x) => x.id === 'no-physics')!;
    const { analysis } = run(s.data);
    const msg = analysis.issues.find((i) => i.kind === 'shortage')!.message;
    expect(msg).toContain('Физика и математика за 60 секунд');
    expect(msg).toMatch(/назначено 1 из 2, не хватает 1/);
    expect(msg).toMatch(/Подходящих активных авторов только 1/);
  });

  it('«нужно больше разных авторов, чем есть» объясняет правило «один автор — одна линия»', () => {
    const s = SCENARIOS.find((x) => x.id === 'many-for-one')!;
    const msg = run(s.data).analysis.issues.find((i) => i.kind === 'shortage')!.message;
    expect(msg).toMatch(/нужно 10 разных/);
  });

  it('лимиты исчерпаны: высокий приоритет закрывается раньше низкого', () => {
    const s = SCENARIOS.find((x) => x.id === 'tight-limits')!;
    const { analysis } = run(s.data);
    const byId = new Map(analysis.lineStats.map((x) => [x.line.id, x]));
    expect(byId.get('l1')!.covered).toBe(true);
    expect(byId.get('l2')!.covered).toBe(true);
    expect(byId.get('l5')!.covered).toBe(false);
    expect(analysis.assignedValid).toBe(7);
  });
});

describe('закрепления и повторный расчёт', () => {
  it('закреплённое остаётся, лимиты и покрытие учитывают его', () => {
    const plan = demoPlan();
    plan.assignments = [{ id: 'm1', authorId: 'a7', lineId: 'l1', locked: true }];
    const { plan: out, analysis } = run(plan);
    expect(out.assignments.find((a) => a.id === 'm1')).toBeDefined();
    expect(analysis.complete).toBe(true);
    expect(out.assignments.filter((a) => a.lineId === 'l1')).toHaveLength(4);
  });

  it('закреплённый автор на несовместимой линии даёт конфликт и не считается покрытием', () => {
    const plan = demoPlan();
    plan.assignments = [{ id: 'm1', authorId: 'a6', lineId: 'l2', locked: true }];
    const { analysis } = run(plan);
    expect(analysis.complete).toBe(false);
    expect(analysis.issues.some((i) => i.kind === 'conflict' && i.lineId === 'l2')).toBe(true);
    expect(analysis.lineStats.find((s) => s.line.id === 'l2')!.covered).toBe(true); // 2 валидных набрал алгоритм
  });

  it('повторный расчёт даёт тот же результат', () => {
    const once = distribute(demoPlan());
    const twice = distribute(once);
    const key = (p: PlanData) => p.assignments.map((a) => `${a.authorId}>${a.lineId}`).sort();
    expect(key(twice)).toEqual(key(once));
  });
});

describe('равномерность', () => {
  it('одинаковые авторы получают нагрузку с разницей не больше 1', () => {
    const authors: Author[] = Array.from({ length: 4 }, (_, i) => ({
      id: `a${i}`, name: `A${i}`, category: 'staff', subject: 'Математика', active: true,
      maxPerWeek: 5, formats: [], specialization: '', archived: false,
    }));
    const lines: Line[] = Array.from({ length: 3 }, (_, i) => ({
      id: `l${i}`, title: `L${i}`, description: '', priority: 1, minCount: 3, categories: [],
      subjects: [], requiredFormat: null, nativeIntegration: '', deadline: '', archived: false,
    }));
    const { analysis } = run({ authors, lines, assignments: [] });
    const loads = analysis.authorStats.map((s) => s.load);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
    expect(analysis.complete).toBe(true);
  });
});

describe('граничные случаи', () => {
  it('пустой план не объявляется выполненным', () => {
    expect(analyze({ authors: [], lines: [], assignments: [] }, TODAY).complete).toBe(false);
  });
  it('архивные автор и линия не участвуют', () => {
    const plan = demoPlan();
    plan.authors.forEach((a) => (a.archived = true));
    const { plan: out, analysis } = run(plan);
    expect(out.assignments).toHaveLength(0);
    expect(analysis.complete).toBe(false);
  });
  it('лимит 0 у активного автора даёт предупреждение', () => {
    const plan = demoPlan();
    plan.authors[0]!.maxPerWeek = 0;
    const { analysis } = run(plan);
    expect(analysis.issues.some((i) => i.kind === 'warning' && /лимит равен 0/.test(i.message))).toBe(true);
  });
  it('прошедший дедлайн — предупреждение', () => {
    const plan = demoPlan();
    plan.lines[0]!.deadline = '2026-11-01';
    expect(analyze(distribute(plan), TODAY).issues.some((i) => i.kind === 'warning' && /дедлайн/i.test(i.message))).toBe(true);
  });
  it('ручное превышение лимита, дубль и несовместимость видны как конфликты', () => {
    const plan = demoPlan();
    plan.assignments = [
      { id: '1', authorId: 'a2', lineId: 'l1', locked: true },
      { id: '2', authorId: 'a2', lineId: 'l1', locked: true },
      { id: '3', authorId: 'a2', lineId: 'l3', locked: true },
      { id: '4', authorId: 'a2', lineId: 'l4', locked: true },
    ];
    const msgs = analyze(plan, TODAY).issues.filter((i) => i.kind === 'conflict').map((i) => i.message);
    expect(msgs.some((m) => /дважды/.test(m))).toBe(true);
    expect(msgs.some((m) => /лимит 2/.test(m))).toBe(true);
    expect(msgs.some((m) => /не подходит/.test(m))).toBe(true);
  });
});

/** Эталон: полный перебор всех допустимых наборов назначений на маленьких данных. */
function bruteForce(plan: PlanData) {
  const active = plan.authors.filter((a) => a.active && !a.archived);
  const edges: Array<[Author, Line]> = [];
  for (const l of plan.lines) for (const a of active) if (incompatibility(a, l).length === 0) edges.push([a, l]);
  const tiers = [1, 2, 3];
  let best: number[] | null = null;
  const feasible: Array<{ vec: number[]; perLine: Map<string, number>; sq: number }> = [];
  for (let mask = 0; mask < 1 << edges.length; mask++) {
    const perLine = new Map<string, number>();
    const perAuthor = new Map<string, number>();
    let ok = true;
    for (let i = 0; i < edges.length && ok; i++) {
      if (!(mask & (1 << i))) continue;
      const [a, l] = edges[i]!;
      perLine.set(l.id, (perLine.get(l.id) ?? 0) + 1);
      perAuthor.set(a.id, (perAuthor.get(a.id) ?? 0) + 1);
      if (perLine.get(l.id)! > l.minCount || perAuthor.get(a.id)! > a.maxPerWeek) ok = false;
    }
    if (!ok) continue;
    const vec = tiers.map((t) =>
      plan.lines.filter((l) => l.priority === t).reduce((s, l) => s + (perLine.get(l.id) ?? 0), 0),
    );
    const sq = [...perAuthor.values()].reduce((s, n) => s + n * n, 0);
    feasible.push({ vec, perLine, sq });
    if (!best || lexGreater(vec, best)) best = vec;
  }
  return { best: best!, feasible };
}
const lexGreater = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
};

describe('сравнение с полным перебором на случайных данных', () => {
  it('покрытие лексикографически максимально, нагрузка самая ровная, правила не нарушены', () => {
    const rand = rng(20261104);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
    for (let iter = 0; iter < 400; iter++) {
      const nA = 2 + Math.floor(rand() * 3);
      const nL = 1 + Math.floor(rand() * 3);
      const authors: Author[] = Array.from({ length: nA }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, category: pick(CATEGORIES).id, subject: pick(SUBJECTS.slice(0, 3)),
        active: rand() > 0.15, maxPerWeek: Math.floor(rand() * 3),
        formats: rand() > 0.5 ? [] : [pick(FORMATS.slice(0, 3))], specialization: '', archived: false,
      }));
      const lines: Line[] = Array.from({ length: nL }, (_, i) => ({
        id: `l${i}`, title: `L${i}`, description: '', priority: pick([1, 2, 3] as const),
        minCount: 1 + Math.floor(rand() * 3),
        categories: rand() > 0.5 ? [] : [pick(CATEGORIES).id],
        subjects: rand() > 0.5 ? [] : [pick(SUBJECTS.slice(0, 3))],
        requiredFormat: rand() > 0.6 ? pick(FORMATS.slice(0, 3)) : null,
        nativeIntegration: '', deadline: '', archived: false,
      }));
      const plan: PlanData = { authors, lines, assignments: [] };
      const out = distribute(plan);
      const analysis = analyze(out, TODAY);

      expect(analysis.issues.filter((i) => i.kind === 'conflict'), `iter ${iter}`).toEqual([]);

      const perLine = new Map<string, number>();
      for (const a of out.assignments) perLine.set(a.lineId, (perLine.get(a.lineId) ?? 0) + 1);
      const vec = [1, 2, 3].map((t) =>
        lines.filter((l) => l.priority === t).reduce((s, l) => s + (perLine.get(l.id) ?? 0), 0),
      );
      const { best, feasible } = bruteForce(plan);
      expect(vec, `iter ${iter}: покрытие`).toEqual(best);

      const loads = new Map<string, number>();
      for (const a of out.assignments) loads.set(a.authorId, (loads.get(a.authorId) ?? 0) + 1);
      const sq = [...loads.values()].reduce((s, n) => s + n * n, 0);
      const sameCounts = feasible.filter((f) => lines.every((l) => (f.perLine.get(l.id) ?? 0) === (perLine.get(l.id) ?? 0)));
      expect(sq, `iter ${iter}: ровность`).toBe(Math.min(...sameCounts.map((f) => f.sq)));
    }
  });
});
