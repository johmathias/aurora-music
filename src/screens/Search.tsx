// Search your own library: songs, artists, albums, playlists and genres.

import { useDeferredValue, useMemo, useState } from 'react';
import { Artwork } from '../components/Artwork';
import { GenreTile, PlaylistArt } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Screen, SettingsButton, EmptyState } from '../components/Screen';
import { TrackList } from '../components/TrackList';
import { playList } from '../actions';
import { normalize, plural } from '../lib/format';
import { searchLibrary } from '../lib/smart';
import { useLibrary } from '../store/library';
import { forgetSearch, rememberSearch, usePrefs } from '../store/prefs';
import { nav, type Route } from '../store/ui';

export function Search() {
  const lib = useLibrary((s) => s);
  const recent = usePrefs((s) => s.recentSearches);
  const [query, setQuery] = useState('');
  const [allSongs, setAllSongs] = useState(false);
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchLibrary(lib, deferred), [lib, deferred]);
  const searching = normalize(query).length > 0;
  const total = results.songs.length + results.artists.length + results.albums.length + results.playlists.length + results.genres.length;

  const open = (route: Route) => {
    rememberSearch(query);
    nav.push(route);
  };

  // suggestions come from what is really in the library
  const suggestions = useMemo(() => {
    const list: string[] = [];
    lib.artistList.slice().sort((a, b) => b.trackIds.length - a.trackIds.length).slice(0, 4).forEach((a) => list.push(a.name));
    lib.genreList.slice(0, 3).forEach((g) => list.push(g.name));
    return list;
  }, [lib]);

  return (
    <Screen title="Search" root actions={<SettingsButton />}>
      <div className="search-bar">
        <Icon name="search" size={18} className="search-ico" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAllSongs(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (rememberSearch(query), (e.target as HTMLInputElement).blur())}
          placeholder="Songs, artists, albums, playlists"
          aria-label="Search your library"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query ? (
          <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {!searching ? (
        <>
          {recent.length ? (
            <div className="recent">
              <div className="section-head">
                <h2>Recent Searches</h2>
                <button className="see-all" onClick={() => forgetSearch()}>Clear</button>
              </div>
              {recent.map((r) => (
                <div className="recent-row" key={r}>
                  <button className="recent-main" onClick={() => setQuery(r)}>
                    <Icon name="clock" size={18} />
                    <span>{r}</span>
                  </button>
                  <button className="recent-x" aria-label={`Remove ${r} from recent searches`} onClick={() => forgetSearch(r)}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="section">
              <div className="section-head"><h2>Suggestions</h2></div>
              <div className="chips pad">
                {suggestions.map((s) => (
                  <button key={s} className="chip" onClick={() => setQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : null}

          {lib.genreList.length ? (
            <div className="section">
              <div className="section-head"><h2>Browse Genres</h2></div>
              <div className="genre-grid">
                {lib.genreList.map((g) => <GenreTile key={g.name} genre={g} onClick={() => nav.push({ kind: 'genre', name: g.name })} />)}
              </div>
            </div>
          ) : !lib.tracks.length ? (
            <EmptyState icon="search" title="Search your music" text="Import some songs first, then find them here by title, artist, album or genre." />
          ) : null}
        </>
      ) : total === 0 ? (
        <EmptyState icon="search" title="No results" text={`Nothing in your library matches “${query.trim()}”. Check the spelling or try a shorter search.`} />
      ) : (
        <div className="results">
          {results.songs.length ? (
            <div className="section first">
              <div className="section-head">
                <h2>Songs</h2>
                {results.songs.length > 5 ? (
                  <button className="see-all" onClick={() => setAllSongs((v) => !v)}>{allSongs ? 'Show Less' : `See All (${results.songs.length})`}</button>
                ) : null}
              </div>
              <TrackList
                tracks={allSongs ? results.songs : results.songs.slice(0, 5)}
                sub="both"
                onPlay={(i) => {
                  rememberSearch(query);
                  playList((allSongs ? results.songs : results.songs.slice(0, 5)).map((t) => t.id), { from: i });
                }}
              />
            </div>
          ) : null}

          {results.artists.length ? (
            <div className="section">
              <div className="section-head"><h2>Artists</h2></div>
              <div className="list">
                {results.artists.slice(0, 5).map((a) => (
                  <button key={a.key} className="row" onClick={() => open({ kind: 'artist', key: a.key })}>
                    <div className="row-art round"><Artwork artId={a.artId} seed={a.name} round initial={a.name} /></div>
                    <div className="grow"><div className="title">{a.name}</div><div className="sub">{plural(a.trackIds.length, 'song')}</div></div>
                    <Icon name="chevron-right" size={16} className="chev" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {results.albums.length ? (
            <div className="section">
              <div className="section-head"><h2>Albums</h2></div>
              <div className="list">
                {results.albums.slice(0, 5).map((a) => (
                  <button key={a.key} className="row" onClick={() => open({ kind: 'album', key: a.key })}>
                    <div className="row-art"><Artwork artId={a.artId} seed={a.title + a.artist} /></div>
                    <div className="grow"><div className="title">{a.title}</div><div className="sub">Album · {a.artist}</div></div>
                    <Icon name="chevron-right" size={16} className="chev" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {results.playlists.length ? (
            <div className="section">
              <div className="section-head"><h2>Playlists</h2></div>
              <div className="list">
                {results.playlists.slice(0, 5).map((p) => (
                  <button key={p.id} className="row" onClick={() => open({ kind: 'playlist', id: p.id })}>
                    <div className="row-art"><PlaylistArt playlist={p} /></div>
                    <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.kind === 'mix' ? 'Mix' : 'Playlist'}</div></div>
                    <Icon name="chevron-right" size={16} className="chev" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {results.genres.length ? (
            <div className="section">
              <div className="section-head"><h2>Genres</h2></div>
              <div className="genre-grid">
                {results.genres.slice(0, 4).map((g) => <GenreTile key={g.name} genre={g} onClick={() => open({ kind: 'genre', name: g.name })} />)}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Screen>
  );
}
