// Detail screens: album, artist, playlist, genre and generated mixes.

import { useEffect, useMemo, useState } from 'react';
import { Artwork, CollageArt } from '../components/Artwork';
import { AlbumCard, artIdsFor, PlaylistArt } from '../components/Cards';
import { Icon } from '../components/Icon';
import { EmptyState, Screen } from '../components/Screen';
import { Section, Shelf } from '../components/Section';
import { EditableTrackList, TrackList } from '../components/TrackList';
import { favoriteMany, openAlbumMenu, openPlaylistMenu, playList, playPlaylist } from '../actions';
import { addToQueue, playNext } from '../store/player';
import { formatDurationLong, plural } from '../lib/format';
import { artistKey } from '../lib/indexing';
import { smartById } from '../lib/smart';
import { createPlaylist, markPlaylistPlayed, moveInPlaylist, playlistTrackIds, removeFromPlaylist, updatePlaylist, useLibrary } from '../store/library';
import { nav, openMenu, sheets, showToast } from '../store/ui';
import { PlayShuffle, tracksFrom } from './common';

const MoreButton = ({ onClick, label, onPress }: { onClick: () => void; label: string; onPress?: (e: { currentTarget: HTMLElement }) => void }) => (
  <button className="nav-btn" aria-label={label} onClick={(e) => (onPress ? onPress(e) : onClick())}>
    <Icon name="more" size={24} />
  </button>
);

const NotFound = ({ what }: { what: string }) => (
  <Screen title={what} large={false}>
    <EmptyState icon="warning" title={`${what} not found`} text="It may have been removed from your library." />
  </Screen>
);

// ---------- album ----------

export function AlbumScreen({ albumKey }: { albumKey: string }) {
  const lib = useLibrary((s) => s);
  const album = lib.albums.get(albumKey);
  if (!album) return <NotFound what="Album" />;
  const tracks = tracksFrom(album.trackIds, lib);
  return (
    <Screen title={album.title} large={false} actions={<MoreButton label="Album options" onClick={() => openAlbumMenu(album)} />}>
      <div className="detail-head">
        <div className="detail-bg" aria-hidden="true"><Artwork artId={album.artId} seed={album.title + album.artist} /></div>
        <div className="detail-art"><Artwork artId={album.artId} seed={album.title + album.artist} kind="full" /></div>
        <h1 className="detail-title">{album.title}</h1>
        <button className="detail-link" onClick={() => nav.push({ kind: 'artist', key: artistKey(album.artist) })}>{album.artist}</button>
        <p className="detail-meta">{[album.genre, album.year || null].filter(Boolean).join(' · ') || 'Album'}</p>
      </div>
      <PlayShuffle ids={album.trackIds} />
      <div className="detail-list">
        <TrackList tracks={tracks} numbered sub="none" onPlay={(i) => playList(album.trackIds, { from: i })} />
      </div>
      <p className="footnote">{plural(tracks.length, 'song')}, {formatDurationLong(album.duration)}</p>
    </Screen>
  );
}

// ---------- artist ----------

