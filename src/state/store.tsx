import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { allocate } from '../core/allocate';
import { analyze, type Analysis } from '../core/analyze';
import { SCENARIOS } from '../core/demo';
import { loadPlan, savePlan } from '../core/storage';
import type { Assignment, Author, Line, PlanData } from '../core/types';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export type Action =
  | { type: 'saveAuthor'; author: Author }
  | { type: 'archiveAuthor'; id: string }
  | { type: 'restoreAuthor'; id: string }
  | { type: 'purgeAuthor'; id: string }
  | { type: 'saveLine'; line: Line }
  | { type: 'archiveLine'; id: string }
  | { type: 'restoreLine'; id: string }
  | { type: 'purgeLine'; id: string }
  | { type: 'distribute' }
  | { type: 'addAssignment'; authorId: string; lineId: string }
  | { type: 'removeAssignment'; id: string }
  | { type: 'toggleLock'; id: string }
  | { type: 'clearAssignments' }
  | { type: 'loadScenario'; id: string };

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function reducer(plan: PlanData, action: Action): PlanData {
  switch (action.type) {
    case 'saveAuthor':
      return { ...plan, authors: upsert(plan.authors, action.author) };
    case 'archiveAuthor':
      return {
        authors: plan.authors.map((a) => (a.id === action.id ? { ...a, archived: true } : a)),
        lines: plan.lines,
        assignments: plan.assignments.filter((s) => s.authorId !== action.id),
      };
    case 'restoreAuthor':
      return { ...plan, authors: plan.authors.map((a) => (a.id === action.id ? { ...a, archived: false } : a)) };
    case 'purgeAuthor':
      return {
        ...plan,
        authors: plan.authors.filter((a) => a.id !== action.id),
        assignments: plan.assignments.filter((s) => s.authorId !== action.id),
      };
    case 'saveLine':
      return { ...plan, lines: upsert(plan.lines, action.line) };
    case 'archiveLine':
      return {
        authors: plan.authors,
        lines: plan.lines.map((l) => (l.id === action.id ? { ...l, archived: true } : l)),
        assignments: plan.assignments.filter((s) => s.lineId !== action.id),
      };
    case 'restoreLine':
      return { ...plan, lines: plan.lines.map((l) => (l.id === action.id ? { ...l, archived: false } : l)) };
    case 'purgeLine':
      return {
        ...plan,
        lines: plan.lines.filter((l) => l.id !== action.id),
        assignments: plan.assignments.filter((s) => s.lineId !== action.id),
      };
    case 'distribute': {
      const locked = plan.assignments.filter((a) => a.locked);
      const fresh: Assignment[] = allocate({ authors: plan.authors, lines: plan.lines, locked }).map((p) => ({
        id: uid(),
        authorId: p.authorId,
        lineId: p.lineId,
        locked: false,
      }));
      return { ...plan, assignments: [...locked, ...fresh] };
    }
    case 'addAssignment':
      if (plan.assignments.some((a) => a.authorId === action.authorId && a.lineId === action.lineId)) return plan;
      return {
        ...plan,
        assignments: [...plan.assignments, { id: uid(), authorId: action.authorId, lineId: action.lineId, locked: true }],
      };
    case 'removeAssignment':
      return { ...plan, assignments: plan.assignments.filter((a) => a.id !== action.id) };
    case 'toggleLock':
      return { ...plan, assignments: plan.assignments.map((a) => (a.id === action.id ? { ...a, locked: !a.locked } : a)) };
    case 'clearAssignments':
      return { ...plan, assignments: [] };
    case 'loadScenario': {
      const s = SCENARIOS.find((x) => x.id === action.id);
      return s ? structuredClone(s.data) : plan;
    }
  }
}

interface Store {
  plan: PlanData;
  analysis: Analysis;
  today: string;
  notice: string | null;
  saveFailed: boolean;
  /** Менеджер уже нажимал «Распределить» в этой сессии. */
  ran: boolean;
  dismissNotice: () => void;
  dispatch: (a: Action) => void;
}

const Ctx = createContext<Store | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadPlan(window.localStorage));
  const [plan, rawDispatch] = useReducer(reducer, initial.plan);
  const [ran, setRan] = useState(false);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [saveFailed, setSaveFailed] = useState(false);
  const today = todayISO();

  const dispatch = useCallback((action: Action) => {
    if (action.type === 'distribute') setRan(true);
    if (action.type === 'clearAssignments' || action.type === 'loadScenario') setRan(false);
    rawDispatch(action);
  }, []);

  useEffect(() => {
    setSaveFailed(!savePlan(window.localStorage, plan));
  }, [plan]);

  const analysis = useMemo(() => analyze(plan, today), [plan, today]);
  const value = useMemo<Store>(
    () => ({ plan, analysis, today, notice, saveFailed, ran, dismissNotice: () => setNotice(null), dispatch }),
    [plan, analysis, today, notice, saveFailed, ran, dispatch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('PlanProvider отсутствует');
  return v;
}
