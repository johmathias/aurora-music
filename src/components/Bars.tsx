// The bottom of the app: the floating mini player and the glass tab bar.

import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { next, toggle, useCurrentTrack, usePlaybackDuration, usePlaybackSecond, usePlayer } from '../store/player';
import { rememberSearch } from '../store/prefs';
import { useStore } from '../store/createStore';
import { searchText } from '../store/search';
import { nav, nowPlaying, useUi, type Tab } from '../store/ui';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'listen', label: 'Home', icon: 'home' },
  { id: 'radio', label: 'Radio', icon: 'radio' },
  { id: 'library', label: 'Library', icon: 'library' },
];

/** Keeps the bar above the on-screen keyboard while you type a search. */
function useKeyboardLift() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const typing = document.activeElement instanceof HTMLElement && document.activeElement.dataset.barInput === 'true';
      const lift = typing ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      document.documentElement.style.setProperty('--kb', `${lift}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('focusout', () => setTimeout(update, 50));
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}

/**
 * The bottom bar, like Apple Music: three tabs in one glass pill plus a round search button.
 * Tapping search turns the bar into a search field next to a round Home button.
 */
export function TabBar() {
  const tab = useUi((s) => s.tab);
  const q = useStore(searchText, (s) => s.q);
  const input = useRef<HTMLInputElement>(null);
  const searching = tab === 'search';
  useKeyboardLift();

  const openSearch = () => {
    // flushSync so the field exists before we focus it (iPhone only opens the keyboard inside the tap)
    flushSync(() => nav.openTab('search'));
    input.current?.focus();
  };

  if (searching) {
    return (
      <div className="dock searching">
        <button className="dock-circle glass" aria-label="Home" onClick={() => nav.openTab('listen')}>
          <Icon name="home" size={27} />
        </button>
        <div className="dock-search glass">
          <Icon name="search" size={20} />
          <input
            ref={input}
            data-bar-input="true"
            type="search"
            value={q}
            onChange={(e) => searchText.set({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                rememberSearch(q);
                e.currentTarget.blur();
              }
            }}
            placeholder="Search your library"
            aria-label="Search your library"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q ? (
            <button aria-label="Clear search" className="dock-clear" onClick={() => { searchText.set({ q: '' }); input.current?.focus(); }}>
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="dock">
      <nav className="dock-tabs glass" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => nav.openTab(t.id)}>
            <Icon name={t.icon} size={26} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <button className="dock-circle glass" aria-label="Search" onClick={openSearch}>
        <Icon name="search" size={27} />
      </button>
    </div>
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
