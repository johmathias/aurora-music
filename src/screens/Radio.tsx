// Radio: shuffle-based "stations" made from your own library. No internet radio is faked.

import { useMemo } from 'react';
import { ArtistCard, GenreTile, PlaylistCard, TrackCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Screen, SettingsButton } from '../components/Screen';
import { Section, Shelf } from '../components/Section';
import { playList } from '../actions';
import { recentlyPlayed, smartById } from '../lib/smart';
import { library, useLibrary } from '../store/library';
import { nav, sheets, showToast } from '../store/ui';
import type { Artist, Genre } from '../types';
import { EmptyLibrary } from './common';

function station(label: string, ids: string[]) {
  if (!ids.length) return showToast('There is nothing to play yet.');
  playList(ids, { shuffle: true });
  showToast(`Playing ${label}`, 'success');
}

export function Radio() {
  const lib = useLibrary((s) => s);

  const data = useMemo(
    () => ({
      recent: recentlyPlayed(lib).slice(0, 12),
      genres: lib.genreList.slice().sort((a, b) => b.trackIds.length - a.trackIds.length),
      artists: lib.artistList.slice().sort((a, b) => b.playCount - a.playCount || b.trackIds.length - a.trackIds.length).slice(0, 14),
      mixes: lib.playlists.filter((p) => p.kind === 'mix'),
    }),
    [lib],
  );

  if (!lib.tracks.length) {
    return (
      <Screen title="Radio" root actions={<SettingsButton />}>
        <EmptyLibrary compact />
      </Screen>
    );
  }

  const all = lib.tracks.filter((t) => !t.missing).map((t) => t.id);
  const artistStation = (a: Artist) => station(`${a.name} Station`, smartById(`mix:artist:${a.key}`, library.get())?.trackIds ?? a.trackIds);
  const genreStation = (g: Genre) => station(`${g.name} Station`, g.trackIds);
  const surprise = () => {
    const albums = lib.albumList;
    const pick = albums[Math.floor(Math.random() * albums.length)];
    if (pick) {
      playList(pick.trackIds);
      showToast(`Playing ${pick.title}`, 'success');
    }
  };

  return (
    <Screen title="Radio" root actions={<SettingsButton />}>
      <p className="section-sub lead">Stations made from your own music. They work with no internet.</p>

      <div className="radio-hero">
        <div className="radio-hero-text">
          <span className="eyebrow">Your Library</span>
          <strong>Shuffle All</strong>
          <span>{all.length} songs, in a surprising order</span>
        </div>
        <button className="radio-play" onClick={() => station('Shuffle All', all)} aria-label="Shuffle all songs">
          <Icon name="shuffle" size={26} />
        </button>
      </div>
      <div className="btn-row radio-actions">
        <button className="btn-pill" onClick={() => playList([all[Math.floor(Math.random() * all.length)]])}>
          <Icon name="play" size={17} />
          Random Song
        </button>
        <button className="btn-pill" onClick={surprise}>
          <Icon name="album" size={19} />
          Random Album
        </button>
      </div>

      {data.recent.length ? (
        <Section title="Recently Played" onSeeAll={() => nav.push({ kind: 'songs', source: 'recentlyPlayed' })}>
          <Shelf>
            {data.recent.map((t, i) => (
              <TrackCard key={t.id} track={t} size="sm" onPlay={() => playList(data.recent.map((x) => x.id), { from: i })} />
            ))}
          </Shelf>
        </Section>
      ) : null}

      {data.genres.length ? (
        <Section title="Music by Genre" sub="Tap a genre to start its station">
          <div className="genre-grid">{data.genres.slice(0, 8).map((g) => <GenreTile key={g.name} genre={g} onClick={() => genreStation(g)} />)}</div>
        </Section>
      ) : null}

      <Section title="Artist Stations" sub="Songs by the artist, plus similar music from your library">
        <Shelf>{data.artists.map((a) => <div key={a.key} className="card-wrap"><ArtistCard artist={a} size="sm" /><button className="station-btn" aria-label={`Start ${a.name} station`} onClick={() => artistStation(a)}><Icon name="radio" size={16} />Station</button></div>)}</Shelf>
      </Section>

      <Section title="Your Mixes" sub="Pick artists and genres and Aurora keeps the mix up to date">
        <Shelf>
          <button className="card md new-card" onClick={() => sheets.open({ type: 'mixEditor' })}>
            <div className="art new-art"><Icon name="plus" size={34} /></div>
            <div className="card-title">New Mix</div>
            <div className="card-sub">Choose artists and genres</div>
          </button>
          {data.mixes.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
        </Shelf>
      </Section>
    </Screen>
  );
}
