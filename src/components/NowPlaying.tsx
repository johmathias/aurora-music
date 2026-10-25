// The full-screen player. This is the showpiece: big artwork, colours taken from the
// cover, a glass look, drag-down to close, real progress and real controls.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { Slider } from './Controls';
import { LyricsView } from './LyricsView';
import { goTo, openTrackMenu } from '../actions';
import { useFrames, useTransitionMount } from '../hooks';
import { useArtworkColors } from '../lib/artwork';
import { formatTime } from '../lib/format';
import { artistKey, trackAlbumKey } from '../lib/indexing';
import { toggleFavorite } from '../store/library';
import {
  cycleRepeat, getPosition, next, previous, seekTo, setShuffle, setVolume, showAirPlayPicker, toggle,
  useCurrentTrack, usePlaybackDuration, usePlaybackSecond, usePlayer,
} from '../store/player';
import { usePrefs } from '../store/prefs';
import { nowPlaying, openMenu, sheets, useUi } from '../store/ui';
import type { Track } from '../types';

/** Long titles slide sideways instead of being cut off. */
function Marquee({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!box.current || !inner.current) return;
    setShift(Math.max(0, inner.current.scrollWidth - box.current.clientWidth));
  }, [text]);
  return (
    <div ref={box} className={`marquee ${className ?? ''}`} title={text}>
      <span ref={inner} className={shift > 0 ? 'moving' : ''} style={{ '--shift': `${shift}px` } as CSSProperties}>
        {text}
      </span>
    </div>
  );
}

/** Reads the real playback position about 10 times a second while playing (smooth bar, cheap). */
function useSmoothPosition(): number {
  const playing = usePlayer((s) => s.playing);
  const second = usePlaybackSecond();
  const [pos, setPos] = useState(getPosition());
  const last = useRef(0);
  useFrames(playing, (now) => {
    if (now - last.current > 90) {
      last.current = now;
      setPos(getPosition());
    }
  });
  return playing ? pos : second;
}

function ProgressBlock() {
  const pos = useSmoothPosition();
  const duration = usePlaybackDuration();
  const [scrub, setScrub] = useState<number | null>(null);
  const shownTime = scrub !== null ? scrub * duration : pos;
  return (
    <div className="np-progress">
      <Slider
        value={duration > 0 ? Math.min(1, pos / duration) : 0}
        onScrub={setScrub}
        onCommit={(f) => seekTo(f * duration)}
        label="Song position"
        valueText={`${formatTime(shownTime)} of ${formatTime(duration)}`}
      />
      <div className="np-times">
        <span>{formatTime(shownTime)}</span>
        <span>-{formatTime(Math.max(0, duration - shownTime))}</span>
      </div>
    </div>
  );
}

function Controls() {
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const repeatLabel = repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one song';
  return (
    <div className="np-controls">
      <button className={`np-toggle${shuffle ? ' on' : ''}`} aria-pressed={shuffle} aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'} onClick={() => setShuffle(!shuffle)}>
        <Icon name="shuffle" size={22} />
      </button>
      <button className="np-skip" aria-label="Previous song, or restart" onClick={previous}>
        <Icon name="prev" size={38} />
      </button>
      <button className={`np-play${loading ? ' loading' : ''}`} aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
        <Icon name={playing ? 'pause' : 'play'} size={52} />
      </button>
      <button className="np-skip" aria-label="Next song" onClick={next}>
        <Icon name="next" size={38} />
      </button>
      <button className={`np-toggle${repeat !== 'off' ? ' on' : ''}`} aria-pressed={repeat !== 'off'} aria-label={repeatLabel} onClick={cycleRepeat}>
        <Icon name={repeat === 'one' ? 'repeat1' : 'repeat'} size={22} />
      </button>
    </div>
  );
}

function Footer() {
  const mode = useUi((s) => s.nowPlayingMode);
  const airplay = usePlayer((s) => s.airplay);
  const canVolume = usePlayer((s) => s.canSetVolume);
  const volume = usePlayer((s) => s.volume);
  return (
    <div className="np-footer">
      <button className={`np-foot-btn${mode === 'lyrics' ? ' on' : ''}`} aria-pressed={mode === 'lyrics'} aria-label="Lyrics" onClick={() => nowPlaying.setMode(mode === 'lyrics' ? 'art' : 'lyrics')}>
        <Icon name={mode === 'lyrics' ? 'lyrics-fill' : 'lyrics'} size={24} />
      </button>
      {canVolume ? (
        <div className="np-volume">
          <Icon name="volume-low" size={16} />
          <Slider value={volume} onCommit={setVolume} onScrub={(v) => v !== null && setVolume(v)} label="Volume" />
          <Icon name="volume" size={18} />
        </div>
      ) : (
        <div className="np-foot-spacer" />
      )}
      {airplay === 'available' ? (
        <button className="np-foot-btn" aria-label="Choose where to play (AirPlay)" onClick={showAirPlayPicker}>
          <Icon name="airplay" size={24} />
        </button>
      ) : null}
      <button className="np-foot-btn" aria-label="Queue" onClick={() => sheets.open({ type: 'queue' })}>
        <Icon name="queue" size={24} />
      </button>
    </div>
  );
}

