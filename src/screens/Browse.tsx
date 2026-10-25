// Browse: an editorial-style look at the library: a featured album, new music, albums,
// playlists, artists and genres. Nothing is invented; it all comes from your own files.

import { useMemo } from 'react';
import { Artwork } from '../components/Artwork';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Screen, SettingsButton } from '../components/Screen';
import { Section, Shelf } from '../components/Section';
import { playList } from '../actions';
import { plural } from '../lib/format';
import { favorites } from '../lib/smart';
import { useLibrary } from '../store/library';
import { nav, sheets } from '../store/ui';
import { EmptyLibrary } from './common';

export function Browse() {
  const lib = useLibrary((s) => s);

  const data = useMemo(() => {
    const byNew = lib.albumList.slice().sort((a, b) => b.addedAt - a.addedAt);
    const featured = byNew.find((a) => a.artId) ?? byNew[0];
    const genres = lib.genreList.slice().sort((a, b) => b.trackIds.length - a.trackIds.length);
    const topGenre = genres[0];
    const suggestions = topGenre ? lib.albumList.filter((a) => a.genre === topGenre.name && a.key !== featured?.key).slice(0, 12) : [];
    return {
      featured,
      newest: byNew.filter((a) => a.key !== featured?.key).slice(0, 12),
      genres,
      topGenre,
      suggestions,
      favs: favorites(lib),
      favPlaylists: lib.playlists.filter((p) => p.favorite),
    };
  }, [lib]);

  if (!lib.tracks.length) {
    return (
      <Screen title="Browse" root actions={<SettingsButton />}>
        <EmptyLibrary compact />
      </Screen>
    );
  }
  const f = data.featured;

  return (
    <Screen title="Browse" root actions={<SettingsButton />}>
      {f ? (
        <div className="hero-wrap">
          <button className="hero" onClick={() => nav.push({ kind: 'album', key: f.key })} aria-label={`Featured album: ${f.title} by ${f.artist}`}>
            <Artwork artId={f.artId} seed={f.title + f.artist} kind="full" />
            <div className="hero-shade" />
            <div className="hero-text">
              <span className="eyebrow">Newly Added</span>
              <strong>{f.title}</strong>
              <span>{f.artist}</span>
            </div>
          </button>
          <button className="hero-play" aria-label={`Play ${f.title}`} onClick={() => playList(f.trackIds)}>
            <Icon name="play" size={22} />
          </button>
        </div>
      ) : null}

      {data.newest.length ? (
        <Section title="Recently Added" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyAdded' })}>
          <Shelf>{data.newest.map((a) => <AlbumCard key={a.key} album={a} size="lg" />)}</Shelf>
        </Section>
      ) : null}

      <Section title="Albums" onSeeAll={() => nav.push({ kind: 'albums' })}>
        <Shelf>{lib.albumList.slice(0, 14).map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
      </Section>

      <Section title="Playlists" onSeeAll={() => nav.push({ kind: 'playlists' })}>
        <Shelf>
          <button className="card md new-card" onClick={() => sheets.open({ type: 'playlistEditor' })}>
            <div className="art new-art"><Icon name="plus" size={34} /></div>
            <div className="card-title">New Playlist</div>
            <div className="card-sub">Collect your songs</div>
          </button>
          {lib.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
        </Shelf>
      </Section>

      <Section title="Artists" onSeeAll={() => nav.push({ kind: 'artists' })}>
        <Shelf>{lib.artistList.slice(0, 14).map((a) => <ArtistCard key={a.key} artist={a} size="sm" />)}</Shelf>
      </Section>

      {data.genres.length ? (
        <Section title="Genres" onSeeAll={() => nav.push({ kind: 'genres' })}>
          <div className="genre-grid">
            {data.genres.slice(0, 6).map((g) => <GenreTile key={g.name} genre={g} onClick={() => nav.push({ kind: 'genre', name: g.name })} />)}
          </div>
        </Section>
      ) : null}

      {data.favs.length || data.favPlaylists.length ? (
        <Section title="Favorite Collections">
          <div className="list">
            {data.favs.length ? (
              <button className="row" onClick={() => nav.push({ kind: 'songs', source: 'favorites' })}>
                <div className="row-art fav-art"><Icon name="heart-fill" size={24} /></div>
                <div className="grow"><div className="title">Favorite Songs</div><div className="sub">{plural(data.favs.length, 'song')}</div></div>
                <Icon name="chevron-right" size={16} className="chev" />
              </button>
            ) : null}
            {data.favPlaylists.map((p) => (
              <button key={p.id} className="row" onClick={() => nav.push({ kind: 'playlist', id: p.id })}>
                <div className="row-art"><Artwork artId={p.coverArtId} seed={p.name} /></div>
                <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.kind === 'mix' ? 'Mix' : 'Playlist'}</div></div>
                <Icon name="chevron-right" size={16} className="chev" />
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {data.suggestions.length && data.topGenre ? (
        <Section title={`More ${data.topGenre.name}`} sub="Suggestions from your own library">
          <Shelf>{data.suggestions.map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
        </Section>
      ) : null}
    </Screen>
  );
}
