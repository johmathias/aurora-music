// Cover pictures. Shows a pleasant generated placeholder until (or instead of) a real picture.

import { Icon } from './Icon';
import { placeholderBackground, useArtworkUrl } from '../lib/artwork';

interface ArtworkProps {
  artId?: string;
  seed: string; // decides the placeholder colours
  kind?: 'thumb' | 'full';
  round?: boolean;
  initial?: string; // a letter to show on the placeholder (used for artists)
  className?: string;
}

export function Artwork({ artId, seed, kind = 'thumb', round, initial, className = '' }: ArtworkProps) {
  const url = useArtworkUrl(artId, kind);
  return (
    <div className={`art${round ? ' round' : ''} ${className}`} style={{ backgroundImage: placeholderBackground(seed) }}>
      {!artId && initial ? (
        <svg className="ph-initial" viewBox="0 0 100 100" aria-hidden="true">
          <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="44" fontWeight="700" fill="rgba(255,255,255,0.82)">
            {initial.slice(0, 1).toUpperCase()}
          </text>
        </svg>
      ) : null}
      {!artId && !initial ? (
        <span className="ph-icon">
          <Icon name="note" size={32} />
        </span>
      ) : null}
      {url ? <img key={url} src={url} alt="" draggable={false} decoding="async" onLoad={(e) => e.currentTarget.classList.add('loaded')} /> : null}
    </div>
  );
}

/** Four pictures in a 2x2 grid when we have them, otherwise the first one. */
export function CollageArt({ artIds, seed, kind = 'thumb', className = '' }: { artIds: string[]; seed: string; kind?: 'thumb' | 'full'; className?: string }) {
  if (artIds.length >= 4) {
    return (
      <div className={`art collage ${className}`} style={{ backgroundImage: placeholderBackground(seed) }}>
        {artIds.slice(0, 4).map((id) => (
          <div className="cell" key={id}>
            <Artwork artId={id} seed={seed} kind="thumb" />
          </div>
        ))}
      </div>
    );
  }
  return <Artwork artId={artIds[0]} seed={seed} kind={kind} className={className} />;
}
