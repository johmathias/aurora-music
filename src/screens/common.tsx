// Pieces shared by several screens.

import { Artwork } from '../components/Artwork';
import { Icon } from '../components/Icon';
import { playList } from '../actions';
import { sheets } from '../store/ui';
import type { LibraryState } from '../store/library';
import type { Track } from '../types';

export function tracksFrom(ids: string[], state: LibraryState): Track[] {
  const out: Track[] = [];
  for (const id of ids) {
    const t = state.byId.get(id);
    if (t) out.push(t);
  }
  return out;
}

export function PlayShuffle({ ids }: { ids: string[] }) {
  return (
    <div className="btn-row">
      <button className="btn-pill" disabled={!ids.length} onClick={() => playList(ids)}>
        <Icon name="play" size={18} />
        Play
      </button>
      <button className="btn-pill" disabled={!ids.length} onClick={() => playList(ids, { shuffle: true })}>
        <Icon name="shuffle" size={19} />
        Shuffle
      </button>
    </div>
  );
}

export const letterOf = (text: string) => {
  const c = text.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c.normalize('NFD').charAt(0)) ? c.normalize('NFD').charAt(0) : '#';
};

/** Shown when the library has no songs yet: a friendly introduction and a way to import. */
export function EmptyLibrary({ compact }: { compact?: boolean }) {
  return (
    <div className={`onboard${compact ? ' compact' : ''}`}>
      <div className="onboard-art" aria-hidden="true">
        <div className="oa a1"><Artwork seed="aurora one" /></div>
        <div className="oa a2"><Artwork seed="aurora two" /></div>
        <div className="oa a3"><Artwork seed="aurora three" /></div>
      </div>
      <h2>Your music, your way</h2>
      <p>Aurora plays the songs you have downloaded to your iPhone. Everything stays on this device, so it works with no internet.</p>
      <button className="btn-pill primary" onClick={() => sheets.open({ type: 'import' })}>
        <Icon name="import" size={20} />
        Import Music
      </button>
      {!compact ? (
        <ol className="onboard-steps">
          <li><b>Download</b> songs on your iPhone. They land in the Files app.</li>
          <li>Tap <b>Import Music</b> and choose them.</li>
          <li>Add the app to your <b>Home Screen</b> so it opens like any other app.</li>
        </ol>
      ) : null}
    </div>
  );
}
