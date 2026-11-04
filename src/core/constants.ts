export const CATEGORIES = [
  { id: 'grant', label: 'Грант' },
  { id: 'nongrant', label: 'Негрант' },
  { id: 'graduate', label: 'Выпускник' },
  { id: 'staff', label: 'Штатный креатор' },
] as const;

export const SUBJECTS = [
  'Математика',
  'Физика',
  'Информатика',
  'Русский язык',
  'Обществознание',
  'Другое',
] as const;

export const FORMATS = [
  'Говорящая голова',
  'Влог',
  'Разбор задачи',
  'Тренд',
  'Интервью',
  'Обзор',
] as const;

export const PRIORITIES = [
  { id: 1, label: 'Высокий' },
  { id: 2, label: 'Средний' },
  { id: 3, label: 'Низкий' },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];
export type Subject = (typeof SUBJECTS)[number];
export type Format = (typeof FORMATS)[number];
export type Priority = (typeof PRIORITIES)[number]['id'];

export const LIMITS = {
  name: 60,
  specialization: 100,
  title: 80,
  description: 500,
  native: 120,
  maxPerWeek: 14,
  minCount: 20,
  authors: 200,
  lines: 200,
  assignments: 2000,
} as const;

export const categoryLabel = (id: Category): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const priorityLabel = (id: Priority): string =>
  PRIORITIES.find((p) => p.id === id)?.label ?? String(id);
