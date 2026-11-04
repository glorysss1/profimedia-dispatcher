import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose} aria-label={title}>
      <div className="modal-body">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Confirm({
  title,
  text,
  action,
  danger,
  onYes,
  onClose,
}: {
  title: string;
  text: string;
  action: string;
  danger?: boolean;
  onYes: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className={danger ? 'btn danger' : 'btn primary'}
          onClick={() => {
            onYes();
            onClose();
          }}
        >
          {action}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function CheckGroup<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <fieldset className="check-group">
      <legend>{legend}</legend>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="checks">
        {options.map((o) => (
          <label key={o.id} className="check">
            <input
              type="checkbox"
              checked={value.includes(o.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const toOptions = <T extends string>(xs: readonly T[]) => xs.map((x) => ({ id: x, label: x }));
