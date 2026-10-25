// The bottom of the app: the floating mini player and the glass tab bar.

import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { next, toggle, useCurrentTrack, usePlaybackDuration, usePlaybackSecond, usePlayer } from '../store/player';
import { nav, nowPlaying, useUi, type Tab } from '../store/ui';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'listen', label: 'Listen Now', icon: 'listen' },
  { id: 'browse', label: 'Browse', icon: 'browse' },
  { id: 'radio', label: 'Radio', icon: 'radio' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'search', label: 'Search', icon: 'search' },
];

export function TabBar() {
  const tab = useUi((s) => s.tab);
  return (
    <nav className="tabbar glass" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => nav.openTab(t.id)}>
          <Icon name={t.icon} size={26} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MiniProgress() {
  const second = usePlaybackSecond();
  const duration = usePlaybackDuration();
  const pct = duration > 0 ? Math.min(100, (second / duration) * 100) : 0;
  return (
    <div className="mini-progress" role="progressbar" aria-label="Song progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MiniPlayer() {
  const track = useCurrentTrack();
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  if (!track) return null;
  return (
    <div
      className="mini glass"
      role="button"
      tabIndex={0}
      aria-label={`Now playing: ${track.title} by ${track.artist}. Open player.`}
      onClick={() => nowPlaying.open()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') nowPlaying.open();
      }}
    >
      <div className="mini-art">
        <Artwork artId={track.artId} seed={track.album + track.artist} />
      </div>
      <div className="mini-text">
        <div className="mini-title">{track.title}</div>
        <div className="mini-sub">{track.artist}</div>
      </div>
      <button
        className="mini-btn"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        <Icon name={playing || loading ? 'pause' : 'play'} size={26} />
      </button>
      <button
        className="mini-btn"
        aria-label="Next song"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      >
        <Icon name="next" size={26} />
      </button>
      <MiniProgress />
    </div>
  );
}
