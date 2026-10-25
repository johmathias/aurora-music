// Song rows and long song lists.
// Long lists are drawn in chunks (120 at a time, more as you scroll) so the app
// stays fast with thousands of songs.

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { openTrackMenu } from '../actions';
import { toggleFavorite } from '../store/library';
import { playNext } from '../store/player';
import { showToast } from '../store/ui';
import { useIsCurrent, useIsPlayingTrack } from '../store/player';
import { clamp, useReorder } from '../hooks';
import { formatBytes, formatTime } from '../lib/format';
import type { Track } from '../types';

export interface RowOptions {
  numbered?: boolean; // show 1, 2, 3 instead of the cover (album style)
  sub?: 'artist' | 'album' | 'both' | 'none';
  showSize?: boolean;
  playlistId?: string;
  selecting?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}

interface RowProps extends RowOptions {
  track: Track;
  position: number;
  onPlay: () => void;
  grip?: { handleProps: ReturnType<typeof useReorder>['handleProps']; index: number };
  onRemove?: () => void;
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`eq${playing ? '' : ' paused'}`} aria-label={playing ? 'Playing' : 'Paused'} role="img">
      <i />
      <i />
      <i />
    </span>
  );
}

export function TrackRow({ track, position, onPlay, numbered, sub = 'artist', showSize, playlistId, selecting, selected, onToggle, grip, onRemove }: RowProps) {
  const current = useIsCurrent(track.id);
  const playing = useIsPlayingTrack(track.id);
  const unavailable = !!track.missing;
  const subtitle = sub === 'none' ? '' : sub === 'album' ? track.album : sub === 'both' ? `${track.artist} · ${track.album}` : track.artist;
  const isSelected = !!selected?.has(track.id);

  // press and hold = menu, swipe right = Play Next, swipe left = Favorite (like Apple Music)
  const canSwipe = !selecting && !grip && !onRemove && !unavailable;
  const wrap = useRef<HTMLDivElement>(null);
  const rowEl = useRef<HTMLDivElement>(null);
  const g = useRef<{ x: number; y: number; mode: '' | 'swipe' | 'cancel'; timer?: number; fired: boolean } | null>(null);
  const suppress = useRef(false);
  const settle = () => {
    if (!rowEl.current) return;
    rowEl.current.style.transition = 'transform 0.28s var(--ease)';
    rowEl.current.style.transform = '';
    window.setTimeout(() => wrap.current && delete wrap.current.dataset.dir, 280);
  };
  const down = (e: React.PointerEvent) => {
    if (selecting || grip || (e.target as HTMLElement).closest('button, .grip')) return;
    const st = { x: e.clientX, y: e.clientY, mode: '' as '' | 'swipe' | 'cancel', fired: false, timer: undefined as number | undefined };
    st.timer = window.setTimeout(() => {
      if (!st.mode) {
        st.fired = true;
        suppress.current = true;
        openTrackMenu(track, { playlistId, position });
      }
    }, 520);
    g.current = st;
  };
  const move = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st || st.fired || st.mode === 'cancel') return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.mode) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        window.clearTimeout(st.timer);
        st.mode = 'cancel';
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        window.clearTimeout(st.timer);
        if (!canSwipe) {
          st.mode = 'cancel';
          return;
        }
        st.mode = 'swipe';
        e.currentTarget.setPointerCapture(e.pointerId);
        if (rowEl.current) rowEl.current.style.transition = 'none';
      }
    }
    if (st.mode === 'swipe' && rowEl.current && wrap.current) {
      const x = clamp(dx, -150, 150);
      rowEl.current.style.transform = `translateX(${x}px)`;
      wrap.current.dataset.dir = x > 0 ? 'right' : 'left';
      wrap.current.dataset.armed = Math.abs(x) > 90 ? 'true' : 'false';
    }
  };
  const up = (e: React.PointerEvent) => {
    const st = g.current;
    g.current = null;
    if (!st) return;
    window.clearTimeout(st.timer);
    if (st.mode !== 'swipe') return;
    suppress.current = true;
    const dx = e.clientX - st.x;
    settle();
    if (dx > 90) {
      playNext([track.id]);
      showToast(`“${track.title}” will play next`, 'success');
    } else if (dx < -90) {
      toggleFavorite(track.id);
      showToast(track.favorite ? 'Removed from Favorites' : 'Added to Favorites', 'success');
    }
  };

  const activate = () => {
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (selecting) onToggle?.(track.id);
    else if (!unavailable) onPlay();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div className="swipe-wrap" ref={wrap}>
      <div className="swipe-bg right" aria-hidden="true"><Icon name="play-next" size={24} /><span>Play Next</span></div>
      <div className="swipe-bg left" aria-hidden="true"><span>{track.favorite ? 'Unfavorite' : 'Favorite'}</span><Icon name="star" size={24} /></div>
    <div
      ref={rowEl}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      className={`row${current ? ' current' : ''}${numbered ? ' no-art numbered' : ''}${unavailable ? ' unavailable' : ''}`}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKey}
      aria-label={`${track.title}, ${track.artist}${current ? (playing ? ', playing' : ', paused') : ''}${unavailable ? ', unavailable' : ''}`}
    >
      {onRemove ? (
        <button
          className="row-remove"
          aria-label={`Remove ${track.title} from playlist`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Icon name="minus-circle" size={24} />
        </button>
      ) : null}
      {selecting ? (
        <span className={`check${isSelected ? ' on' : ''}`} role="checkbox" aria-checked={isSelected} aria-label={`Select ${track.title}`}>
          {isSelected ? <Icon name="check" size={14} /> : null}
        </span>
      ) : null}
      {numbered ? (
        <span className="track-no">{current ? <Equalizer playing={playing} /> : position + 1}</span>
      ) : (
        <div className="row-art">
          <Artwork artId={track.artId} seed={track.album + track.artist} />
          {current ? (
            <span className="row-art-eq">
              <Equalizer playing={playing} />
            </span>
          ) : null}
        </div>
      )}
      <div className="grow">
        <div className="title">{track.title}</div>
        <div className="sub">
          {unavailable ? 'Unavailable: the file is missing' : numbered && sub === 'artist' ? track.artist : subtitle}
        </div>
      </div>
      <div className="trail">
        {track.favorite ? <Icon name="heart-fill" size={13} className="fav-mark" title="Favorite" /> : null}
        {showSize ? <span>{formatBytes(track.size)}</span> : <span>{track.duration ? formatTime(track.duration) : ''}</span>}
      </div>
      {grip ? (
        <span className="grip" aria-label={`Reorder ${track.title}`} role="button" {...grip.handleProps(grip.index)}>
          <Icon name="reorder" size={20} />
        </span>
      ) : !selecting ? (
        <button
          className="row-more"
          aria-label={`More options for ${track.title}`}
          onClick={(e) => {
            e.stopPropagation();
            openTrackMenu(track, { playlistId, position });
          }}
        >
          <Icon name="more" size={20} />
        </button>
      ) : null}
    </div>
    </div>
  );
}

