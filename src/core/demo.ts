import type { Author, Line, PlanData } from './types';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  /** Что должно получиться после «Распределить». */
  expect: 'complete' | 'shortage';
  data: PlanData;
}

const author = (
  n: number,
  name: string,
  p: Pick<Author, 'category' | 'subject' | 'maxPerWeek' | 'formats' | 'specialization'> &
    Partial<Pick<Author, 'active'>>,
): Author => ({ id: `a${n}`, name, active: true, archived: false, ...p });

const line = (n: number, p: Omit<Line, 'id' | 'archived'>): Line => ({
  id: `l${n}`,
  archived: false,
  ...p,
});

export const demoAuthors = (): Author[] => [
  author(1, 'Анна К. (демо)', { category: 'grant', subject: 'Математика', maxPerWeek: 3, formats: ['Говорящая голова', 'Разбор задачи'], specialization: 'Разборы профильного ЕГЭ' }),
  author(2, 'Борис М. (демо)', { category: 'grant', subject: 'Физика', maxPerWeek: 2, formats: ['Говорящая голова', 'Влог'], specialization: 'Физика в быту' }),
  author(3, 'Вера Л. (демо)', { category: 'nongrant', subject: 'Математика', maxPerWeek: 3, formats: ['Влог', 'Тренд'], specialization: 'Лайфхаки подготовки' }),
  author(4, 'Глеб Н. (демо)', { category: 'nongrant', subject: 'Информатика', maxPerWeek: 2, formats: ['Разбор задачи', 'Обзор'], specialization: 'Python и ЕГЭ' }),
  author(5, 'Дарья П. (демо)', { category: 'graduate', subject: 'Математика', maxPerWeek: 2, formats: ['Интервью', 'Влог'], specialization: 'История поступления' }),
  author(6, 'Егор С. (демо)', { category: 'graduate', subject: 'Русский язык', maxPerWeek: 2, formats: ['Говорящая голова', 'Тренд'], specialization: 'Сочинение' }),
  author(7, 'Жанна Т. (демо)', { category: 'staff', subject: 'Математика', maxPerWeek: 4, formats: ['Говорящая голова', 'Разбор задачи', 'Обзор', 'Влог'], specialization: 'Универсал' }),
  author(8, 'Игорь Ф. (демо)', { category: 'staff', subject: 'Физика', maxPerWeek: 3, formats: ['Обзор'], specialization: 'Обзоры задач', active: false }),
];

export const demoLines = (): Line[] => [
  line(1, { title: 'Лайфхаки подготовки к ЕГЭ', description: 'Короткие советы по организации подготовки.', priority: 1, minCount: 4, categories: [], subjects: [], requiredFormat: null, nativeIntegration: '', deadline: '2026-11-10' }),
  line(2, { title: 'Разбор задачи 13 (профиль)', description: 'Пошаговый разбор тригонометрического уравнения.', priority: 1, minCount: 2, categories: [], subjects: ['Математика'], requiredFormat: 'Разбор задачи', nativeIntegration: '', deadline: '2026-11-12' }),
  line(3, { title: 'Как я сдавал ЕГЭ', description: 'Личная история выпускника или сотрудника.', priority: 2, minCount: 3, categories: ['graduate', 'staff'], subjects: [], requiredFormat: null, nativeIntegration: '', deadline: '2026-11-14' }),
  line(4, { title: 'Интеграция: курс «Формула ЕГЭ»', description: 'Нативная интеграция курса в разговорное видео.', priority: 2, minCount: 3, categories: ['grant', 'nongrant', 'staff'], subjects: [], requiredFormat: 'Говорящая голова', nativeIntegration: 'Курс «Формула ЕГЭ»', deadline: '2026-11-15' }),
  line(5, { title: 'Физика и математика за 60 секунд', description: 'Минутные объяснения одной идеи.', priority: 3, minCount: 2, categories: [], subjects: ['Физика', 'Математика'], requiredFormat: null, nativeIntegration: '', deadline: '2026-11-17' }),
];

export const demoPlan = (): PlanData => ({ authors: demoAuthors(), lines: demoLines(), assignments: [] });

const mod = (fn: (p: PlanData) => void): PlanData => {
  const p = demoPlan();
  fn(p);
  return p;
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'demo',
    title: 'Демо: всё получается',
    description: '8 авторов и 5 линий. Ограничения жёсткие, но совместимы: план должен закрыться полностью.',
    expect: 'complete',
    data: demoPlan(),
  },
  {
    id: 'no-physics',
    title: 'Нехватка по предмету',
    description: 'Линия «Физика…» требует 2 физиков, а активен один: приложение должно назвать нехватку.',
    expect: 'shortage',
    data: mod((p) => {
      const l = p.lines.find((x) => x.id === 'l5')!;
      l.subjects = ['Физика'];
    }),
  },
  {
    id: 'tight-limits',
    title: 'Лимиты авторов слишком малы',
    description: 'У всех лимит 1: всего 7 слотов на 14 роликов. Сначала закрываются линии высокого приоритета.',
    expect: 'shortage',
    data: mod((p) => p.authors.forEach((a) => (a.maxPerWeek = 1))),
  },
  {
    id: 'no-format',
    title: 'Обязательный формат никто не снимает',
    description: 'Линия 2 требует формат «Тренд», а математики его не делают.',
    expect: 'shortage',
    data: mod((p) => {
      p.lines.find((x) => x.id === 'l2')!.requiredFormat = 'Тренд';
    }),
  },
  {
    id: 'all-inactive',
    title: 'Все авторы неактивны',
    description: 'Никто не работает на этой неделе: ни одна линия не закроется.',
    expect: 'shortage',
    data: mod((p) => p.authors.forEach((a) => (a.active = false))),
  },
  {
    id: 'many-for-one',
    title: 'Нужно больше разных авторов, чем есть',
    description: 'Линия 1 требует 10 разных авторов при 7 активных: один автор не может сделать два ролика на линию.',
    expect: 'shortage',
    data: mod((p) => {
      p.lines.find((x) => x.id === 'l1')!.minCount = 10;
    }),
  },
];
