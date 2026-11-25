'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { initials } from '@/lib/format';

export type Tone = 'gris' | 'rouge' | 'ambre' | 'vert' | 'bleu' | 'rose';

export function Chip({ tone = 'gris', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Dot({ tone }: { tone?: 'vert' | 'ambre' | 'rouge' }) {
  return <span className={`dot ${tone || ''}`} aria-hidden="true" />;
}

export function Avatar({ name, team, size = 28 }: { name: string; team?: boolean; size?: number }) {
  return (
    <span className={`av ${team ? 'equipe' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Skeleton({ width = '100%', height = 14 }: { width?: number | string; height?: number }) {
  return <span className="squelette" style={{ display: 'block', width, height }} aria-hidden="true" />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="vide">{children}</div>;
}

// A card that says why it has nothing to show (source not connected, call failed).
export function Notice({ tone = 'ambre', children }: { tone?: 'ambre' | 'rouge'; children: ReactNode }) {
  return <div className={`bandeau ${tone === 'rouge' ? 'rouge' : ''}`}>{children}</div>;
}

// ---------- modal ----------

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="voile"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={`modale ${wide ? 'large' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modale-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 id={titleId} style={{ flex: 1 }}>
            {title}
          </h2>
          <button type="button" className="ico-btn" aria-label="Fermer" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modale-c">{children}</div>
        {footer && <div className="modale-b">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className={`btn ${danger ? 'btn-r' : 'btn-p'}`} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

// ---------- dropdown menu ----------

export function Menu({
  label,
  children,
  align = 'right',
  up,
  trigger,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  up?: boolean;
  trigger?: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const props = { onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' as const };
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger ? (
        trigger(props)
      ) : (
        <button type="button" className="ico-btn" aria-label={label} {...props}>
          <MoreHorizontal />
        </button>
      )}
      {open && (
        <div className="menu" role="menu" style={{ [up ? 'bottom' : 'top']: 'calc(100% + 4px)', [align]: 0 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

// A dashed pill that opens a list of choices; solid once a choice is made.
export function FilterMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Menu
      label={label}
      align="left"
      trigger={(props) => (
        <button type="button" className={`filtre ${current ? 'on' : ''}`} {...props}>
          {current ? (
            <>
              {label} : {current.label}
            </>
          ) : (
            <>
              <Plus aria-hidden="true" />
              {label}
            </>
          )}
        </button>
      )}
    >
      {(close) => (
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {current && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(null);
                  close();
                }}
              >
                Tout afficher
              </button>
              <hr />
            </>
          )}
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

// ---------- toasts ----------

interface ToastItem {
  id: number;
  text: string;
  error: boolean;
}

const ToastContext = createContext<{ notify: (text: string) => void; fail: (text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, error: boolean) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, error }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), error ? 6000 : 3500);
  }, []);
  const value = useMemo(
    () => ({ notify: (text: string) => push(text, false), fail: (text: string) => push(text, true) }),
    [push],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.error ? 'err' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}

// ---------- six-digit code ----------

export function CodeInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const apply = (next: string, focus: number) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    refs.current[Math.min(focus, 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) apply(value.slice(0, i) + value.slice(i + 1), i);
      else if (i > 0) apply(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    apply(e.clipboardData.getData('text'), 5);
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
      <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Code à 6 chiffres
      </legend>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="case"
          aria-label={`Chiffre ${i + 1}`}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (!typed) return;
            apply(value.slice(0, i) + typed + value.slice(i + 1), i + typed.length);
          }}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  );
}

// ---------- small layout helpers ----------

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; count?: number | null }[];
}) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          className={t.value === value ? 'on' : ''}
          aria-current={t.value === value ? 'page' : undefined}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="cpt">{t.count.toLocaleString('fr-FR')}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Pager({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="faible" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>
        {from.toLocaleString('fr-FR')} à {to.toLocaleString('fr-FR')} sur {total.toLocaleString('fr-FR')}
      </span>
      <span style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-s" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Précédent
        </button>
        <button type="button" className="btn btn-s" disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Suivant
        </button>
      </span>
    </div>
  );
}
