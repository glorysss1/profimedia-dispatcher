import { useState, type FormEvent } from 'react';
import { CATEGORIES, FORMATS, LIMITS, SUBJECTS, categoryLabel, type Category, type Format, type Subject } from '../core/constants';
import type { Author } from '../core/types';
import { uid, useStore } from '../state/store';
import { CheckGroup, Confirm, Field, Modal, toOptions } from './common';

const blank = (): Author => ({
  id: uid(),
  name: '',
  category: 'grant',
  subject: 'Математика',
  active: true,
  maxPerWeek: 2,
  formats: [],
  specialization: '',
  archived: false,
});

function AuthorForm({ initial, onClose }: { initial: Author; onClose: () => void }) {
  const { dispatch } = useStore();
  const [a, setA] = useState(initial);
  const [limit, setLimit] = useState(String(initial.maxPerWeek));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNew = initial.name === '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const name = a.name.trim();
    if (!name) errs.name = 'Введите имя';
    else if (name.length > LIMITS.name) errs.name = `Не длиннее ${LIMITS.name} символов`;
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0 || n > LIMITS.maxPerWeek) errs.limit = `Целое число от 0 до ${LIMITS.maxPerWeek}`;
    if (a.specialization.length > LIMITS.specialization) errs.spec = `Не длиннее ${LIMITS.specialization} символов`;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    dispatch({ type: 'saveAuthor', author: { ...a, name, maxPerWeek: n, specialization: a.specialization.trim() } });
    onClose();
  };

  return (
    <Modal title={isNew ? 'Новый автор' : 'Редактировать автора'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Имя" error={errors.name}>
          <input value={a.name} maxLength={LIMITS.name + 20} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus />
        </Field>
        <div className="grid2">
          <Field label="Категория">
            <select value={a.category} onChange={(e) => setA({ ...a, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Предмет">
            <select value={a.subject} onChange={(e) => setA({ ...a, subject: e.target.value as Subject })}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Максимум обязательных видео в неделю" error={errors.limit}>
          <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
        <label className="check switch-row">
          <input type="checkbox" checked={a.active} onChange={(e) => setA({ ...a, active: e.target.checked })} />
          <span>Активен на этой неделе</span>
        </label>
        <CheckGroup
          legend="Предпочтительные форматы"
          hint="Если ничего не выбрано, автор подходит под любой формат."
          options={toOptions(FORMATS)}
          value={a.formats}
          onChange={(v: Format[]) => setA({ ...a, formats: v })}
        />
        <Field label="Специализация" error={errors.spec}>
          <input value={a.specialization} onChange={(e) => setA({ ...a, specialization: e.target.value })} />
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

export function AuthorsPage() {
  const { plan, analysis, dispatch } = useStore();
  const [editing, setEditing] = useState<Author | null>(null);
  const [removing, setRemoving] = useState<Author | null>(null);
  const [purging, setPurging] = useState<Author | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const live = plan.authors.filter((a) => !a.archived);
  const archived = plan.authors.filter((a) => a.archived);
  const load = new Map(analysis.authorStats.map((s) => [s.author.id, s.load]));

  return (
    <section aria-labelledby="authors-title">
      <div className="page-head">
        <h1 id="authors-title">Авторы</h1>
        <button type="button" className="btn primary" onClick={() => setEditing(blank())}>
          + Добавить автора
        </button>
      </div>
      {live.length === 0 ? <p className="empty">Авторов пока нет. Добавьте первого.</p> : null}
      <ul className="cards">
        {live.map((a) => (
          <li key={a.id} className={`card ${a.active ? '' : 'inactive'}`} data-testid="author-card">
            <div className="card-top">
              <h3>{a.name}</h3>
              <label className="switch" title="Активен на этой неделе">
                <input
                  type="checkbox"
                  checked={a.active}
                  aria-label={`Активен на этой неделе: ${a.name}`}
                  onChange={(e) => dispatch({ type: 'saveAuthor', author: { ...a, active: e.target.checked } })}
                />
                <span>{a.active ? 'Активен' : 'Не активен'}</span>
              </label>
            </div>
            <p className="tags">
              <span className="pill">{categoryLabel(a.category)}</span>
              <span className="pill soft">{a.subject}</span>
              <span className="pill soft">до {a.maxPerWeek} в неделю</span>
            </p>
            <p className="muted small">
              Форматы: {a.formats.length > 0 ? a.formats.join(', ') : 'любые'}
              {a.specialization ? ` · ${a.specialization}` : ''}
            </p>
            <p className="muted small">Назначено сейчас: {load.get(a.id) ?? 0}</p>
            <div className="actions left">
              <button type="button" className="btn small ghost" onClick={() => setEditing(a)}>
                Изменить
              </button>
              <button type="button" className="btn small ghost danger-text" onClick={() => setRemoving(a)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <div className="archive">
          <button type="button" className="link" onClick={() => setShowArchive(!showArchive)}>
            Архив авторов ({archived.length}) {showArchive ? '▲' : '▼'}
          </button>
          {showArchive ? (
            <ul className="cards">
              {archived.map((a) => (
                <li key={a.id} className="card inactive">
                  <h3>{a.name}</h3>
                  <div className="actions left">
                    <button type="button" className="btn small ghost" onClick={() => dispatch({ type: 'restoreAuthor', id: a.id })}>
                      Вернуть
                    </button>
                    <button type="button" className="btn small ghost danger-text" onClick={() => setPurging(a)}>
                      Удалить навсегда
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {editing ? <AuthorForm initial={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <Confirm
          title="Удалить автора?"
          text={`«${removing.name}» уйдёт в архив, его назначения будут сняты. Вернуть автора можно из архива.`}
          action="В архив"
          onYes={() => dispatch({ type: 'archiveAuthor', id: removing.id })}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {purging ? (
        <Confirm
          danger
          title="Удалить навсегда?"
          text={`«${purging.name}» будет удалён без возможности восстановления.`}
          action="Удалить навсегда"
          onYes={() => dispatch({ type: 'purgeAuthor', id: purging.id })}
          onClose={() => setPurging(null)}
        />
      ) : null}
    </section>
  );
}
