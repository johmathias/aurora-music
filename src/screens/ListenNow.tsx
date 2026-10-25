// Listen Now: the home screen. Every section is made from what is really in the library.

import { useMemo } from 'react';
import { Artwork } from '../components/Artwork';
import { AlbumCard, ArtistCard, MixCard, PlaylistCard, TrackCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Screen, SettingsButton } from '../components/Screen';
import { Section, Shelf } from '../components/Section';
import { TrackList } from '../components/TrackList';
import { playList } from '../actions';
import { greeting } from '../lib/format';
import { trackAlbumKey } from '../lib/indexing';
import { albumsYouMayLike, favorites, heavyRotationAlbums, madeForYou, mostPlayed, playlistsRecentlyPlayed, recentlyAdded, recentlyPlayed, suggestedArtists } from '../lib/smart';
import { useLibrary } from '../store/library';
import { toggle, useCurrentTrack, usePlaybackDuration, usePlaybackSecond, usePlayer } from '../store/player';
import { nav, nowPlaying } from '../store/ui';
import { EmptyLibrary } from './common';

function ContinueCard() {
  const track = useCurrentTrack();
  const playing = usePlayer((s) => s.playing);
  const second = usePlaybackSecond();
  const duration = usePlaybackDuration();
  if (!track) return null;
  const pct = duration > 0 ? Math.min(100, (second / duration) * 100) : 0;
  return (
    <div className="continue glass" role="button" tabIndex={0} onClick={() => nowPlaying.open()} onKeyDown={(e) => e.key === 'Enter' && nowPlaying.open()} aria-label={`Continue listening: ${track.title}`}>
      <div className="continue-art">
        <Artwork artId={track.artId} seed={track.album + track.artist} />
      </div>
      <div className="continue-text">
        <span className="eyebrow">{playing ? 'Now Playing' : 'Continue Listening'}</span>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
        <div className="continue-bar"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <button
        className="continue-play"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={26} />
      </button>
    </div>
  );
}

export function ListenNow() {
  const lib = useLibrary((s) => s);
  const hasTracks = lib.tracks.length > 0;

  const data = useMemo(() => {
    const played = recentlyPlayed(lib);
    const seen = new Set<string>();
    const recentAlbums = [];
    for (const t of played) {
      const k = trackAlbumKey(t);
      if (!seen.has(k) && lib.albums.has(k)) {
        seen.add(k);
        recentAlbums.push(lib.albums.get(k)!);
      }
      if (recentAlbums.length === 12) break;
    }
    return {
      recentAlbums,
      mixes: madeForYou(lib),
      heavy: heavyRotationAlbums(lib),
      added: lib.albumList.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 12),
      favs: favorites(lib),
      like: albumsYouMayLike(lib),
      playlists: playlistsRecentlyPlayed(lib),
      artists: suggestedArtists(lib),
      top: mostPlayed(lib).slice(0, 5),
      hasHistory: played.length > 0,
    };
  }, [lib]);

  const when = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Screen title={greeting()} eyebrow={when} root actions={<SettingsButton />}>
      {!hasTracks ? (
        <EmptyLibrary />
      ) : (
        <>
          <div className="section first">
            <ContinueCard />
          </div>

          {data.recentAlbums.length ? (
            <Section title="Recently Played" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyPlayed' })}>
              <Shelf>{data.recentAlbums.map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
            </Section>
          ) : null}

          {data.mixes.length ? (
            <Section title="Made For You" sub="Mixes built from your own library and listening">
              <Shelf>{data.mixes.map((m) => <MixCard key={m.id} mix={m} />)}</Shelf>
            </Section>
          ) : null}

          {data.heavy.length ? (
            <Section title="Heavy Rotation" onSeeAll={() => nav.push({ kind: 'smart', id: 'heavyRotation' })}>
              <Shelf>{data.heavy.map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
            </Section>
          ) : null}

          <Section title="Recently Added" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyAdded' })}>
            <Shelf>{data.added.map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
          </Section>

          {data.favs.length ? (
            <Section title="Favorite Songs" onSeeAll={() => nav.push({ kind: 'songs', source: 'favorites' })}>
              <Shelf>
                {data.favs.slice(0, 12).map((t, i) => (
                  <TrackCard key={t.id} track={t} onPlay={() => playList(data.favs.map((x) => x.id), { from: i })} />
                ))}
              </Shelf>
            </Section>
          ) : null}

          {data.like.length ? (
            <Section title="Albums You May Like" sub="Picked from your library, based on what you play">
              <Shelf>{data.like.map((a) => <AlbumCard key={a.key} album={a} />)}</Shelf>
            </Section>
          ) : null}

          {data.playlists.length ? (
            <Section title="Recently Played Playlists" onSeeAll={() => nav.push({ kind: 'playlists' })}>
              <Shelf>{data.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</Shelf>
            </Section>
          ) : null}

          {data.artists.length ? (
            <Section title="Suggested Artists" onSeeAll={() => nav.push({ kind: 'artists' })}>
              <Shelf>{data.artists.map((a) => <ArtistCard key={a.key} artist={a} size="sm" />)}</Shelf>
            </Section>
          ) : null}

          {data.top.length ? (
            <Section title="Most Played" onSeeAll={() => nav.push({ kind: 'songs', source: 'mostPlayed' })}>
              <TrackList tracks={data.top} onPlay={(i) => playList(data.top.map((t) => t.id), { from: i })} sub="both" />
            </Section>
          ) : null}

          {!data.hasHistory ? <p className="footnote center">Play some songs and this page fills with Recently Played, Heavy Rotation, Most Played and mixes made just for you.</p> : null}
          {recentlyAdded(lib).length === 0 ? null : null}
        </>
      )}
    </Screen>
  );
}
