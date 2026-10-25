import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Section({ title, sub, onSeeAll, children, className = '' }: { title: string; sub?: string; onSeeAll?: () => void; children: ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`}>
      <div className="section-head">
        <h2>{title}</h2>
        {onSeeAll ? (
          <button className="see-all" onClick={onSeeAll} aria-label={`See all ${title}`}>
            See All
            <Icon name="chevron-right" size={14} />
          </button>
        ) : null}
      </div>
      {sub ? <p className="section-sub">{sub}</p> : null}
      {children}
    </section>
  );
}

export function Shelf({ children }: { children: ReactNode }) {
  return <div className="shelf">{children}</div>;
}
