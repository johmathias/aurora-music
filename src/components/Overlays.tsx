// Things that float above the app: action menus, confirmation alerts, toasts, the offline pill.

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { closeMenu, dismissToast, useUi } from '../store/ui';

export function MenuHost() {
  const menu = useUi((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  if (!menu) return null;
  return (
    <div className="menu-layer">
      <div className="menu-backdrop" onClick={closeMenu} />
      <div ref={ref} className="menu glass" role="menu" aria-label={menu.title ?? 'Actions'} tabIndex={-1}>
        {menu.title ? (
          <div className="menu-head">
            <div className="menu-title">{menu.title}</div>
            {menu.subtitle ? <div className="menu-sub">{menu.subtitle}</div> : null}
          </div>
        ) : null}
        <div className="menu-items">
          {menu.items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`menu-item${item.destructive ? ' destructive' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                closeMenu();
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.icon ? <Icon name={item.icon} size={21} /> : null}
            </button>
          ))}
        </div>
        <button className="menu-cancel" onClick={closeMenu}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ConfirmHost() {
  const confirm = useUi((s) => s.confirm);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirm) ref.current?.focus({ preventScroll: true });
  }, [confirm]);
  if (!confirm) return null;
  return (
    <div className="alert-layer">
      <div className="alert-backdrop" />
      <div ref={ref} className="alert glass" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-msg" tabIndex={-1}>
        <div className="alert-text">
          <h2 id="alert-title">{confirm.title}</h2>
          <p id="alert-msg">{confirm.message}</p>
        </div>
        <div className="alert-actions">
          <button onClick={() => confirm.resolve(false)}>Cancel</button>
          <button className={confirm.destructive ? 'destructive' : 'bold'} onClick={() => confirm.resolve(true)}>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastHost() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast glass ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      {toast.kind === 'success' ? <Icon name="check" size={16} /> : toast.kind === 'error' ? <Icon name="warning" size={18} /> : null}
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          className="toast-action"
          onClick={() => {
            toast.action?.run();
            dismissToast();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function OfflinePill() {
  const online = useUi((s) => s.online);
  if (online) return null;
  return (
    <div className="offline-pill glass" role="status">
      <Icon name="offline" size={14} />
      Offline. Your music still plays.
    </div>
  );
}
