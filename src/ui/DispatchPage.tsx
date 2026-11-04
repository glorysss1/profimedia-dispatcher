import { useState } from 'react';
import { formatDate } from '../core/analyze';
import { incompatibility, reasonText } from '../core/compat';
import { categoryLabel, priorityLabel } from '../core/constants';
import { buildCsv } from '../core/csv';
import { SCENARIOS } from '../core/demo';
import type { Issue } from '../core/analyze';
import { useStore } from '../state/store';
import { Confirm } from './common';

function downloadCsv(text: string, today: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dispatch-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IssueGroup({ title, kind, issues }: { title: string; kind: Issue['kind']; issues: Issue[] }) {
  const items = issues.filter((i) => i.kind === kind);
  if (items.length === 0) return null;
  return (
    <div className={`issues ${kind}`}>
      <h3>
        {title} ({items.length})
      </h3>
      <ul>
        {items.map((i, n) => (
          <li key={n}>{i.message}</li>
        ))}
      </ul>
    </div>
  );
}

export function DispatchPage() {
  const { plan, analysis, today, ran, dispatch } = useStore();
  const [view, setView] = useState<'lines' | 'authors'>('lines');
  const [scenarioId, setScenarioId] = useState(SCENARIOS[1]!.id);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmScenario, setConfirmScenario] = useState(false);

  const authorById = new Map(plan.authors.filter((a) => !a.archived).map((a) => [a.id, a]));
  const lineById = new Map(plan.lines.filter((l) => !l.archived).map((l) => [l.id, l]));
  const conflicts = analysis.issues.filter((i) => i.kind === 'conflict').length;
  const warnings = analysis.issues.filter((i) => i.kind === 'warning').length;
  const shortages = analysis.issues.filter((i) => i.kind === 'shortage').length;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  let banner: { cls: string; text: string };
  if (analysis.totalLines === 0) {
    banner = { cls: 'idle', text: 'В контент-плане нет линий. Добавьте хотя бы одну.' };
  } else if (!ran && !analysis.hasAssignments && conflicts === 0) {
    banner = { cls: 'idle', text: 'Распределение ещё не запускалось. Нажмите «Распределить контент-план».' };
  } else if (analysis.complete) {
    banner = {
      cls: 'ok',
      text: `План выполнен: все ${analysis.totalLines} линий получили нужное число роликов (${analysis.assignedValid} из ${analysis.requiredTotal}), конфликтов нет.`,
    };
  } else {
    const parts = [
      `покрыто линий ${analysis.coveredLines} из ${analysis.totalLines}`,
      `назначено роликов ${analysis.assignedValid} из ${analysis.requiredTotal}`,
    ];
    if (conflicts > 0) parts.push(`конфликтов: ${conflicts}`);
    banner = { cls: 'bad', text: `План НЕ выполнен: ${parts.join(', ')}. Подробности ниже.` };
  }

  const chip = (assignmentId: string, authorId: string, lineId: string, locked: boolean, label: string) => {
    const author = authorById.get(authorId);
    const line = lineById.get(lineId);
    const reasons = author && line ? incompatibility(author, line) : [];
    const why = author && line ? reasons.map((r) => reasonText(r, author, line)).join('; ') : '';
    return (
      <li key={assignmentId} className={`chip ${reasons.length > 0 ? 'bad' : ''}`} title={why || undefined} data-testid="chip">
        <span className="chip-name">
          {reasons.length > 0 ? '⚠ ' : ''}
          {label}
        </span>
        <button
          type="button"
          className={`icon-btn tiny ${locked ? 'on' : ''}`}
          aria-pressed={locked}
          aria-label={locked ? `Открепить: ${label}` : `Закрепить: ${label}`}
          title={locked ? 'Закреплено вручную: «Распределить» не тронет. Нажмите, чтобы открепить.' : 'Закрепить, чтобы «Распределить» не тронуло'}
          onClick={() => dispatch({ type: 'toggleLock', id: assignmentId })}
        >
          {locked ? '🔒' : '🔓'}
        </button>
        <button type="button" className="icon-btn tiny" aria-label={`Снять назначение: ${label}`} onClick={() => dispatch({ type: 'removeAssignment', id: assignmentId })}>
          ✕
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="dispatch-title">
      <div className="page-head">
        <h1 id="dispatch-title">Распределение</h1>
      </div>

      <div className="toolbar">
        <button type="button" className="btn primary big" onClick={() => dispatch({ type: 'distribute' })}>
          Распределить контент-план
        </button>
        <button type="button" className="btn ghost" onClick={() => downloadCsv(buildCsv(plan, today), today)} disabled={analysis.totalLines === 0}>
          Экспорт CSV
        </button>
        <button type="button" className="btn ghost" onClick={() => setConfirmClear(true)} disabled={plan.assignments.length === 0}>
          Сбросить назначения
        </button>
      </div>

      <div className={`banner ${banner.cls}`} role="status" data-testid="banner">
        {banner.text}
      </div>

      <div className="stats">
        <div className="stat" data-testid="stat-lines">
          <span className="stat-value">
            {analysis.coveredLines}/{analysis.totalLines}
          </span>
          <span className="stat-label">линий покрыто</span>
        </div>
        <div className="stat" data-testid="stat-videos">
          <span className="stat-value">
            {analysis.assignedValid}/{analysis.requiredTotal}
          </span>
          <span className="stat-label">роликов назначено</span>
        </div>
        <div className={`stat ${conflicts > 0 ? 'bad' : ''}`} data-testid="stat-conflicts">
          <span className="stat-value">{conflicts}</span>
          <span className="stat-label">конфликтов</span>
        </div>
        <div className={`stat ${warnings + shortages > 0 ? 'warn' : ''}`} data-testid="stat-warnings">
          <span className="stat-value">{warnings}</span>
          <span className="stat-label">предупреждений</span>
        </div>
      </div>

      <IssueGroup title="Конфликты" kind="conflict" issues={analysis.issues} />
      <IssueGroup title="Нехватка" kind="shortage" issues={analysis.issues} />
      <IssueGroup title="Предупреждения" kind="warning" issues={analysis.issues} />

      <div className="segmented" role="tablist" aria-label="Вид">
        <button type="button" role="tab" aria-selected={view === 'lines'} className={view === 'lines' ? 'on' : ''} onClick={() => setView('lines')}>
          По линиям
        </button>
        <button type="button" role="tab" aria-selected={view === 'authors'} className={view === 'authors' ? 'on' : ''} onClick={() => setView('authors')}>
          По авторам
        </button>
      </div>

      {view === 'lines' ? (
        <ul className="cards">
          {analysis.lineStats.map((s) => {
            const here = plan.assignments.filter((a) => a.lineId === s.line.id && authorById.has(a.authorId));
            const free = [...authorById.values()].filter((a) => !here.some((h) => h.authorId === a.id));
            return (
              <li key={s.line.id} className={`card ${s.covered ? 'covered' : 'short'}`} data-testid="dispatch-line">
                <div className="card-top">
                  <h3>{s.line.title}</h3>
                  <span className={`pill prio-${s.line.priority}`}>{priorityLabel(s.line.priority)}</span>
                </div>
                <div className="progress-row">
                  <progress value={Math.min(s.validCount, s.need)} max={s.need} aria-label={`Назначено ${s.validCount} из ${s.need}`} />
                  <span className={s.covered ? 'ok-text' : 'bad-text'}>
                    {s.validCount} из {s.need}
                    {s.covered ? ' · покрыта' : ` · не хватает ${s.missing}`}
                  </span>
                </div>
                {s.line.deadline ? <p className="muted small">Дедлайн: {formatDate(s.line.deadline)}</p> : null}
                <ul className="chips">
                  {here.map((a) => chip(a.id, a.authorId, a.lineId, a.locked, authorById.get(a.authorId)!.name))}
                </ul>
                <select
                  className="add-select"
                  value=""
                  aria-label={`Добавить автора на линию «${s.line.title}»`}
                  onChange={(e) => e.target.value && dispatch({ type: 'addAssignment', authorId: e.target.value, lineId: s.line.id })}
                >
                  <option value="">+ Добавить автора вручную</option>
                  {free.map((a) => {
                    const r = incompatibility(a, s.line);
                    return (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {r.length > 0 ? ' — не подходит' : ''}
                      </option>
                    );
                  })}
                </select>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="cards">
          {analysis.authorStats.map((s) => {
            const mine = plan.assignments.filter((a) => a.authorId === s.author.id && lineById.has(a.lineId));
            return (
              <li key={s.author.id} className={`card ${s.author.active ? '' : 'inactive'} ${s.over > 0 ? 'short' : ''}`} data-testid="dispatch-author">
                <div className="card-top">
                  <h3>{s.author.name}</h3>
                  <span className="pill">{categoryLabel(s.author.category)}</span>
                </div>
                <div className="progress-row">
                  <progress value={Math.min(s.load, Math.max(s.max, 1))} max={Math.max(s.max, 1)} aria-label={`Нагрузка ${s.load} из ${s.max}`} />
                  <span className={s.over > 0 ? 'bad-text' : ''}>
                    {s.load} из {s.max}
                    {s.author.active ? '' : ' · не активен'}
                    {s.over > 0 ? ` · превышение на ${s.over}` : ''}
                  </span>
                </div>
                <p className="muted small">{s.author.subject}</p>
                {mine.length === 0 ? <p className="muted small">Заданий нет.</p> : null}
                <ul className="chips">{mine.map((a) => chip(a.id, a.authorId, a.lineId, a.locked, lineById.get(a.lineId)!.title))}</ul>
              </li>
            );
          })}
        </ul>
      )}

      <div className="card scenarios">
        <h3>Проверка на сценариях</h3>
        <p className="muted small">
          Загрузите готовый набор данных, нажмите «Распределить» и сравните результат с ожидаемым. Текущие данные в браузере будут заменены.
        </p>
        <select aria-label="Сценарий" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <p className="small">{scenario.description}</p>
        <p className="small">
          <strong>Ожидается:</strong> {scenario.expect === 'complete' ? 'план выполнен полностью' : 'приложение покажет конкретную нехватку и не скажет «план выполнен»'}.
        </p>
        <button type="button" className="btn ghost" onClick={() => setConfirmScenario(true)}>
          Загрузить сценарий
        </button>
      </div>

      {confirmClear ? (
        <Confirm
          title="Сбросить назначения?"
          text="Все назначения, включая закреплённые вручную, будут сняты. Авторы и линии останутся."
          action="Сбросить"
          danger
          onYes={() => dispatch({ type: 'clearAssignments' })}
          onClose={() => setConfirmClear(false)}
        />
      ) : null}
      {confirmScenario ? (
        <Confirm
          title="Загрузить сценарий?"
          text={`Данные в этом браузере (авторы, линии, назначения) будут заменены набором «${scenario.title}».`}
          action="Загрузить"
          danger
          onYes={() => dispatch({ type: 'loadScenario', id: scenario.id })}
          onClose={() => setConfirmScenario(false)}
        />
      ) : null}
    </section>
  );
}
