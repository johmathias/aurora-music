// Song rows and long song lists.
// Long lists are drawn in chunks (120 at a time, more as you scroll) so the app
// stays fast with thousands of songs.

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { openTrackMenu } from '../actions';
import { useIsCurrent, useIsPlayingTrack } from '../store/player';
import { useReorder } from '../hooks';
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

  const activate = () => {
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
    <div
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
