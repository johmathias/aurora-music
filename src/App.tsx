// The app shell: boots the data, then lays out screens, bars, player and overlays.

import { useEffect, useRef, useState } from 'react';
import { MiniPlayer, TabBar } from './components/Bars';
import { MenuHost, ConfirmHost, OfflinePill, ToastHost } from './components/Overlays';
import { NowPlaying } from './components/NowPlaying';
import { BackLabelContext } from './components/Screen';
import { useKeyboardOpen } from './hooks';
import { renderRoute, TAB_LABEL } from './routes';
import { openImportWith } from './sheets/ImportSheet';
import { SheetHost } from './sheets/SheetHost';
import { initLibrary } from './store/library';
import { restorePlayback, useCurrentTrack } from './store/player';
import { loadPrefs } from './store/prefs';
import { nav, useUi, type Entry, type Tab } from './store/ui';

const TABS: Tab[] = ['listen', 'browse', 'radio', 'library', 'search'];

function TabHost({ tab }: { tab: Tab }) {
  const active = useUi((s) => s.tab === tab);
  const visited = useUi((s) => s.visited[tab]);
  const stack = useUi((s) => s.stacks[tab]);
  const startX = useRef<number | null>(null);
  if (!visited) return null;

  // swipe in from the left edge to go back, like iOS
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX < 24 && stack.length > 1 ? e.touches[0].clientX : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current !== null && e.changedTouches[0].clientX - startX.current > 70) nav.pop();
    startX.current = null;
  };

  return (
    <div className={`tab-host${active ? ' active' : ''}`} data-tab-root={tab} hidden={!active} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {stack.map((entry: Entry, i) => {
        const top = i === stack.length - 1;
        const backLabel = i === 1 ? TAB_LABEL[tab] : 'Back';
        return (
          <div key={entry.sid} className={`screen${i > 0 ? ' pushed' : ''}`} aria-hidden={!top} {...(top ? {} : { inert: true })}>
            <BackLabelContext.Provider value={backLabel}>{renderRoute(tab, entry.route)}</BackLabelContext.Provider>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const hasTrack = !!useCurrentTrack();
  const keyboard = useKeyboardOpen();
  const npOpen = useUi((s) => s.nowPlayingOpen);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void (async () => {
      await loadPrefs();
      await initLibrary();
      await restorePlayback();
      setReady(true);
    })();
  }, []);

  // dropping audio files onto the window (iPad / desktop) opens the importer
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setDragging(true);
      }
    };
    const leave = () => setDragging(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) openImportWith(files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div className={`app${hasTrack ? ' has-mini' : ''}${keyboard ? ' kb-open' : ''}`}>
      <div className={`app-shell${npOpen ? ' np-open' : ''}`}>
        {ready ? TABS.map((t) => <TabHost key={t} tab={t} />) : <div className="boot" role="status" aria-label="Loading your library"><div className="spinner" /></div>}
        <MiniPlayer />
        <TabBar />
      </div>
      <NowPlaying />
      <SheetHost />
      <MenuHost />
      <ConfirmHost />
      <ToastHost />
      <OfflinePill />
      {dragging ? <div className="drop-overlay">Drop songs to import</div> : null}
    </div>
  );
}
