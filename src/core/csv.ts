import { analyze, formatDate } from './analyze';
import { incompatibility, reasonText } from './compat';
import { categoryLabel, priorityLabel } from './constants';
import { sortLines } from './allocate';
import type { PlanData } from './types';

const DELIMITER = ';';

/**
 * Безопасная ячейка CSV: нейтрализуем формулы Excel (CSV injection)
 * и экранируем разделитель, кавычки и переводы строк.
 */
export function csvCell(value: string | number): string {
  let text = String(value).replace(/\r\n|\r/g, '\n');
  if (/^[=+\-@\t]/.test(text) || /^\s+[=+\-@]/.test(text)) text = `'${text}`;
  if (/[;"\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const HEADER = [
  'Линия',
  'Приоритет',
  'Дедлайн',
  'Нативная интеграция',
  'Обязательный формат',
  'Автор',
  'Категория автора',
  'Предмет автора',
  'Закреплено вручную',
  'Проверка',
];

/** CSV с BOM (иначе Excel ломает кириллицу), одна строка на назначение. */
export function buildCsv(plan: PlanData, today: string): string {
  const analysis = analyze(plan, today);
  const authors = new Map(plan.authors.filter((a) => !a.archived).map((a) => [a.id, a]));
  const rows: Array<Array<string | number>> = [HEADER];

  for (const line of sortLines(plan.lines.filter((l) => !l.archived))) {
    const stat = analysis.lineStats.find((s) => s.line.id === line.id);
    const common = [
      line.title,
      priorityLabel(line.priority),
      line.deadline ? formatDate(line.deadline) : '',
      line.nativeIntegration,
      line.requiredFormat ?? '',
    ];
    for (const a of plan.assignments.filter((x) => x.lineId === line.id)) {
      const author = authors.get(a.authorId);
      if (!author) continue;
      const reasons = incompatibility(author, line);
      rows.push([
        ...common,
        author.name,
        categoryLabel(author.category),
        author.subject,
        a.locked ? 'да' : 'нет',
        reasons.length === 0
          ? 'ОК'
          : `КОНФЛИКТ: ${reasons.map((r) => reasonText(r, author, line)).join('; ')}`,
      ]);
    }
    for (let i = 0; i < (stat?.missing ?? 0); i++) {
      rows.push([...common, '— НЕ НАЗНАЧЕНО —', '', '', '', `НЕ ХВАТАЕТ: ${stat?.missing} из ${line.minCount}`]);
    }
  }

  const body = rows.map((r) => r.map(csvCell).join(DELIMITER)).join('\r\n');
  return `﻿${body}\r\n`;
}
