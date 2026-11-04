import { categoryLabel } from './constants';
import type { Author, Line } from './types';

export type Reason = 'inactive' | 'category' | 'subject' | 'format';

/** Все причины, по которым автор не подходит линии (пусто = подходит). */
export function incompatibility(author: Author, line: Line): Reason[] {
  const reasons: Reason[] = [];
  if (!author.active) reasons.push('inactive');
  if (line.categories.length > 0 && !line.categories.includes(author.category)) {
    reasons.push('category');
  }
  if (line.subjects.length > 0 && !line.subjects.includes(author.subject)) {
    reasons.push('subject');
  }
  if (
    line.requiredFormat !== null &&
    author.formats.length > 0 &&
    !author.formats.includes(line.requiredFormat)
  ) {
    reasons.push('format');
  }
  return reasons;
}

export function reasonText(reason: Reason, author: Author, line: Line): string {
  switch (reason) {
    case 'inactive':
      return 'автор не активен на этой неделе';
    case 'category':
      return `категория «${categoryLabel(author.category)}» не входит в допустимые (${line.categories
        .map(categoryLabel)
        .join(', ')})`;
    case 'subject':
      return `предмет «${author.subject}» не входит в допустимые (${line.subjects.join(', ')})`;
    case 'format':
      return `автор не работает в формате «${line.requiredFormat ?? ''}»`;
  }
}
