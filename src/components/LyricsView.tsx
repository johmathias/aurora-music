// The lyrics panel inside Now Playing.
// Synced (LRC) lyrics follow the real playback position. Plain lyrics just scroll.
// Lyrics only come from text the user saved, or from the song file itself. Nothing is downloaded.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useFrames } from '../hooks';
import { activeLineIndex, parseLyrics } from '../lib/lyrics';
import { getLyrics } from '../store/library';
import { getPosition, seekTo, usePlaybackSecond, usePlayer } from '../store/player';
import { sheets } from '../store/ui';
import type { LyricsRec, Track } from '../types';

export function LyricsView({ track }: { track: Track }) {
  const [rec, setRec] = useState<LyricsRec | null | undefined>(undefined); // undefined = still loading
  const [active, setActive] = useState(-1);
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const playing = usePlayer((s) => s.playing);
  const second = usePlaybackSecond();

  useEffect(() => {
    let alive = true;
    setRec(undefined);
    setFollow(true);
    setActive(-1);
    getLyrics(track.id).then((r) => alive && setRec(r ?? null));
    return () => {
      alive = false;
    };
  }, [track.id, track.hasLyrics]);

  const parsed = useMemo(() => (rec ? parseLyrics(rec.text) : null), [rec]);
  const synced = !!parsed?.synced;

  // find the current line from the real audio position (60 times a second while playing)
  useFrames(synced && playing, () => {
    if (!parsed) return;
    const i = activeLineIndex(parsed.lines, getPosition());
    setActive((prev) => (prev === i ? prev : i));
  });
  // and once per second while paused (so seeking while paused still moves the highlight)
  useEffect(() => {
    if (synced && parsed) setActive(activeLineIndex(parsed.lines, getPosition() || second));
  }, [second, synced, parsed]);

  const scrollToLine = (i: number, smooth = true) => {
    const el = lineRefs.current[i];
    const b = box.current;
    if (!el || !b) return;
    // where the line sits inside the scrolling box (offsetTop can be measured from the wrong parent)
    const top = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop;
    b.scrollTo({ top: Math.max(0, top - b.clientHeight * 0.3), behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (follow && active >= 0) scrollToLine(active);
  }, [active, follow]);

  // when the user touches the lyrics to look around, stop auto-scrolling until they ask for it
  const stopFollowing = () => setFollow(false);

  if (rec === undefined) return <div className="lyrics-panel" aria-busy="true" />;

  if (!rec || !parsed) {
    return (
      <div className="lyrics-panel empty-lyrics">
        <div className="lyrics-empty">
          <Icon name="lyrics" size={40} />
          <h3>No lyrics for this song</h3>
          <p>You can paste lyrics you have the right to use, or import a .lrc or .txt file. They are saved on this device and work offline.</p>
          <button className="btn-pill" onClick={() => sheets.open({ type: 'lyricsEditor', trackId: track.id })}>
            Add Lyrics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lyrics-panel">
      <div ref={box} className={`lyrics-scroll${synced ? ' synced' : ' plain'}`} onTouchMove={stopFollowing} onWheel={stopFollowing} tabIndex={0} aria-label="Lyrics">
        {parsed.lines.map((line, i) =>
          synced ? (
            <button
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={`lyric-line${i === active ? ' active' : ''}${i < active ? ' past' : ''}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => {
                seekTo(line.time);
                setFollow(true);
              }}
            >
              {line.text || '♪'}
            </button>
          ) : (
            <p key={i} className={line.text ? 'lyric-plain' : 'lyric-gap'}>
              {line.text}
            </p>
          ),
        )}
        <div className="lyrics-end" />
      </div>
      {synced && !follow && active >= 0 ? (
        <button
          className="lyrics-follow glass"
          onClick={() => {
            setFollow(true);
            scrollToLine(active);
          }}
        >
          <Icon name="lyrics" size={16} />
          Current Line
        </button>
      ) : null}
      <button className="lyrics-edit glass" aria-label="Edit lyrics" onClick={() => sheets.open({ type: 'lyricsEditor', trackId: track.id })}>
        <Icon name="edit" size={17} />
      </button>
    </div>
  );
}
