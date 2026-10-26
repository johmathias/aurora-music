// The frame every screen sits in: a top bar that turns into glass when you scroll,
// an optional large title, and the scrolling area.

import { createContext, useContext, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useScrolled } from '../hooks';
import { nav, sheets } from '../store/ui';

export const BackLabelContext = createContext('Back');

interface ScreenProps {
  title: string;
  eyebrow?: string;
  root?: boolean; // first screen of a tab (no back button)
  large?: boolean; // show the big title inside the page
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hero?: boolean; // photo goes under the top bar (artist page)
}

export function Screen({ title, eyebrow, root, large = true, actions, children, className = '', hero }: ScreenProps) {
  const { scrolled, onScroll } = useScrolled(large ? 30 : hero ? 230 : 150);
  const backLabel = useContext(BackLabelContext);
  return (
    <>
      <div
        className={`nav-bar${scrolled ? ' scrolled' : ''}${hero ? ' over-photo' : ''}`}
        onClick={(e) => {
          // like tapping the top of an iPhone screen: jump back to the top
          if (!(e.target as HTMLElement).closest('button')) (e.currentTarget.nextElementSibling as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {!root ? (
          <button className="nav-back" onClick={nav.pop} aria-label={`Back to ${backLabel}`}>
            <Icon name="chevron-left" size={22} />
            <span>{backLabel}</span>
          </button>
        ) : null}
        <div className="nav-title" aria-hidden={!scrolled}>
          {title}
        </div>
        <div className="nav-actions">{actions}</div>
      </div>
      <div className={`scroll ${className}`} onScroll={onScroll}>
        {large ? (
          <h1 className="large-title">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title}
          </h1>
        ) : null}
        {children}
      </div>
    </>
  );
}

/** The round Settings button that sits at the top right of the main screens. */
export function SettingsButton() {
  return (
    <button className="nav-btn" aria-label="Settings" onClick={() => sheets.open({ type: 'settings' })}>
      <Icon name="settings" size={23} />
    </button>
  );
}

export function EmptyState({ icon = 'note', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph">
        <Icon name={icon} size={34} />
      </div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}
