// List screens: Songs (and its smart variants), Albums, Artists, Genres, Playlists.

import { useMemo, useState } from 'react';
import { Artwork } from '../components/Artwork';
import { AlbumCard, GenreTile, PlaylistArt } from '../components/Cards';
import { Icon } from '../components/Icon';
import { EmptyState, Screen } from '../components/Screen';
import { TrackList } from '../components/TrackList';
import { favoriteMany, openPlaylistMenu, playList, removeFromLibrary } from '../actions';
import { formatBytes, normalize, plural } from '../lib/format';
import { favorites, importedTracks, mostPlayed, recentlyAdded, recentlyPlayed } from '../lib/smart';
import { playNext } from '../store/player';
import { playlistTrackIds, useLibrary } from '../store/library';
import { nav, openMenu, sheets, type SongSource } from '../store/ui';
import type { Track } from '../types';
import { letterOf, PlayShuffle } from './common';

type Sort = 'title' | 'artist' | 'album' | 'added' | 'played' | 'plays';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'album', label: 'Album' },
  { id: 'added', label: 'Recently Added' },
  { id: 'played', label: 'Recently Played' },
  { id: 'plays', label: 'Most Played' },
];

const TITLES: Record<SongSource, string> = {
  all: 'Songs',
  favorites: 'Favorite Songs',
  recentlyAdded: 'Recently Added',
  recentlyPlayed: 'Recently Played',
  mostPlayed: 'Most Played',
  imported: 'Imported Music',
};
const DEFAULT_SORT: Record<SongSource, Sort> = { all: 'title', favorites: 'title', recentlyAdded: 'added', recentlyPlayed: 'played', mostPlayed: 'plays', imported: 'added' };
const EMPTY: Record<SongSource, string> = {
  all: 'Import songs from the Files app to fill your library.',
  favorites: 'Tap the heart on a song to add it here.',
  recentlyAdded: 'Songs you import will appear here.',
  recentlyPlayed: 'Songs you listen to will appear here.',
  mostPlayed: 'After you have listened to a few songs, your favourites show up here.',
  imported: 'Songs you import from the Files app appear here. The built-in sample songs are listed under Songs.',
};

function sortTracks(list: Track[], sort: Sort): Track[] {
  const copy = list.slice();
  const by = {
    title: (a: Track, b: Track) => a.title.localeCompare(b.title),
    artist: (a: Track, b: Track) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.trackNo - b.trackNo,
    album: (a: Track, b: Track) => a.album.localeCompare(b.album) || a.discNo - b.discNo || a.trackNo - b.trackNo,
    added: (a: Track, b: Track) => b.addedAt - a.addedAt,
    played: (a: Track, b: Track) => b.lastPlayedAt - a.lastPlayedAt,
    plays: (a: Track, b: Track) => b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt,
  }[sort];
  return copy.sort(by);
}

