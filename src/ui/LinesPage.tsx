import { useState, type FormEvent } from 'react';
import { CATEGORIES, FORMATS, LIMITS, PRIORITIES, SUBJECTS, categoryLabel, priorityLabel, type Category, type Format, type Priority, type Subject } from '../core/constants';
import { formatDate } from '../core/analyze';
import type { Line } from '../core/types';
import { uid, useStore } from '../state/store';
import { CheckGroup, Confirm, Field, Modal, toOptions } from './common';

const blank = (): Line => ({
  id: uid(),
  title: '',
  description: '',
  priority: 2,
  minCount: 1,
  categories: [],
  subjects: [],
  requiredFormat: null,
  nativeIntegration: '',
  deadline: '',
  archived: false,
});

function LineForm({ initial, onClose }: { initial: Line; onClose: () => void }) {
  const { dispatch } = useStore();
  const [l, setL] = useState(initial);
  const [min, setMin] = useState(String(initial.minCount));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNew = initial.title === '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const title = l.title.trim();
    if (!title) errs.title = 'Введите название';
    else if (title.length > LIMITS.title) errs.title = `Не длиннее ${LIMITS.title} символов`;
    if (l.description.length > LIMITS.description) errs.description = `Не длиннее ${LIMITS.description} символов`;
    if (l.nativeIntegration.length > LIMITS.native) errs.native = `Не длиннее ${LIMITS.native} символов`;
    const n = Number(min);
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.minCount) errs.min = `Целое число от 1 до ${LIMITS.minCount}`;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    dispatch({
      type: 'saveLine',
      line: { ...l, title, description: l.description.trim(), nativeIntegration: l.nativeIntegration.trim(), minCount: n },
    });
    onClose();
  };

  return (
    <Modal title={isNew ? 'Новая линия' : 'Редактировать линию'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Название" error={errors.title}>
          <input value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Описание идеи" error={errors.description}>
          <textarea rows={3} value={l.description} onChange={(e) => setL({ ...l, description: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label="Приоритет">
            <select value={l.priority} onChange={(e) => setL({ ...l, priority: Number(e.target.value) as Priority })}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Минимум уникальных роликов" error={errors.min}>
            <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
        </div>
        <CheckGroup
          legend="Допустимые категории авторов"
          hint="Если ничего не выбрано, подходят любые."
          options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
          value={l.categories}
          onChange={(v: Category[]) => setL({ ...l, categories: v })}
        />
        <CheckGroup
          legend="Допустимые предметы авторов"
          hint="Если ничего не выбрано, подходят любые."
          options={toOptions(SUBJECTS)}
          value={l.subjects}
          onChange={(v: Subject[]) => setL({ ...l, subjects: v })}
        />
        <div className="grid2">
          <Field label="Обязательный формат">
            <select
              value={l.requiredFormat ?? ''}
              onChange={(e) => setL({ ...l, requiredFormat: e.target.value === '' ? null : (e.target.value as Format) })}
            >
              <option value="">Не требуется</option>
              {FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Дедлайн">
            <input type="date" value={l.deadline} onChange={(e) => setL({ ...l, deadline: e.target.value })} />
          </Field>
        </div>
        <Field label="Нативная интеграция (если есть)" error={errors.native}>
          <input value={l.nativeIntegration} onChange={(e) => setL({ ...l, nativeIntegration: e.target.value })} />
        </Field>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary">
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LinesPage() {
  const { plan, dispatch } = useStore();
  const [editing, setEditing] = useState<Line | null>(null);
  const [removing, setRemoving] = useState<Line | null>(null);
  const [purging, setPurging] = useState<Line | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const live = plan.lines.filter((l) => !l.archived);
  const archived = plan.lines.filter((l) => l.archived);

  return (
    <section aria-labelledby="lines-title">
      <div className="page-head">
        <h1 id="lines-title">Контент-план</h1>
        <button type="button" className="btn primary" onClick={() => setEditing(blank())}>
          + Добавить линию
        </button>
      </div>
      {live.length === 0 ? <p className="empty">Линий пока нет. Добавьте первую.</p> : null}
      <ul className="cards">
        {live.map((l) => (
          <li key={l.id} className="card" data-testid="line-card">
            <div className="card-top">
              <h3>{l.title}</h3>
              <span className={`pill prio-${l.priority}`}>{priorityLabel(l.priority)}</span>
            </div>
            {l.description ? <p className="small">{l.description}</p> : null}
            <p className="tags">
              <span className="pill soft">минимум {l.minCount}</span>
              {l.requiredFormat ? <span className="pill soft">{l.requiredFormat}</span> : null}
              {l.deadline ? <span className="pill soft">до {formatDate(l.deadline)}</span> : null}
              {l.nativeIntegration ? <span className="pill accent">Интеграция: {l.nativeIntegration}</span> : null}
            </p>
            <p className="muted small">
              Категории: {l.categories.length > 0 ? l.categories.map(categoryLabel).join(', ') : 'любые'} · Предметы:{' '}
              {l.subjects.length > 0 ? l.subjects.join(', ') : 'любые'}
            </p>
            <div className="actions left">
              <button type="button" className="btn small ghost" onClick={() => setEditing(l)}>
                Изменить
              </button>
              <button type="button" className="btn small ghost danger-text" onClick={() => setRemoving(l)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <div className="archive">
          <button type="button" className="link" onClick={() => setShowArchive(!showArchive)}>
            Архив линий ({archived.length}) {showArchive ? '▲' : '▼'}
          </button>
          {showArchive ? (
            <ul className="cards">
              {archived.map((l) => (
                <li key={l.id} className="card inactive">
                  <h3>{l.title}</h3>
                  <div className="actions left">
                    <button type="button" className="btn small ghost" onClick={() => dispatch({ type: 'restoreLine', id: l.id })}>
                      Вернуть
                    </button>
                    <button type="button" className="btn small ghost danger-text" onClick={() => setPurging(l)}>
                      Удалить навсегда
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {editing ? <LineForm initial={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <Confirm
          title="Удалить линию?"
          text={`«${removing.title}» уйдёт в архив, её назначения будут сняты. Вернуть линию можно из архива.`}
          action="В архив"
          onYes={() => dispatch({ type: 'archiveLine', id: removing.id })}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {purging ? (
        <Confirm
          danger
          title="Удалить навсегда?"
          text={`«${purging.title}» будет удалена без возможности восстановления.`}
          action="Удалить навсегда"
          onYes={() => dispatch({ type: 'purgeLine', id: purging.id })}
          onClose={() => setPurging(null)}
        />
      ) : null}
    </section>
  );
}
