// Small reusable React hooks.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type UIEvent } from 'react';

/** Tells a screen when it has been scrolled a little, so the top bar can turn into glass. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback(
    (e: UIEvent<HTMLElement>) => {
      const value = e.currentTarget.scrollTop > threshold;
      setScrolled((prev) => (prev === value ? prev : value));
    },
    [threshold],
  );
  return { scrolled, onScroll };
}

/** True while the on-screen keyboard is open (so we can tuck the tab bar away). */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => {
      const typing = document.activeElement instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      setOpen(typing && window.innerHeight - vv.height > 140);
    };
    vv.addEventListener('resize', check);
    return () => vv.removeEventListener('resize', check);
  }, []);
  return open;
}

/** Keeps something on screen long enough to play its closing animation. */
export function useTransitionMount(open: boolean, ms: number) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Drag-to-reorder for lists whose rows all have the same height.
 * Put `handleProps(index)` on the little grip, and `rowStyle(index)` on every row.
 */
export function useReorder(count: number, rowHeight: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; dy: number; to: number } | null>(null);
  const startY = useRef(0);

  const handleProps = (index: number) => ({
    style: { touchAction: 'none' } as CSSProperties,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      setDrag({ from: index, dy: 0, to: index });
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!drag) return;
      const dy = e.clientY - startY.current;
      setDrag({ from: drag.from, dy, to: clamp(Math.round(drag.from + dy / rowHeight), 0, count - 1) });
    },
    onPointerUp: () => {
      if (!drag) return;
      if (drag.to !== drag.from) onMove(drag.from, drag.to);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  });

  const rowStyle = (i: number): CSSProperties => {
    if (!drag) return {};
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 5, transition: 'none', boxShadow: '0 6px 22px rgba(0,0,0,.4)', background: 'var(--bg-elev)' };
    const { from, to } = drag;
    if (from < to && i > from && i <= to) return { transform: `translateY(${-rowHeight}px)` };
    if (from > to && i < from && i >= to) return { transform: `translateY(${rowHeight}px)` };
    return {};
  };

  return { dragging: drag !== null, handleProps, rowStyle };
}

/** Runs a function on every animation frame while `active` is true. */
export function useFrames(active: boolean, fn: (now: number) => void) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = (now: number) => {
      saved.current(now);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}
