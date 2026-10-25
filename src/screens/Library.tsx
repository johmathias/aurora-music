// Library: the doorway to everything you own.

import { useMemo } from 'react';
import { AlbumCard, TrackCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Screen, SettingsButton } from '../components/Screen';
import { Section, Shelf } from '../components/Section';
import { playList } from '../actions';
import { favorites, importedTracks, recentlyPlayed } from '../lib/smart';
import { useLibrary } from '../store/library';
import { nav, sheets, type Route } from '../store/ui';
import { EmptyLibrary } from './common';

export function Library() {
  const lib = useLibrary((s) => s);
  const rows = useMemo(
    (): { icon: string; label: string; count: number; route: Route }[] => [
      { icon: 'add-playlist', label: 'Playlists', count: lib.playlists.length, route: { kind: 'playlists' } },
      { icon: 'person', label: 'Artists', count: lib.artistList.length, route: { kind: 'artists' } },
      { icon: 'album', label: 'Albums', count: lib.albumList.length, route: { kind: 'albums' } },
      { icon: 'note', label: 'Songs', count: lib.tracks.length, route: { kind: 'songs', source: 'all' } },
      { icon: 'mic', label: 'Genres', count: lib.genreList.length, route: { kind: 'genres' } },
      { icon: 'import', label: 'Imported Music', count: importedTracks(lib).length, route: { kind: 'songs', source: 'imported' } },
      { icon: 'heart', label: 'Favorite Songs', count: favorites(lib).length, route: { kind: 'songs', source: 'favorites' } },
    ],
    [lib],
  );
  const added = useMemo(() => lib.albumList.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 6), [lib]);
  const played = useMemo(() => recentlyPlayed(lib).slice(0, 12), [lib]);

  const actions = (
    <>
      <button className="nav-btn" aria-label="Import music" onClick={() => sheets.open({ type: 'import' })}>
        <Icon name="plus" size={24} />
      </button>
      <SettingsButton />
    </>
  );

  return (
    <Screen title="Library" root actions={actions}>
      <div className="lib-list">
        {rows.map((r) => (
          <button key={r.label} className="lib-row" onClick={() => nav.push(r.route)}>
            <Icon name={r.icon} size={24} className="lib-ico" />
            <span className="lib-label">{r.label}</span>
            <span className="lib-count">{r.count}</span>
            <Icon name="chevron-right" size={15} className="chev" />
          </button>
        ))}
      </div>

      {!lib.tracks.length ? (
        <EmptyLibrary compact />
      ) : (
        <>
          <Section title="Recently Added" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyAdded' })}>
            <div className="grid-2">{added.map((a) => <AlbumCard key={a.key} album={a} />)}</div>
          </Section>
          {played.length ? (
            <Section title="Recently Played" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyPlayed' })}>
              <Shelf>
                {played.map((t, i) => (
                  <TrackCard key={t.id} track={t} size="sm" onPlay={() => playList(played.map((x) => x.id), { from: i })} />
                ))}
              </Shelf>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