interface TrackListProps extends RowOptions {
  tracks: Track[];
  onPlay: (index: number) => void;
  groupBy?: (t: Track) => string; // adds A, B, C ... headers
}

const CHUNK = 120;

export function TrackList({ tracks, onPlay, groupBy, ...row }: TrackListProps) {
  const [limit, setLimit] = useState(CHUNK);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => setLimit(CHUNK), [tracks]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= tracks.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((n) => n + CHUNK), { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, tracks.length]);

  const shown = tracks.slice(0, limit);
  let lastGroup = '';
  return (
    <div className="list">
      {shown.map((t, i) => {
        const group = groupBy ? groupBy(t) : '';
        const header = group && group !== lastGroup ? group : '';
        lastGroup = group || lastGroup;
        return (
          <Fragment key={t.id}>
            {header ? <div className="group-head">{header}</div> : null}
            <TrackRow track={t} position={i} onPlay={() => onPlay(i)} {...row} />
          </Fragment>
        );
      })}
      {limit < tracks.length ? <div ref={sentinel} className="sentinel" aria-hidden /> : null}
    </div>
  );
}

/** A list you can reorder by dragging and remove rows from (used in playlist "Edit" mode). */
export function EditableTrackList({ tracks, onMove, onRemove, playlistId }: { tracks: Track[]; onMove: (from: number, to: number) => void; onRemove: (position: number) => void; playlistId?: string }) {
  const { handleProps, rowStyle } = useReorder(tracks.length, 64, onMove);
  return (
    <div className="list editing">
      {tracks.map((t, i) => (
        <div key={t.id} className="reorder-row" style={rowStyle(i)}>
          <TrackRow track={t} position={i} onPlay={() => {}} playlistId={playlistId} grip={{ handleProps, index: i }} onRemove={() => onRemove(i)} />
        </div>
      ))}
    </div>
  );
}