function openNowPlayingMenu(track: Track) {
  const canShare = typeof navigator.share === 'function';
  openMenu({
    title: track.title,
    subtitle: track.artist,
    items: [
      { label: 'Add to Playlist…', icon: 'add-playlist', onSelect: () => sheets.open({ type: 'addToPlaylist', trackIds: [track.id] }) },
      { label: 'Go to Album', icon: 'album', onSelect: () => goTo({ kind: 'album', key: trackAlbumKey(track) }) },
      { label: 'Go to Artist', icon: 'person', onSelect: () => goTo({ kind: 'artist', key: artistKey(track.artist) }) },
      { label: track.hasLyrics ? 'Edit Lyrics' : 'Add Lyrics', icon: 'lyrics', onSelect: () => sheets.open({ type: 'lyricsEditor', trackId: track.id }) },
      { label: 'Song Info', icon: 'info', onSelect: () => sheets.open({ type: 'trackInfo', trackId: track.id }) },
      ...(canShare
        ? [{ label: 'Share Song Info', icon: 'share', onSelect: () => void navigator.share({ title: track.title, text: `${track.title} by ${track.artist}${track.album ? ` (${track.album})` : ''}` }).catch(() => undefined) }]
        : []),
      { label: 'More Options…', icon: 'more', onSelect: () => openTrackMenu(track) },
    ],
  });
}

function Meta({ track, compact }: { track: Track; compact?: boolean }) {
  return (
    <div className={`np-meta${compact ? ' compact' : ''}`}>
      {compact ? (
        <div className="np-meta-art">
          <Artwork artId={track.artId} seed={track.album + track.artist} />
        </div>
      ) : null}
      <div className="np-meta-text">
        <Marquee text={track.title} className="np-title" />
        <Marquee text={track.artist} className="np-artist" />
      </div>
      <button className={`np-circle${track.favorite ? ' on' : ''}`} aria-pressed={track.favorite} aria-label={track.favorite ? 'Remove from Favorites' : 'Favorite'} onClick={() => toggleFavorite(track.id)}>
        <Icon name={track.favorite ? 'heart-fill' : 'heart'} size={20} />
      </button>
      <button className="np-circle" aria-label="Add to playlist" onClick={() => sheets.open({ type: 'addToPlaylist', trackIds: [track.id] })}>
        <Icon name="add-playlist" size={20} />
      </button>
    </div>
  );
}

function Body({ track, shown }: { track: Track; shown: boolean }) {
  const mode = useUi((s) => s.nowPlayingMode);
  const playing = usePlayer((s) => s.playing);
  const lyricsBg = usePrefs((s) => s.lyricsBackground);
  const colors = useArtworkColors(track.artId, track.album + track.artist);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; active: boolean } | null>(null);

  // Swipe down from the top area or the artwork to close.
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return;
    drag.current = { y: e.clientY, t: performance.now(), active: false };
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = root.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (!d.active && dy > 8) {
      d.active = true;
      el.setPointerCapture(e.pointerId);
      el.style.transition = 'none';
    }
    if (d.active) el.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = root.current;
    drag.current = null;
    if (!d || !el || !d.active) return;
    const dy = e.clientY - d.y;
    const speed = dy / Math.max(1, performance.now() - d.t);
    el.style.transition = '';
    el.style.transform = '';
    if (dy > 140 || speed > 0.6) nowPlaying.close();
  };

  const vars = { '--c1': colors[0], '--c2': colors[1], '--c3': colors[2], '--c4': colors[3] } as CSSProperties;
  const lyricsMode = mode === 'lyrics';

  return (
    <div
      ref={root}
      className={`np${shown ? ' shown' : ''}${lyricsMode ? ' lyrics-mode' : ''}${lyricsBg ? '' : ' plain-lyrics'}`}
      style={vars}
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="np-bg" key={track.id} aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="np-scrim" />
      </div>

      <div className="np-inner">
        <div className="np-head" data-drag-handle>
          <span className="np-grabber" aria-hidden="true" />
          <button className="np-icon-btn" aria-label="Close Now Playing" onClick={nowPlaying.close}>
            <Icon name="chevron-down" size={26} />
          </button>
          <div className="np-head-title">
            <span className="eyebrow">Now Playing</span>
            <span className="np-head-album">{track.album}</span>
          </div>
          <button className="np-icon-btn" aria-label="More options" onClick={() => openNowPlayingMenu(track)}>
            <Icon name="more" size={24} />
          </button>
        </div>

        {lyricsMode ? <Meta track={track} compact /> : null}

        {lyricsMode ? (
          <LyricsView track={track} />
        ) : (
          <div className="np-stage" data-drag-handle>
            <div key={track.id} className={`np-art${playing ? '' : ' paused'}`}>
              <Artwork artId={track.artId} seed={track.album + track.artist} kind="full" />
            </div>
          </div>
        )}

        {!lyricsMode ? <Meta track={track} /> : null}
        <ProgressBlock />
        <Controls />
        <Footer />
      </div>
    </div>
  );
}

export function NowPlaying() {
  const open = useUi((s) => s.nowPlayingOpen);
  const track = useCurrentTrack();
  const { mounted, shown } = useTransitionMount(open && !!track, 460);
  const lastTrack = useRef<Track | undefined>(undefined);
  if (track) lastTrack.current = track;

  // keep the page behind from reading out to screen readers while the player is open
  useEffect(() => {
    document.querySelector('.app-shell')?.toggleAttribute('inert', open);
  }, [open]);

  const t = track ?? lastTrack.current;
  if (!mounted || !t) return null;
  return <Body track={t} shown={shown} />;
}
