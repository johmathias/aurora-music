// Small form controls drawn in the iOS style: segmented control, switch, slider, text field.

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { clamp } from '../hooks';

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`switch${checked ? ' on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

interface SliderProps {
  value: number; // 0 to 1
  onScrub?: (value: number | null) => void; // while dragging (null = finished)
  onCommit: (value: number) => void;
  label: string;
  valueText?: string;
  className?: string;
}

/** A thin slider used for song progress and volume. Big touch area, no visible thumb (like Apple Music). */
export function Slider({ value, onScrub, onCommit, label, valueText, className = '' }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const fractionAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1);
  };
  const shown = drag ?? value;
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onCommit(clamp(value + step, 0, 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onCommit(clamp(value - step, 0, 1));
    }
  };
  return (
    <div
      ref={ref}
      className={`slider${drag !== null ? ' dragging' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={valueText}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const f = fractionAt(e.clientX);
        setDrag(f);
        onScrub?.(f);
      }}
      onPointerMove={(e) => {
        if (drag === null) return;
        const f = fractionAt(e.clientX);
        setDrag(f);
        onScrub?.(f);
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        const f = fractionAt(e.clientX);
        setDrag(null);
        onScrub?.(null);
        onCommit(f);
      }}
      onPointerCancel={() => {
        setDrag(null);
        onScrub?.(null);
      }}
    >
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${shown * 100}%` }} />
      </div>
    </div>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
