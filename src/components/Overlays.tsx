// Things that float above the app: action menus, confirmation alerts, toasts, the offline pill.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { closeMenu, dismissToast, useUi, type MenuItem } from '../store/ui';

export function MenuHost() {
  const menu = useUi((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  // Put the panel next to the button that opened it (below it if there is room, otherwise above).
  useLayoutEffect(() => {
    if (!menu) return setPos(null);
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const a = menu.anchor ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 };
    const cx = a.x + a.w / 2;
    const m = 12;
    // buttons on the right side open the menu towards the left, and the reverse
    let left = cx > vw / 2 ? a.x + a.w - w : a.x;
    if (a.w === 0) left = cx - w / 2;
    left = Math.max(m, Math.min(vw - w - m, left));
    const below = a.y + a.h + 8;
    let top = below;
    let vOrigin = 'top';
    if (below + h > vh - m) {
      const above = a.y - 8 - h;
      if (above >= m) {
        top = above;
        vOrigin = 'bottom';
      } else top = Math.max(m, vh - h - m);
    }
    setPos({ left, top, origin: `${Math.max(0, Math.min(w, cx - left))}px ${vOrigin}` });
  }, [menu]);

  if (!menu) return null;
  const groups: MenuItem[][] = [];
  menu.items.forEach((item, i) => {
    if (i === 0 || item.separatorBefore) groups.push([item]);
    else groups[groups.length - 1].push(item);
  });
  return (
    <div className="menu-layer">
      <div className="menu-backdrop" onClick={closeMenu} onContextMenu={(e) => e.preventDefault()} />
      <div
        ref={ref}
        className="menu pop glass"
        role="menu"
        aria-label={menu.title ?? 'Actions'}
        tabIndex={-1}
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, transformOrigin: pos?.origin, visibility: pos ? 'visible' : 'hidden' }}
      >
        {menu.title ? (
          <div className={`menu-head${menu.art ? ' with-art' : ''}`}>
            {menu.art ? <div className="menu-art"><Artwork artId={menu.art.artId} seed={menu.art.seed} /></div> : null}
            <div className="menu-head-text">
              <div className="menu-title">{menu.title}</div>
              {menu.subtitle ? <div className="menu-sub">{menu.subtitle}</div> : null}
            </div>
          </div>
        ) : null}
        <div className="menu-items">
          {groups.map((group, gi) => (
            <div key={gi} className="menu-group">
              {group.map((item, i) => (
                <button
                  key={item.label + i}
                  role="menuitem"
                  className={`menu-item${item.destructive ? ' destructive' : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    closeMenu();
                    item.onSelect();
                  }}
                >
                  {item.icon ? <Icon name={item.icon} size={20} /> : <span className="menu-icon-gap" />}
                  <span className="menu-label">
                    <span>{item.label}</span>
                    {item.subtitle ? <small>{item.subtitle}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
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
  const [show, setShow] = useState(!online);
  // this app works offline, so only tell the user for a few seconds
  useEffect(() => {
    setShow(!online);
    if (online) return;
    const t = window.setTimeout(() => setShow(false), 4000);
    return () => window.clearTimeout(t);
  }, [online]);
  if (online || !show) return null;
  return (
    <div className="offline-pill glass" role="status">
      <Icon name="offline" size={14} />
      Offline. Your music still plays.
    </div>
  );
}
