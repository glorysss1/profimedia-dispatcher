import { useEffect, useState } from 'react';
import { PlanProvider, useStore } from '../state/store';
import { AuthorsPage } from './AuthorsPage';
import { DispatchPage } from './DispatchPage';
import { LinesPage } from './LinesPage';

type Tab = 'authors' | 'lines' | 'dispatch';
const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'authors', label: 'Авторы', icon: '👥' },
  { id: 'lines', label: 'Контент-план', icon: '🗂' },
  { id: 'dispatch', label: 'Распределение', icon: '🎯' },
];

const fromHash = (): Tab => {
  const h = window.location.hash.replace('#/', '');
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'dispatch';
};

function Shell() {
  const { notice, dismissNotice, saveFailed } = useStore();
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => {
    window.location.hash = `#/${t}`;
    setTab(t);
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <div className="brand">Content Dispatcher</div>
          <div className="brand-sub">ПрофиМедиа · UGC</div>
        </div>
        <nav className="tabs desktop-tabs" aria-label="Разделы">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="demo-note">Демо-версия: данные вымышленные и хранятся только в этом браузере, на этом устройстве.</div>
      {notice ? (
        <div className="banner bad" role="alert">
          {notice}{' '}
          <button type="button" className="link" onClick={dismissNotice}>
            Понятно
          </button>
        </div>
      ) : null}
      {saveFailed ? (
        <div className="banner bad" role="alert">
          Не удалось сохранить изменения в браузере (нет места или запрещено хранение). После закрытия страницы они пропадут.
        </div>
      ) : null}

      <main>
        {tab === 'authors' ? <AuthorsPage /> : null}
        {tab === 'lines' ? <LinesPage /> : null}
        {tab === 'dispatch' ? <DispatchPage /> : null}
      </main>

      <nav className="tabs bottom-tabs" aria-label="Разделы (мобильные)">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <PlanProvider>
      <Shell />
    </PlanProvider>
  );
}