export function SongsScreen({ source }: { source: SongSource }) {
  const lib = useLibrary((s) => s);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT[source]);
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const base = useMemo(() => {
    switch (source) {
      case 'favorites': return favorites(lib);
      case 'recentlyAdded': return recentlyAdded(lib);
      case 'recentlyPlayed': return recentlyPlayed(lib);
      case 'mostPlayed': return mostPlayed(lib);
      case 'imported': return importedTracks(lib);
      default: return lib.tracks;
    }
  }, [lib, source]);

  const tracks = useMemo(() => {
    const q = normalize(query);
    const filtered = q ? base.filter((t) => normalize(`${t.title} ${t.artist} ${t.album}`).includes(q)) : base;
    return sortTracks(filtered, sort);
  }, [base, sort, query]);
  const ids = tracks.map((t) => t.id);
  const totalBytes = base.reduce((n, t) => n + t.size, 0);

  const chooseSort = () =>
    openMenu({
      title: 'Sort By',
      items: SORTS.map((s) => ({ label: s.label, icon: s.id === sort ? 'check' : undefined, onSelect: () => setSort(s.id) })),
    });

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const chosen = Array.from(selected);

  const actions = (
    <>
      {selecting ? (
        <>
          <button className="nav-text-btn" onClick={() => setSelected(selected.size === tracks.length ? new Set() : new Set(ids))}>{selected.size === tracks.length ? 'None' : 'All'}</button>
          <button className="nav-text-btn bold" onClick={stopSelecting}>Done</button>
        </>
      ) : (
        <>
          <button className="nav-btn" aria-label={`Sort by ${SORTS.find((s) => s.id === sort)?.label}`} onClick={chooseSort}><Icon name="reorder" size={22} /></button>
          {tracks.length ? <button className="nav-text-btn" onClick={() => setSelecting(true)}>Select</button> : null}
        </>
      )}
    </>
  );

  const grouped = sort === 'title' || sort === 'artist' || sort === 'album';
  const groupBy = grouped ? (t: Track) => letterOf(sort === 'artist' ? t.artist : sort === 'album' ? t.album : t.title) : undefined;

  return (
    <Screen title={TITLES[source]} actions={actions} className={selecting ? 'selecting' : ''}>
      {source === 'imported' && base.length ? <p className="section-sub lead">{plural(base.length, 'song')} · {formatBytes(totalBytes)} stored on this device</p> : null}
      {base.length > 6 ? (
        <div className="filter-bar">
          <Icon name="search" size={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find in ${TITLES[source]}`} aria-label={`Find in ${TITLES[source]}`} enterKeyHint="search" />
        </div>
      ) : null}
      {base.length && !selecting ? <PlayShuffle ids={ids} /> : null}
      {!base.length ? (
        <EmptyState icon={source === 'favorites' ? 'heart' : 'note'} title={source === 'favorites' ? 'No favorites yet' : 'Nothing here yet'} text={EMPTY[source]}
          action={source === 'all' || source === 'imported' || source === 'recentlyAdded' ? <button className="btn-pill primary" onClick={() => sheets.open({ type: 'import' })}>Import Music</button> : undefined} />
      ) : !tracks.length ? (
        <EmptyState icon="search" title="No matches" text={`No songs match “${query}”.`} />
      ) : (
        <TrackList
          tracks={tracks}
          groupBy={groupBy}
          showSize={source === 'imported'}
          sub={source === 'all' || source === 'imported' ? 'both' : 'both'}
          selecting={selecting}
          selected={selected}
          onToggle={toggle}
          onPlay={(i) => playList(ids, { from: i })}
        />
      )}

      {selecting ? (
        <div className="select-bar glass" role="toolbar" aria-label="Actions for selected songs">
          <span className="select-count">{chosen.length ? plural(chosen.length, 'song') : 'Select songs'}</span>
          <button disabled={!chosen.length} aria-label="Add to playlist" onClick={() => sheets.open({ type: 'addToPlaylist', trackIds: chosen })}><Icon name="add-playlist" size={24} /></button>
          <button disabled={!chosen.length} aria-label="Play next" onClick={() => { playNext(chosen); stopSelecting(); }}><Icon name="play-next" size={24} /></button>
          <button disabled={!chosen.length} aria-label="Favorite" onClick={() => { favoriteMany(chosen); stopSelecting(); }}><Icon name="heart" size={24} /></button>
          <button disabled={!chosen.length} className="danger" aria-label="Remove from library" onClick={async () => { if (await removeFromLibrary(chosen)) stopSelecting(); }}><Icon name="trash" size={24} /></button>
        </div>
      ) : null}
    </Screen>
  );
}

// ---------- albums ----------

export function AlbumsScreen() {
  const lib = useLibrary((s) => s);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'title' | 'artist' | 'added' | 'plays'>('title');
  const [query, setQuery] = useState('');
  const albums = useMemo(() => {
    const q = normalize(query);
    const list = lib.albumList.filter((a) => !q || normalize(`${a.title} ${a.artist}`).includes(q));
    const by = { title: (a: typeof list[0], b: typeof list[0]) => a.title.localeCompare(b.title), artist: (a: typeof list[0], b: typeof list[0]) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title), added: (a: typeof list[0], b: typeof list[0]) => b.addedAt - a.addedAt, plays: (a: typeof list[0], b: typeof list[0]) => b.playCount - a.playCount }[sort];
    return list.slice().sort(by);
  }, [lib.albumList, sort, query]);

  const chooseSort = () =>
    openMenu({
      title: 'Sort Albums By',
      items: ([['title', 'Title'], ['artist', 'Artist'], ['added', 'Recently Added'], ['plays', 'Most Played']] as const).map(([id, label]) => ({ label, icon: id === sort ? 'check' : undefined, onSelect: () => setSort(id) })),
    });

  return (
    <Screen
      title="Albums"
      actions={
        <>
          <button className="nav-btn" aria-label={view === 'grid' ? 'Show as list' : 'Show as grid'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')}><Icon name={view === 'grid' ? 'queue' : 'browse'} size={22} /></button>
          <button className="nav-btn" aria-label="Sort albums" onClick={chooseSort}><Icon name="reorder" size={22} /></button>
        </>
      }
    >
      {lib.albumList.length > 6 ? (
        <div className="filter-bar">
          <Icon name="search" size={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find in Albums" aria-label="Find in Albums" />
        </div>
      ) : null}
      {!lib.albumList.length ? (
        <EmptyState icon="album" title="No albums yet" text="Albums appear as soon as you import songs." action={<button className="btn-pill primary" onClick={() => sheets.open({ type: 'import' })}>Import Music</button>} />
      ) : view === 'grid' ? (
        <div className="grid-2">{albums.map((a) => <AlbumCard key={a.key} album={a} />)}</div>
      ) : (
        <div className="list">
          {albums.map((a) => (
            <button key={a.key} className="row" onClick={() => nav.push({ kind: 'album', key: a.key })}>
              <div className="row-art"><Artwork artId={a.artId} seed={a.title + a.artist} /></div>
              <div className="grow"><div className="title">{a.title}</div><div className="sub">{a.artist} · {plural(a.trackIds.length, 'song')}</div></div>
              <Icon name="chevron-right" size={16} className="chev" />
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}

// ---------- artists ----------

export function ArtistsScreen() {
  const lib = useLibrary((s) => s);
  return (
    <Screen title="Artists">
      {!lib.artistList.length ? (
        <EmptyState icon="person" title="No artists yet" text="Artists appear as soon as you import songs." />
      ) : (
        <div className="list">
          {lib.artistList.map((a, i) => {
            const letter = letterOf(a.name);
            const head = i === 0 || letterOf(lib.artistList[i - 1].name) !== letter ? letter : '';
            return (
              <div key={a.key}>
                {head ? <div className="group-head">{head}</div> : null}
                <button className="row" onClick={() => nav.push({ kind: 'artist', key: a.key })}>
                  <div className="row-art round"><Artwork artId={a.artId} seed={a.name} round initial={a.name} /></div>
                  <div className="grow"><div className="title">{a.name}</div><div className="sub">{plural(a.trackIds.length, 'song')}</div></div>
                  <Icon name="chevron-right" size={16} className="chev" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

// ---------- genres ----------

export function GenresScreen() {
  const lib = useLibrary((s) => s);
  return (
    <Screen title="Genres">
      {!lib.genreList.length ? (
        <EmptyState icon="mic" title="No genres yet" text="Genres come from the information stored inside your songs. Songs without one are not listed here. You can set a genre in Song Info." />
      ) : (
        <div className="genre-grid">{lib.genreList.map((g) => <GenreTile key={g.name} genre={g} onClick={() => nav.push({ kind: 'genre', name: g.name })} />)}</div>
      )}
    </Screen>
  );
}

// ---------- playlists ----------

export function PlaylistsScreen() {
  const lib = useLibrary((s) => s);
  const smart: { icon: string; label: string; source: SongSource; count: number }[] = [
    { icon: 'heart', label: 'Favorite Songs', source: 'favorites', count: favorites(lib).length },
    { icon: 'sparkle', label: 'Recently Added', source: 'recentlyAdded', count: lib.tracks.length },
    { icon: 'clock', label: 'Recently Played', source: 'recentlyPlayed', count: recentlyPlayed(lib).length },
    { icon: 'play', label: 'Most Played', source: 'mostPlayed', count: mostPlayed(lib).length },
  ];
  return (
    <Screen title="Playlists">
      <div className="list">
        <button className="row" onClick={() => sheets.open({ type: 'playlistEditor' })}>
          <div className="row-art new-playlist-art"><Icon name="plus" size={24} /></div>
          <div className="grow"><div className="title accent">New Playlist…</div></div>
        </button>
        <button className="row" onClick={() => sheets.open({ type: 'mixEditor' })}>
          <div className="row-art new-playlist-art"><Icon name="radio" size={22} /></div>
          <div className="grow"><div className="title accent">New Mix…</div><div className="sub">Fills itself from artists and genres</div></div>
        </button>
      </div>
      <div className="section-head sub-head"><h2>Smart Playlists</h2></div>
      <div className="list">
        {smart.map((s) => (
          <button key={s.label} className="row" onClick={() => nav.push({ kind: 'songs', source: s.source })}>
            <div className="row-art smart-art"><Icon name={s.icon} size={22} /></div>
            <div className="grow"><div className="title">{s.label}</div><div className="sub">{plural(s.count, 'song')}</div></div>
            <Icon name="chevron-right" size={16} className="chev" />
          </button>
        ))}
      </div>
      <div className="section-head sub-head"><h2>Your Playlists</h2></div>
      {!lib.playlists.length ? (
        <p className="footnote center">Playlists and mixes you create appear here.</p>
      ) : (
        <div className="list">
          {lib.playlists.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <div key={p.id} className="row-wrap">
              <button className="row" onClick={() => nav.push({ kind: 'playlist', id: p.id })}>
                <div className="row-art"><PlaylistArt playlist={p} /></div>
                <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.kind === 'mix' ? 'Mix' : 'Playlist'} · {plural(playlistTrackIds(p, lib).length, 'song')}</div></div>
              </button>
              <button className="row-more abs" aria-label={`Options for ${p.name}`} onClick={() => openPlaylistMenu(p)}><Icon name="more" size={20} /></button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
