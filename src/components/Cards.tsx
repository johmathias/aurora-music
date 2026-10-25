// Album, artist, playlist, track, mix and genre cards used on many screens.

import { Artwork, CollageArt } from './Artwork';
import { Icon } from './Icon';
import { nav } from '../store/ui';
import { library, playlistArtIds, playlistTrackIds, useLibrary } from '../store/library';
import { placeholderBackground } from '../lib/artwork';
import { plural } from '../lib/format';
import type { SmartCollection } from '../lib/smart';
import type { Album, Artist, Genre, Playlist, Track } from '../types';

export type CardSize = 'sm' | 'md' | 'lg';

export function AlbumCard({ album, size = 'md' }: { album: Album; size?: CardSize }) {
  return (
    <button className={`card ${size}`} onClick={() => nav.push({ kind: 'album', key: album.key })}>
      <Artwork artId={album.artId} seed={album.title + album.artist} kind={size === 'lg' ? 'full' : 'thumb'} />
      <div className="card-title">{album.title}</div>
      <div className="card-sub">{album.artist}</div>
    </button>
  );
}

export function ArtistCard({ artist, size = 'md' }: { artist: Artist; size?: CardSize }) {
  return (
    <button className={`card artist ${size}`} onClick={() => nav.push({ kind: 'artist', key: artist.key })}>
      <Artwork artId={artist.artId} seed={artist.name} round initial={artist.name} />
      <div className="card-title">{artist.name}</div>
      <div className="card-sub">{plural(artist.trackIds.length, 'song')}</div>
    </button>
  );
}

export function PlaylistArt({ playlist, kind = 'thumb', className = '' }: { playlist: Playlist; kind?: 'thumb' | 'full'; className?: string }) {
  const state = useLibrary((s) => s);
  if (playlist.coverArtId) return <Artwork artId={playlist.coverArtId} seed={playlist.name} kind={kind} className={className} />;
  return <CollageArt artIds={playlistArtIds(playlist, state)} seed={playlist.name + playlist.coverSeed} kind={kind} className={className} />;
}

export function PlaylistCard({ playlist, size = 'md', onClick }: { playlist: Playlist; size?: CardSize; onClick?: () => void }) {
  const count = playlistTrackIds(playlist).length;
  return (
    <button className={`card ${size}`} onClick={onClick ?? (() => nav.push({ kind: 'playlist', id: playlist.id }))}>
      <PlaylistArt playlist={playlist} kind={size === 'lg' ? 'full' : 'thumb'} />
      <div className="card-title">{playlist.name}</div>
      <div className="card-sub">{playlist.kind === 'mix' ? 'Mix' : plural(count, 'song')}</div>
    </button>
  );
}

/** A song shown as a square cover. Tapping plays it. */
export function TrackCard({ track, onPlay, size = 'md' }: { track: Track; onPlay: () => void; size?: CardSize }) {
  return (
    <button className={`card ${size}`} onClick={onPlay}>
      <Artwork artId={track.artId} seed={track.album + track.artist} />
      <div className="card-title">{track.title}</div>
      <div className="card-sub">{track.artist}</div>
    </button>
  );
}

/** The first four different pictures from a list of songs. */
export function artIdsFor(trackIds: string[], max = 4): string[] {
  const ids: string[] = [];
  const { byId } = library.get();
  for (const id of trackIds) {
    const art = byId.get(id)?.artId;
    if (art && !ids.includes(art)) ids.push(art);
    if (ids.length === max) break;
  }
  return ids;
}

/** A "Made For You" mix: collage cover with the name written on it. */
export function MixCard({ mix, size = 'md' }: { mix: SmartCollection; size?: CardSize }) {
  return (
    <button className={`card mix ${size}`} onClick={() => nav.push({ kind: 'smart', id: mix.id })}>
      <div className="mix-art">
        <CollageArt artIds={artIdsFor(mix.trackIds)} seed={mix.seed} kind="thumb" />
        <div className="mix-label">
          <span className="eyebrow">Mix</span>
          <strong>{mix.title}</strong>
        </div>
      </div>
      <div className="card-sub mix-sub">{mix.subtitle}</div>
    </button>
  );
}

export function GenreTile({ genre, onClick }: { genre: Genre; onClick: () => void }) {
  return (
    <button className="genre-tile" style={{ backgroundImage: placeholderBackground('genre:' + genre.name) }} onClick={onClick}>
      <span className="genre-name">{genre.name}</span>
      <span className="genre-count">{plural(genre.trackIds.length, 'song')}</span>
      {genre.artId ? (
        <span className="genre-art">
          <Artwork artId={genre.artId} seed={genre.name} />
        </span>
      ) : (
        <span className="genre-art ph">
          <Icon name="note" size={30} />
        </span>
      )}
    </button>
  );
}
