// Сквозная проверка в браузере. Запуск: npm run build && npx vite preview --port 4173 &
// затем: NODE_PATH=<путь к node_modules с playwright> node e2e/e2e.cjs <папка для скриншотов>
// Playwright в зависимости проекта сознательно не добавлен (меньше внешнего кода).
const { chromium } = require('playwright');
const fs = require('fs');
const SHOTS = process.argv[2];
const URL = process.env.APP_URL || 'http://localhost:4173/';
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });

  await page.goto(URL);
  await page.waitForSelector('h1');
  const banner = () => page.locator('[data-testid=banner]').innerText();
  const stat = async (id) => (await page.locator(`[data-testid=${id}] .stat-value`).innerText()).trim();

  check('стартовая страница: «Распределение», баннер «ещё не запускалось»', /ещё не запускалось/.test(await banner()));
  await page.screenshot({ path: `${SHOTS}/01-mobile-start.png`, fullPage: true });

  await page.getByRole('button', { name: 'Распределить контент-план' }).click();
  check('демо: баннер «План выполнен»', /План выполнен/.test(await banner()), await banner());
  check('демо: линий 5/5', (await stat('stat-lines')) === '5/5');
  check('демо: роликов 14/14', (await stat('stat-videos')) === '14/14');
  check('демо: конфликтов 0', (await stat('stat-conflicts')) === '0');
  await page.screenshot({ path: `${SHOTS}/02-mobile-distributed.png`, fullPage: true });

  // Ручное снятие назначения: покрытие должно упасть, «план выполнен» исчезнуть
  const lineCard = page.locator('[data-testid=dispatch-line]', { hasText: 'Разбор задачи 13' });
  await lineCard.locator('[data-testid=chip] button[aria-label^="Снять назначение"]').first().click();
  check('ручное снятие: «План НЕ выполнен»', /План НЕ выполнен/.test(await banner()), await banner());
  check('ручное снятие: линий 4/5', (await stat('stat-lines')) === '4/5');
  check('ручное снятие: показана нехватка', await page.getByText(/не хватает 1/).first().isVisible());

  // Ручное добавление несовместимого: конфликт
  await lineCard.locator('select.add-select').selectOption({ label: 'Егор С. (демо) — не подходит' });
  check('ручное добавление несовместимого → конфликт', Number(await stat('stat-conflicts')) >= 1, 'конфликтов: ' + (await stat('stat-conflicts')));
  check('конфликт: текст про предмет/формат', await page.getByText(/не подходит линии «Разбор задачи 13/).first().isVisible());
  // повторное «Распределить» не трогает закреплённое, но находит замену
  await page.getByRole('button', { name: 'Распределить контент-план' }).click();
  check('после пересчёта закреплённый конфликт остаётся виден', Number(await stat('stat-conflicts')) >= 1);
  await page.screenshot({ path: `${SHOTS}/03-mobile-conflict.png`, fullPage: true });
  // открепить и убрать
  await lineCard.locator('[data-testid=chip].bad button[aria-label^="Снять назначение"]').click();
  await page.getByRole('button', { name: 'Распределить контент-план' }).click();
  check('после снятия конфликта и пересчёта план выполнен', /План выполнен/.test(await banner()), await banner());

  // Вид «по авторам»
  await page.getByRole('tab', { name: 'По авторам' }).click();
  check('вид «по авторам»: 8 карточек', (await page.locator('[data-testid=dispatch-author]').count()) === 8);
  await page.screenshot({ path: `${SHOTS}/04-mobile-by-author.png`, fullPage: true });
  await page.getByRole('tab', { name: 'По линиям' }).click();

  // Сценарии
  const scenarios = [
    ['Демо: всё получается', true], ['Нехватка по предмету', false], ['Лимиты авторов слишком малы', false],
    ['Обязательный формат никто не снимает', false], ['Все авторы неактивны', false], ['Нужно больше разных авторов, чем есть', false],
  ];
  for (const [title, complete] of scenarios) {
    await page.getByLabel('Сценарий').selectOption({ label: title });
    await page.getByRole('button', { name: 'Загрузить сценарий' }).click();
    await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
    await page.getByRole('button', { name: 'Распределить контент-план' }).click();
    const b = await banner();
    const ok = complete ? /План выполнен/.test(b) : (/План НЕ выполнен/.test(b) && !/План выполнен/.test(b));
    check(`сценарий «${title}»: ${complete ? 'выполнен' : 'НЕ выполнен + нехватка'}`, ok, b.slice(0, 110));
    if (!complete) check(`  └ есть блок «Нехватка» с причиной`, await page.locator('.issues.shortage').isVisible());
    if (title === 'Лимиты авторов слишком малы') await page.screenshot({ path: `${SHOTS}/05-mobile-shortage.png`, fullPage: true });
  }

  // Экспорт CSV (сценарий с нехваткой остался загружен)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Экспорт CSV' }).click()]);
  const path = await dl.path();
  const csv = fs.readFileSync(path, 'utf8');
  check('CSV: BOM и заголовок', csv.startsWith('﻿Линия;Приоритет'));
  check('CSV: строки нехватки', /НЕ ХВАТАЕТ/.test(csv));
  check('CSV: имя файла dispatch-ГГГГ-ММ-ДД.csv', /^dispatch-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());

  // Авторы: валидация, добавление, XSS, архив
  await page.getByRole('button', { name: 'Демо: всё получается' }).count();
  await page.getByLabel('Сценарий').selectOption({ label: 'Демо: всё получается' });
  await page.getByRole('button', { name: 'Загрузить сценарий' }).click();
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.locator('nav.bottom-tabs').getByText('Авторы').click();
  await page.getByRole('button', { name: '+ Добавить автора' }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  check('автор: пустое имя → ошибка', await page.getByText('Введите имя').isVisible());
  await page.getByLabel('Имя').fill('<img src=x onerror="window.__xss=1">');
  await page.getByLabel('Максимум обязательных видео в неделю').fill('99');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  check('автор: лимит 99 → ошибка диапазона', await page.getByText(/Целое число от 0 до 14/).isVisible());
  await page.getByLabel('Максимум обязательных видео в неделю').fill('2');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(200);
  check('автор добавлен (9 карточек)', (await page.locator('[data-testid=author-card]').count()) === 9);
  check('XSS: HTML выведен как текст, скрипт не выполнен', (await page.evaluate(() => window.__xss)) === undefined && (await page.getByText('<img src=x', { exact: false }).count()) > 0);
  const card = page.locator('[data-testid=author-card]', { hasText: '<img src=x' });
  await card.getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('button', { name: 'В архив' }).click();
  check('удаление → архив (8 карточек + «Архив авторов (1)»)', (await page.locator('[data-testid=author-card]').count()) === 8 && (await page.getByText('Архив авторов (1)').isVisible()));
  await page.screenshot({ path: `${SHOTS}/06-mobile-authors.png`, fullPage: true });
  await page.getByText('Архив авторов (1)').click();
  await page.getByRole('button', { name: 'Вернуть' }).click();
  check('возврат из архива (9 карточек)', (await page.locator('[data-testid=author-card]').count()) === 9);

  // Линии: форма
  await page.locator('nav.bottom-tabs').getByText('Контент-план').click();
  await page.getByRole('button', { name: '+ Добавить линию' }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  check('линия: пустое название → ошибка', await page.getByText('Введите название').isVisible());
  await page.getByLabel('Название').fill('Тестовая линия');
  await page.getByLabel('Минимум уникальных роликов').fill('0');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  check('линия: минимум 0 → ошибка', await page.getByText(/Целое число от 1 до 20/).isVisible());
  await page.getByLabel('Минимум уникальных роликов').fill('2');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(200);
  check('линия добавлена (6 карточек)', (await page.locator('[data-testid=line-card]').count()) === 6);
  await page.screenshot({ path: `${SHOTS}/07-mobile-lines.png`, fullPage: true });

  // Сохранение между перезагрузками
  await page.reload(); await page.waitForSelector('h1');
  check('данные сохранились после перезагрузки (6 линий)', (await page.locator('[data-testid=line-card]').count()) === 6);

  // Повреждённые данные
  await page.evaluate(() => localStorage.setItem('profimedia.dispatcher.v1', '{broken'));
  await page.reload(); await page.waitForSelector('h1');
  check('повреждённое хранилище → предупреждение и демо', await page.getByText(/повреждены/).isVisible());
  check('повреждённое хранилище → копия сохранена', (await page.evaluate(() => localStorage.getItem('profimedia.dispatcher.v1.broken'))) === '{broken');

  // PWA
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  check('PWA: сервис-воркер активен', sw);
  const man = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  check('PWA: манифест (standalone, 3 иконки)', man.display === 'standalone' && man.icons.length === 3);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('h1', { timeout: 8000 });
  check('PWA: открывается без сети', await page.getByText('Content Dispatcher').first().isVisible());
  await ctx.setOffline(false);

  // Десктоп
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto(URL + '#/dispatch'); await d.waitForSelector('h1');
  await d.getByRole('button', { name: 'Распределить контент-план' }).click();
  await d.screenshot({ path: `${SHOTS}/08-desktop-dispatch.png`, fullPage: true });
  check('десктоп: верхние вкладки видны, нижняя панель скрыта', (await d.locator('.desktop-tabs').isVisible()) && !(await d.locator('.bottom-tabs').isVisible()));

  const csp = await page.evaluate(() => window.__csp);
  check('CSP: нарушений нет', csp.length === 0, JSON.stringify(csp));
  check('консоль: ошибок нет', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  console.log(fails === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО: ${fails}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('СБОЙ СКРИПТА', e); process.exit(2); });
