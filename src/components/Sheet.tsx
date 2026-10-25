// iOS-style bottom sheet: slides up, dims what is behind, closes by swiping down,
// tapping outside, or pressing Escape.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { sheets, useUi } from '../store/ui';

const SheetContext = createContext<{ close: () => void }>({ close() {} });
/** Lets the content of a sheet close its own sheet (with the closing animation). */
export const useSheet = () => useContext(SheetContext);

interface SheetProps {
  sid: number;
  title?: string;
  large?: boolean;
  left?: { label: string; onClick?: () => void };
  right?: { label: string; onClick?: () => void; disabled?: boolean; bold?: boolean };
  children: ReactNode;
}

export function Sheet({ sid, title, large, left, right, children }: SheetProps) {
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isBottom = useUi((s) => s.sheets[0]?.sid === sid);
  const isTop = useUi((s) => s.sheets[s.sheets.length - 1]?.sid === sid);
  const drag = useRef<{ y: number; t: number } | null>(null);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => sheets.close(sid), 260);
  }, [sid]);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!isTop) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTop, close]);

  // swipe down on the top part of the sheet to close it
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ref.current) ref.current.style.transition = 'none';
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    ref.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current.y)}px)`;
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = e.clientY - drag.current.y;
    const speed = dy / Math.max(1, performance.now() - drag.current.t);
    drag.current = null;
    ref.current.style.transition = '';
    ref.current.style.transform = '';
    if (dy > 110 || speed > 0.7) close();
  };

  return (
    <SheetContext.Provider value={{ close }}>
      <div className={`sheet-layer${closing ? ' closing' : ''}`}>
        <div className={`sheet-backdrop${isBottom ? '' : ' clear'}`} onClick={close} />
        <div ref={ref} className={`sheet${large ? ' large' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
          <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <span className="sheet-grabber" />
            <div className="sheet-bar">
              <div className="sheet-side left">
                {left ? (
                  <button className="sheet-btn" onClick={left.onClick ?? close}>
                    {left.label}
                  </button>
                ) : null}
              </div>
              <h2 className="sheet-title">{title}</h2>
              <div className="sheet-side right">
                {right ? (
                  <button className={`sheet-btn${right.bold === false ? '' : ' bold'}`} disabled={right.disabled} onClick={right.onClick ?? close}>
                    {right.label}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </SheetContext.Provider>
  );
}