export function ArtistScreen({ artistKeyValue }: { artistKeyValue: string }) {
  const lib = useLibrary((s) => s);
  const [allSongs, setAllSongs] = useState(false);
  const artist = lib.artists.get(artistKeyValue);
  if (!artist) return <NotFound what="Artist" />;
  const tracks = tracksFrom(artist.trackIds, lib).sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title));
  const albums = artist.albumKeys.map((k) => lib.albums.get(k)).filter((a) => !!a);
  const latest = albums.slice().sort((a, b) => (b!.year || 0) - (a!.year || 0))[0];
  const ids = tracks.map((t) => t.id);
  const allFav = tracks.length > 0 && tracks.every((t) => t.favorite);
  const shown = allSongs ? tracks : tracks.slice(0, 5);
  const openShare = (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    openMenu({
      anchor: { x: r.left, y: r.top, w: r.width, h: r.height },
      items: [
        { label: 'Play Next', icon: 'play-next', onSelect: () => playNext(ids) },
        { label: 'Play Last', icon: 'add-queue', onSelect: () => addToQueue(ids) },
        { label: 'Shuffle', icon: 'shuffle', separatorBefore: true, onSelect: () => playList(ids, { shuffle: true }) },
        { label: 'Change Photo…', icon: 'photo', separatorBefore: true, onSelect: () => sheets.open({ type: 'artistPhoto', key: artist.key }) },
      ],
    });
  };
  return (
    <Screen title={artist.name} large={false} hero actions={<MoreButton label="Artist options" onClick={() => undefined} onPress={openShare} />}>
      <div className="artist-hero">
        <div className="artist-hero-img"><Artwork artId={artist.artId} seed={artist.name} kind="full" initial={artist.name} /></div>
        <div className="artist-hero-fade" />
        <h1 className="artist-hero-name">{artist.name}</h1>
      </div>
      <div className="artist-actions">
        <button className="circle-btn" aria-label="Artist info and photo" onClick={() => sheets.open({ type: 'artistPhoto', key: artist.key })}>
          <Icon name="info" size={20} />
        </button>
        <button className="big-play" aria-label={`Play ${artist.name}`} disabled={!ids.length} onClick={() => playList(ids)}>
          <Icon name="play" size={30} />
        </button>
        <button className={`circle-btn${allFav ? ' on' : ''}`} aria-label={allFav ? 'Remove all songs from Favorites' : 'Favorite all songs'} aria-pressed={allFav} onClick={() => favoriteMany(ids)}>
          <Icon name={allFav ? 'star-fill' : 'star'} size={20} />
        </button>
      </div>
      {latest ? (
        <Section title="Latest Release">
          <button className="release-card" onClick={() => nav.push({ kind: 'album', key: latest.key })}>
            <div className="release-art"><Artwork artId={latest.artId} seed={latest.title + latest.artist} /></div>
            <div className="release-text">
              <small>{[latest.year || null, plural(latest.trackIds.length, 'song')].filter(Boolean).join(' · ')}</small>
              <strong>{latest.title}</strong>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        </Section>
      ) : null}
      <Section title="Top Songs" onSeeAll={tracks.length > 5 ? () => setAllSongs((v) => !v) : undefined}>
        <TrackList tracks={shown} sub="album" onPlay={(i) => playList(ids, { from: i })} />
      </Section>
      {albums.length ? (
        <Section title="Albums">
          <Shelf>{albums.map((a) => <AlbumCard key={a!.key} album={a!} />)}</Shelf>
        </Section>
      ) : null}
    </Screen>
  );
}

// ---------- playlist (and mix) ----------

export function PlaylistScreen({ id }: { id: string }) {
  const lib = useLibrary((s) => s);
  const playlist = lib.playlistById.get(id);
  const [editing, setEditing] = useState(false);

  // if the playlist gets deleted while we are looking at it, go back
  useEffect(() => {
    if (!playlist) nav.pop();
  }, [playlist]);
  if (!playlist) return null;

  const ids = playlistTrackIds(playlist, lib);
  const tracks = tracksFrom(ids, lib);
  const isMix = playlist.kind === 'mix';
  const total = tracks.reduce((n, t) => n + t.duration, 0);

  const actions = (
    <>
      {!isMix && tracks.length > 1 ? (
        <button className="nav-text-btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>
      ) : null}
      <MoreButton label="Playlist options" onClick={() => openPlaylistMenu(playlist)} />
    </>
  );

  return (
    <Screen title={playlist.name} large={false} actions={actions}>
      <div className="detail-head">
        <div className="detail-art"><PlaylistArt playlist={playlist} kind="full" /></div>
        <h1 className="detail-title">{playlist.name}</h1>
        {playlist.description ? <p className="detail-desc">{playlist.description}</p> : null}
        <p className="detail-meta">{isMix ? 'Mix · ' : ''}{plural(tracks.length, 'song')}{total ? `, ${formatDurationLong(total)}` : ''}</p>
        <button className={`fav-toggle${playlist.favorite ? ' on' : ''}`} aria-pressed={playlist.favorite} onClick={() => updatePlaylist(playlist.id, { favorite: !playlist.favorite })}>
          <Icon name={playlist.favorite ? 'heart-fill' : 'heart'} size={18} />
          {playlist.favorite ? 'Favorited' : 'Favorite'}
        </button>
      </div>

      <PlayShufflePlaylist ids={ids} onPlay={(shuffle) => playPlaylist(playlist, shuffle)} />

      {isMix ? (
        <p className="footnote">This mix fills itself from {plural(playlist.rules?.artists.length ?? 0, 'artist')} and {plural(playlist.rules?.genres.length ?? 0, 'genre')} in your library.</p>
      ) : (
        <button className="row add-row" onClick={() => sheets.open({ type: 'addSongs', playlistId: playlist.id })}>
          <div className="row-art new-playlist-art"><Icon name="plus" size={22} /></div>
          <div className="grow"><div className="title accent">Add Songs</div></div>
        </button>
      )}

      {!tracks.length ? (
        <EmptyState icon="note" title="No songs yet" text={isMix ? 'Nothing in your library matches this mix right now.' : 'Tap “Add Songs” or use a song’s menu to add it here.'} />
      ) : editing && !isMix ? (
        <EditableTrackList tracks={tracks} playlistId={playlist.id} onMove={(f, t) => moveInPlaylist(playlist.id, f, t)} onRemove={(i) => removeFromPlaylist(playlist.id, i)} />
      ) : (
        <TrackList
          tracks={tracks}
          sub="both"
          playlistId={isMix ? undefined : playlist.id}
          onPlay={(i) => {
            markPlaylistPlayed(playlist.id);
            playList(ids, { from: i, playlistId: playlist.id });
          }}
        />
      )}
    </Screen>
  );
}

