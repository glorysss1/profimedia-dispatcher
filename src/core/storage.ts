import { CATEGORIES, FORMATS, LIMITS, PRIORITIES, SUBJECTS } from './constants';
import type { Category, Format, Priority, Subject } from './constants';
import { demoPlan } from './demo';
import type { Assignment, Author, Line, PlanData } from './types';

export const STORAGE_KEY = 'profimedia.dispatcher.v1';
export const BACKUP_KEY = 'profimedia.dispatcher.v1.broken';
const SCHEMA_VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, max: number, required = false): string | null => {
  if (typeof v !== 'string') return required ? null : '';
  const s = v.trim();
  if (s.length > max) return null;
  if (required && s.length === 0) return null;
  return s;
};
const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const id = (v: unknown): string | null =>
  typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null;
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(v as T) ? (v as T) : null;
const list = <T extends string>(v: unknown, allowed: readonly T[]): T[] | null => {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) {
    const ok = oneOf(x, allowed);
    if (ok === null) return null;
    if (!out.includes(ok)) out.push(ok);
  }
  return out;
};
const date = (v: unknown): string | null => {
  if (v === '' || v === undefined) return '';
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
};

const categoryIds = CATEGORIES.map((c) => c.id) as readonly Category[];
const priorityIds = PRIORITIES.map((p) => p.id) as readonly Priority[];

export function parseAuthor(v: unknown): Author | null {
  if (!isObj(v)) return null;
  const a = {
    id: id(v.id),
    name: str(v.name, LIMITS.name, true),
    category: oneOf(v.category, categoryIds),
    subject: oneOf<Subject>(v.subject, SUBJECTS),
    active: bool(v.active),
    maxPerWeek: int(v.maxPerWeek, 0, LIMITS.maxPerWeek),
    formats: list<Format>(v.formats, FORMATS),
    specialization: str(v.specialization, LIMITS.specialization),
    archived: v.archived === undefined ? false : bool(v.archived),
  };
  return Object.values(a).some((x) => x === null) ? null : (a as Author);
}

export function parseLine(v: unknown): Line | null {
  if (!isObj(v)) return null;
  const requiredFormat =
    v.requiredFormat === null || v.requiredFormat === undefined
      ? 'none'
      : oneOf<Format>(v.requiredFormat, FORMATS);
  const l = {
    id: id(v.id),
    title: str(v.title, LIMITS.title, true),
    description: str(v.description, LIMITS.description),
    priority: oneOf(v.priority, priorityIds),
    minCount: int(v.minCount, 1, LIMITS.minCount),
    categories: list(v.categories, categoryIds),
    subjects: list<Subject>(v.subjects, SUBJECTS),
    requiredFormat,
    nativeIntegration: str(v.nativeIntegration, LIMITS.native),
    deadline: date(v.deadline),
    archived: v.archived === undefined ? false : bool(v.archived),
  };
  if (Object.values(l).some((x) => x === null)) return null;
  return { ...(l as unknown as Line), requiredFormat: requiredFormat === 'none' ? null : (requiredFormat as Format) };
}

function parseAssignment(v: unknown): Assignment | null {
  if (!isObj(v)) return null;
  const a = { id: id(v.id), authorId: id(v.authorId), lineId: id(v.lineId), locked: bool(v.locked) };
  return Object.values(a).some((x) => x === null) ? null : (a as Assignment);
}

/** Проверяет сохранённые данные целиком. Любая ошибка → null (данные не используем). */
export function parsePlan(raw: unknown): PlanData | null {
  if (!isObj(raw) || raw.schemaVersion !== SCHEMA_VERSION) return null;
  const { authors, lines, assignments } = raw;
  if (!Array.isArray(authors) || !Array.isArray(lines) || !Array.isArray(assignments)) return null;
  if (
    authors.length > LIMITS.authors ||
    lines.length > LIMITS.lines ||
    assignments.length > LIMITS.assignments
  ) {
    return null;
  }
  const a = authors.map(parseAuthor);
  const l = lines.map(parseLine);
  const s = assignments.map(parseAssignment);
  if (a.includes(null) || l.includes(null) || s.includes(null)) return null;
  const A = a as Author[];
  const L = l as Line[];
  const S = s as Assignment[];
  const unique = (xs: Array<{ id: string }>) => new Set(xs.map((x) => x.id)).size === xs.length;
  if (!unique(A) || !unique(L) || !unique(S)) return null;
  const aIds = new Set(A.map((x) => x.id));
  const lIds = new Set(L.map((x) => x.id));
  return {
    authors: A,
    lines: L,
    assignments: S.filter((x) => aIds.has(x.authorId) && lIds.has(x.lineId)),
  };
}

export interface LoadResult {
  plan: PlanData;
  notice: string | null;
}

export function loadPlan(storage: Pick<Storage, 'getItem' | 'setItem'>): LoadResult {
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { plan: demoPlan(), notice: 'Браузер не даёт читать сохранённые данные: показана демо-версия.' };
  }
  if (text === null) return { plan: demoPlan(), notice: null };
  try {
    const parsed = parsePlan(JSON.parse(text));
    if (parsed) return { plan: parsed, notice: null };
  } catch {
    /* повреждённый JSON — обработаем ниже */
  }
  try {
    storage.setItem(BACKUP_KEY, text.slice(0, 200_000));
  } catch {
    /* копия не обязательна */
  }
  return {
    plan: demoPlan(),
    notice: 'Сохранённые данные повреждены или от другой версии. Загружена демо-версия, копия старых данных сохранена в браузере.',
  };
}

export function savePlan(storage: Pick<Storage, 'setItem'>, plan: PlanData): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...plan }));
    return true;
  } catch {
    return false;
  }
}
