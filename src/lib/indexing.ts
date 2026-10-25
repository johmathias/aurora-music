// Works out albums, artists and genres from the list of tracks.
// Nothing here is stored: it is rebuilt whenever the tracks change.

import { normalize } from './format';
import type { Album, Artist, Genre, Track } from '../types';

/** "Artist feat. Someone" and "A, B" both belong to the first artist. */
export function primaryArtist(name: string): string {
  const first = name.split(/\s*(?:,|;|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/i)[0]?.trim();
  return first || name || 'Unknown Artist';
}

export const artistKey = (name: string) => normalize(primaryArtist(name));
export const albumKey = (artist: string, album: string) => `${normalize(artist)}::${normalize(album)}`;
export const trackAlbumKey = (t: Track) => albumKey(primaryArtist(t.albumArtist || t.artist), t.album);

export interface LibraryIndex {
  albums: Map<string, Album>;
  artists: Map<string, Artist>;
  genres: Map<string, Genre>;
  albumList: Album[];
  artistList: Artist[];
  genreList: Genre[];
}

const byTrackOrder = (byId: Map<string, Track>) => (a: string, b: string) => {
  const ta = byId.get(a)!;
  const tb = byId.get(b)!;
  return ta.discNo - tb.discNo || ta.trackNo - tb.trackNo || ta.title.localeCompare(tb.title);
};

export function buildIndex(tracks: Track[]): LibraryIndex {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const albums = new Map<string, Album>();
  const artists = new Map<string, Artist>();
  const genres = new Map<string, Genre>();

  for (const t of tracks) {
    // album
    const ak = trackAlbumKey(t);
    let album = albums.get(ak);
    if (!album) {
      album = {
        key: ak, title: t.album, artist: primaryArtist(t.albumArtist || t.artist), trackIds: [], artId: undefined,
        year: 0, genre: '', addedAt: 0, playCount: 0, lastPlayedAt: 0, duration: 0,
      };
      albums.set(ak, album);
    }
    album.trackIds.push(t.id);
    album.artId = album.artId ?? t.artId;
    album.year = album.year || t.year;
    album.genre = album.genre || t.genre;
    album.addedAt = Math.max(album.addedAt, t.addedAt);
    album.playCount += t.playCount;
    album.lastPlayedAt = Math.max(album.lastPlayedAt, t.lastPlayedAt);
    album.duration += t.duration;

    // artist (by track artist, so featured songs show up too)
    const ark = artistKey(t.artist);
    let artist = artists.get(ark);
    if (!artist) {
      artist = { key: ark, name: primaryArtist(t.artist), trackIds: [], albumKeys: [], artId: undefined, playCount: 0, duration: 0 };
      artists.set(ark, artist);
    }
    artist.trackIds.push(t.id);
    if (!artist.albumKeys.includes(ak)) artist.albumKeys.push(ak);
    artist.artId = artist.artId ?? t.artId;
    artist.playCount += t.playCount;
    artist.duration += t.duration;

    // genre
    if (t.genre) {
      const gk = t.genre.trim();
      let genre = genres.get(gk);
      if (!genre) {
        genre = { name: gk, trackIds: [], artId: undefined };
        genres.set(gk, genre);
      }
      genre.trackIds.push(t.id);
      genre.artId = genre.artId ?? t.artId;
    }
  }

  const order = byTrackOrder(byId);
  albums.forEach((a) => a.trackIds.sort(order));
  const albumList = Array.from(albums.values()).sort((a, b) => a.title.localeCompare(b.title));
  const artistList = Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));
  const genreList = Array.from(genres.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { albums, artists, genres, albumList, artistList, genreList };
}