function PlayShufflePlaylist({ ids, onPlay }: { ids: string[]; onPlay: (shuffle: boolean) => void }) {
  return (
    <div className="btn-row">
      <button className="btn-pill" disabled={!ids.length} onClick={() => onPlay(false)}>
        <Icon name="play" size={18} />
        Play
      </button>
      <button className="btn-pill" disabled={!ids.length} onClick={() => onPlay(true)}>
        <Icon name="shuffle" size={19} />
        Shuffle
      </button>
    </div>
  );
}

// ---------- genre ----------

export function GenreScreen({ name }: { name: string }) {
  const lib = useLibrary((s) => s);
  const genre = lib.genres.get(name);
  if (!genre) return <NotFound what="Genre" />;
  const tracks = tracksFrom(genre.trackIds, lib).sort((a, b) => a.title.localeCompare(b.title));
  const ids = tracks.map((t) => t.id);
  return (
    <Screen title={genre.name} eyebrow="Genre">
      <p className="section-sub lead">{plural(tracks.length, 'song')}</p>
      <PlayShuffle ids={ids} />
      <div className="detail-list">
        <TrackList tracks={tracks} sub="both" onPlay={(i) => playList(ids, { from: i })} />
      </div>
    </Screen>
  );
}

// ---------- generated mixes (Made For You, Heavy Rotation) ----------

export function SmartScreen({ id }: { id: string }) {
  const lib = useLibrary((s) => s);
  const mix = useMemo(() => smartById(id, lib), [id, lib]);
  if (!mix) return <NotFound what="Mix" />;
  const tracks = tracksFrom(mix.trackIds, lib);
  const save = async () => {
    const p = await createPlaylist({ name: uniqueName(mix.title, lib.playlists.map((x) => x.name)), trackIds: mix.trackIds });
    markPlaylistPlayed(p.id);
    showToast(`Saved as “${p.name}”`, 'success');
  };
  return (
    <Screen title={mix.title} large={false}>
      <div className="detail-head">
        <div className="detail-art"><CollageArt artIds={artIdsFor(mix.trackIds)} seed={mix.seed} kind="full" /></div>
        <h1 className="detail-title">{mix.title}</h1>
        <p className="detail-meta">{mix.subtitle} · {plural(tracks.length, 'song')}</p>
      </div>
      <PlayShuffle ids={mix.trackIds} />
      <div className="btn-row single">
        <button className="btn-pill" onClick={save}>
          <Icon name="add-playlist" size={19} />
          Save as Playlist
        </button>
      </div>
      <div className="detail-list">
        <TrackList tracks={tracks} sub="both" onPlay={(i) => playList(mix.trackIds, { from: i })} />
      </div>
    </Screen>
  );
}

function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  let n = 2;
  while (lower.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
