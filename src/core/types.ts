import type { Category, Format, Priority, Subject } from './constants';

export interface Author {
  id: string;
  name: string;
  category: Category;
  subject: Subject;
  /** Активен ли автор на этой неделе. */
  active: boolean;
  /** Максимум обязательных роликов на неделю. */
  maxPerWeek: number;
  /** Форматы, в которых автор работает. Пусто = любые. */
  formats: Format[];
  specialization: string;
  archived: boolean;
}

export interface Line {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  /** Минимум уникальных роликов (= разных авторов). */
  minCount: number;
  /** Допустимые категории авторов. Пусто = любые. */
  categories: Category[];
  /** Допустимые предметы авторов. Пусто = любые. */
  subjects: Subject[];
  /** Обязательный формат, null = не требуется. */
  requiredFormat: Format | null;
  /** Описание нативной интеграции, пусто = нет. */
  nativeIntegration: string;
  /** ГГГГ-ММ-ДД или пустая строка. */
  deadline: string;
  archived: boolean;
}

export interface Assignment {
  id: string;
  authorId: string;
  lineId: string;
  /** Закреплено вручную: «Распределить» не трогает такие назначения. */
  locked: boolean;
}

export interface PlanData {
  authors: Author[];
  lines: Line[];
  assignments: Assignment[];
}
