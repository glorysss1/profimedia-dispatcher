import { describe, expect, it } from 'vitest';
import { demoPlan } from '../src/core/demo';
import { BACKUP_KEY, STORAGE_KEY, loadPlan, parsePlan, savePlan } from '../src/core/storage';

const memory = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
const wrap = (p: object) => ({ schemaVersion: 1, ...p });

describe('parsePlan', () => {
  it('принимает корректные данные после JSON-цикла', () => {
    const plan = demoPlan();
    expect(parsePlan(JSON.parse(JSON.stringify(wrap(plan))))).toEqual(plan);
  });
  it.each([
    ['чужая версия схемы', () => ({ ...wrap(demoPlan()), schemaVersion: 2 })],
    ['не объект', () => 'строка'],
    ['неизвестная категория', () => { const p = demoPlan(); (p.authors[0] as unknown as { category: string }).category = 'vip'; return wrap(p); }],
    ['слишком длинное имя', () => { const p = demoPlan(); p.authors[0]!.name = 'я'.repeat(61); return wrap(p); }],
    ['лимит вне диапазона', () => { const p = demoPlan(); p.authors[0]!.maxPerWeek = 99; return wrap(p); }],
    ['дробный минимум', () => { const p = demoPlan(); p.lines[0]!.minCount = 1.5; return wrap(p); }],
    ['несуществующая дата', () => { const p = demoPlan(); p.lines[0]!.deadline = '2026-02-31'; return wrap(p); }],
    ['повтор id', () => { const p = demoPlan(); p.authors[1]!.id = p.authors[0]!.id; return wrap(p); }],
    ['id с опасными символами', () => { const p = demoPlan(); p.authors[0]!.id = '<img onerror=x>'; return wrap(p); }],
  ])('отклоняет: %s', (_n, make) => {
    expect(parsePlan(make())).toBeNull();
  });
  it('молча убирает назначения на несуществующие объекты', () => {
    const p = demoPlan();
    p.assignments = [{ id: 'x', authorId: 'ghost', lineId: 'l1', locked: true }, { id: 'y', authorId: 'a1', lineId: 'l1', locked: false }];
    expect(parsePlan(wrap(p))!.assignments.map((a) => a.id)).toEqual(['y']);
  });
});

describe('loadPlan / savePlan', () => {
  it('пустое хранилище → демо без сообщения', () => {
    const r = loadPlan(memory());
    expect(r.notice).toBeNull();
    expect(r.plan.authors).toHaveLength(8);
    expect(r.plan.lines).toHaveLength(5);
  });
  it('сохранение и чтение возвращают те же данные', () => {
    const s = memory();
    const plan = demoPlan();
    plan.assignments = [{ id: 'z', authorId: 'a1', lineId: 'l1', locked: true }];
    expect(savePlan(s, plan)).toBe(true);
    expect(loadPlan(s).plan).toEqual(plan);
  });
  it('повреждённый JSON → демо, предупреждение и копия', () => {
    const s = memory();
    s.m.set(STORAGE_KEY, '{oops');
    const r = loadPlan(s);
    expect(r.notice).toMatch(/повреждены/);
    expect(s.m.get(BACKUP_KEY)).toBe('{oops');
  });
  it('переполненное хранилище → savePlan возвращает false, а не падает', () => {
    expect(savePlan({ setItem: () => { throw new Error('quota'); } }, demoPlan())).toBe(false);
  });
});
