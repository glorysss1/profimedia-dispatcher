import { incompatibility, reasonText, type Reason } from './compat';
import { categoryLabel, priorityLabel } from './constants';
import { sortLines } from './allocate';
import type { Author, Line, PlanData } from './types';

export type IssueKind = 'conflict' | 'shortage' | 'warning';

export interface Issue {
  kind: IssueKind;
  message: string;
  lineId?: string;
  authorId?: string;
}

export interface LineStat {
  line: Line;
  /** Назначения без дублей и без нарушений совместимости. */
  validCount: number;
  need: number;
  missing: number;
  covered: boolean;
  compatibleCount: number;
}

export interface AuthorStat {
  author: Author;
  load: number;
  max: number;
  over: number;
}

export interface Analysis {
  lineStats: LineStat[];
  authorStats: AuthorStat[];
  issues: Issue[];
  coveredLines: number;
  totalLines: number;
  assignedValid: number;
  requiredTotal: number;
  hasAssignments: boolean;
  /** true только если покрыты все линии и нет конфликтов. */
  complete: boolean;
}

const REASON_ORDER: Reason[] = ['inactive', 'category', 'subject', 'format'];
const REASON_LABEL: Record<Reason, string> = {
  inactive: 'неактивны',
  category: 'по категории',
  subject: 'по предмету',
  format: 'по формату',
};

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function analyze(plan: PlanData, today: string): Analysis {
  const authors = plan.authors.filter((a) => !a.archived);
  const lines = sortLines(plan.lines.filter((l) => !l.archived));
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const lineById = new Map(lines.map((l) => [l.id, l]));

  const conflicts: Issue[] = [];
  const seen = new Set<string>();
  const loadByAuthor = new Map<string, number>();
  const validByLine = new Map<string, number>();
  const assignedAuthorsByLine = new Map<string, Set<string>>();
  let assignedTotal = 0;

  for (const a of plan.assignments) {
    const author = authorById.get(a.authorId);
    const line = lineById.get(a.lineId);
    if (!author || !line) continue;
    const key = `${a.authorId}|${a.lineId}`;
    if (seen.has(key)) {
      conflicts.push({
        kind: 'conflict',
        authorId: author.id,
        lineId: line.id,
        message: `Автор «${author.name}» назначен на линию «${line.title}» дважды.`,
      });
      continue;
    }
    seen.add(key);
    assignedTotal += 1;
    loadByAuthor.set(author.id, (loadByAuthor.get(author.id) ?? 0) + 1);
    const set = assignedAuthorsByLine.get(line.id) ?? new Set<string>();
    set.add(author.id);
    assignedAuthorsByLine.set(line.id, set);

    const reasons = incompatibility(author, line);
    if (reasons.length === 0) {
      validByLine.set(line.id, (validByLine.get(line.id) ?? 0) + 1);
    } else {
      conflicts.push({
        kind: 'conflict',
        authorId: author.id,
        lineId: line.id,
        message: `Автор «${author.name}» не подходит линии «${line.title}»: ${reasons
          .map((r) => reasonText(r, author, line))
          .join('; ')}.`,
      });
    }
  }

  const authorStats: AuthorStat[] = authors.map((author) => {
    const load = loadByAuthor.get(author.id) ?? 0;
    const over = Math.max(0, load - author.maxPerWeek);
    if (over > 0) {
      conflicts.push({
        kind: 'conflict',
        authorId: author.id,
        message: `Автор «${author.name}»: назначено ${load}, лимит ${author.maxPerWeek} (превышение на ${over}).`,
      });
    }
    return { author, load, max: author.maxPerWeek, over };
  });

  const shortages: Issue[] = [];
  const warnings: Issue[] = [];

  const lineStats: LineStat[] = lines.map((line) => {
    const validCount = validByLine.get(line.id) ?? 0;
    const missing = Math.max(0, line.minCount - validCount);
    const compatible = authors.filter((a) => incompatibility(a, line).length === 0);

    if (missing > 0) {
      const excluded: Record<Reason, number> = { inactive: 0, category: 0, subject: 0, format: 0 };
      for (const a of authors) {
        const first = REASON_ORDER.find((r) => incompatibility(a, line).includes(r));
        if (first) excluded[first] += 1;
      }
      const excludedText = REASON_ORDER.filter((r) => excluded[r] > 0)
        .map((r) => `${REASON_LABEL[r]} — ${excluded[r]}`)
        .join(', ');
      const already = assignedAuthorsByLine.get(line.id) ?? new Set<string>();
      const freeSlots = compatible
        .filter((a) => !already.has(a.id))
        .reduce((sum, a) => sum + Math.max(0, a.maxPerWeek - (loadByAuthor.get(a.id) ?? 0)), 0);
      const head = `Линия «${line.title}» (${priorityLabel(line.priority)} приоритет): назначено ${validCount} из ${line.minCount}, не хватает ${missing}.`;
      let why: string;
      if (compatible.length < line.minCount) {
        why = ` Подходящих активных авторов только ${compatible.length}, а нужно ${line.minCount} разных (один автор — один ролик на линию).${
          excludedText ? ` Не подходят: ${excludedText}.` : ''
        } Расширьте допустимые категории или предметы, добавьте автора или включите неактивных.`;
      } else if (freeSlots < missing) {
        why = ` Подходящих авторов хватает (${compatible.length}), но их недельные лимиты исчерпаны: свободно слотов ${freeSlots}, нужно ещё ${missing}. Увеличьте лимиты, добавьте автора или снизьте минимум.`;
      } else {
        why = ` У подходящих авторов есть свободные слоты (${freeSlots}). Нажмите «Распределить», чтобы пересчитать план.`;
      }
      shortages.push({ kind: 'shortage', lineId: line.id, message: head + why });
    }

    if (line.deadline && line.deadline < today) {
      warnings.push({
        kind: 'warning',
        lineId: line.id,
        message: `Дедлайн линии «${line.title}» (${formatDate(line.deadline)}) уже прошёл.`,
      });
    }

    return {
      line,
      validCount,
      need: line.minCount,
      missing,
      covered: missing === 0,
      compatibleCount: compatible.length,
    };
  });

  for (const a of authors) {
    if (a.active && a.maxPerWeek === 0) {
      warnings.push({
        kind: 'warning',
        authorId: a.id,
        message: `Автор «${a.name}» (${categoryLabel(a.category)}) активен, но лимит равен 0: заданий не получит.`,
      });
    }
  }
  if (lines.length > 0 && authors.every((a) => !a.active)) {
    warnings.push({ kind: 'warning', message: 'Нет ни одного активного автора на этой неделе.' });
  }

  const coveredLines = lineStats.filter((s) => s.covered).length;
  const requiredTotal = lines.reduce((s, l) => s + l.minCount, 0);
  const assignedValid = lineStats.reduce((s, st) => s + Math.min(st.validCount, st.need), 0);
  const issues = [...conflicts, ...shortages, ...warnings];

  return {
    lineStats,
    authorStats,
    issues,
    coveredLines,
    totalLines: lines.length,
    assignedValid,
    requiredTotal,
    hasAssignments: assignedTotal > 0,
    complete:
      lines.length > 0 &&
      coveredLines === lines.length &&
      conflicts.length === 0 &&
      shortages.length === 0,
  };
}
