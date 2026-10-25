// "Smart" collections made from what is really in the library and what the user
// has really played. Nothing here comes from the internet.

import { hashString, normalize } from './format';
import { artistKey } from './indexing';
import type { Album, Artist, Track } from '../types';
import type { LibraryState } from '../store/library';

export interface SmartCollection {
  id: string;
  title: string;
  subtitle: string;
  trackIds: string[];
  seed: string;
}

const DAY = 86400000;

const playable = (t: Track) => !t.missing;

export function recentlyAdded(s: LibraryState): Track[] {
  return s.tracks.filter(playable).sort((a, b) => b.addedAt - a.addedAt);
}
export function recentlyPlayed(s: LibraryState): Track[] {
  return s.tracks.filter((t) => playable(t) && t.lastPlayedAt > 0).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}
export function mostPlayed(s: LibraryState): Track[] {
  return s.tracks.filter((t) => playable(t) && t.playCount > 0).sort((a, b) => b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt);
}
export function favorites(s: LibraryState): Track[] {
  return s.tracks.filter((t) => playable(t) && t.favorite).sort((a, b) => a.title.localeCompare(b.title));
}
export function importedTracks(s: LibraryState): Track[] {
  return s.tracks.filter((t) => !t.sample).sort((a, b) => b.addedAt - a.addedAt);
}

/** A shuffle that gives the same answer all day, so a "mix" does not change every time you look. */
function dailyShuffle<T>(list: T[], seed: string): T[] {
  const day = Math.floor(Date.now() / DAY);
  let state = hashString(`${seed}:${day}`) || 1;
  const rand = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Albums you played most in the last month (falls back to all-time plays). */
export function heavyRotationAlbums(s: LibraryState, limit = 12): Album[] {
  const since = Date.now() - 30 * DAY;
  const counts = new Map<string, number>();
  for (const h of s.history) {
    if (h.at < since) break; // history is newest first
    const t = s.byId.get(h.trackId);
    if (!t) continue;
    const album = Array.from(s.albums.values()).find((a) => a.trackIds.includes(t.id));
    if (album) counts.set(album.key, (counts.get(album.key) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => s.albums.get(key)!)
    .filter(Boolean);
  return ranked.slice(0, limit);
}

/** Albums that sit close to what you play (same artist or genre) but that you have played little. */
export function albumsYouMayLike(s: LibraryState, limit = 12): Album[] {
  const liked = mostPlayed(s).slice(0, 20);
  const artists = new Set(liked.map((t) => artistKey(t.artist)));
  const genres = new Set(liked.map((t) => t.genre).filter(Boolean));
  const candidates = s.albumList.filter((a) => {
    const t = s.byId.get(a.trackIds[0]);
    if (!t) return false;
    const related = artists.has(artistKey(t.artist)) || (!!a.genre && genres.has(a.genre));
    return related;
  });
  const pool = candidates.length ? candidates : s.albumList;
  return dailyShuffle(
    pool.filter((a) => a.playCount <= 2),
    'albums-you-may-like',
  ).slice(0, limit);
}

export function suggestedArtists(s: LibraryState, limit = 12): Artist[] {
  return s.artistList
    .slice()
    .sort((a, b) => b.playCount - a.playCount || b.trackIds.length - a.trackIds.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function playlistsRecentlyPlayed(s: LibraryState, limit = 10) {
  return s.playlists.filter((p) => p.lastPlayedAt > 0).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, limit);
}

// ---------- mixes ("Made For You") ----------

function topBy<T>(list: T[], score: (x: T) => number): T | undefined {
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}

function buildMix(id: string, s: LibraryState): SmartCollection | undefined {
  if (id === 'mix:favorites') {
    const list = favorites(s);
    if (list.length < 2) return undefined;
    return { id, title: 'Favorites Mix', subtitle: 'Songs you marked with a heart', trackIds: dailyShuffle(list.map((t) => t.id), id), seed: id };
  }
  if (id === 'mix:rediscover') {
    const cutoff = Date.now() - 30 * DAY;
    const list = s.tracks.filter((t) => playable(t) && (t.lastPlayedAt === 0 || t.lastPlayedAt < cutoff));
    if (list.length < 4) return undefined;
    return { id, title: 'Rediscover', subtitle: 'Songs you have not played in a while', trackIds: dailyShuffle(list.map((t) => t.id), id).slice(0, 50), seed: id };
  }
  if (id.startsWith('mix:artist:')) {
    const key = id.slice('mix:artist:'.length);
    const artist = s.artists.get(key);
    if (!artist) return undefined;
    const genres = new Set(artist.trackIds.map((tid) => s.byId.get(tid)?.genre).filter(Boolean));
    const same = artist.trackIds;
    const similar = s.tracks.filter((t) => playable(t) && !same.includes(t.id) && genres.has(t.genre)).map((t) => t.id);
    const trackIds = [...dailyShuffle(same, id), ...dailyShuffle(similar, id).slice(0, 30)];
    if (trackIds.length < 3) return undefined;
    return { id, title: `${artist.name} & More`, subtitle: 'Songs by this artist and similar music', trackIds, seed: id };
  }
  if (id.startsWith('mix:genre:')) {
    const name = id.slice('mix:genre:'.length);
    const genre = s.genres.get(name);
    if (!genre || genre.trackIds.length < 3) return undefined;
    return { id, title: `${genre.name} Mix`, subtitle: `Your ${genre.name} music`, trackIds: dailyShuffle(genre.trackIds, id), seed: id };
  }
  if (id === 'heavyRotation') {
    const albums = heavyRotationAlbums(s, 8);
    if (!albums.length) return undefined;
    return { id, title: 'Heavy Rotation', subtitle: 'Albums you have played the most lately', trackIds: albums.flatMap((a) => a.trackIds), seed: id };
  }
  return undefined;
}

export function smartById(id: string, s: LibraryState): SmartCollection | undefined {
  return buildMix(id, s);
}

export function madeForYou(s: LibraryState): SmartCollection[] {
  if (!s.tracks.length) return [];
  const ids: string[] = ['mix:favorites'];
  const topArtist = topBy(s.artistList, (a) => a.playCount * 100 + a.trackIds.length);
  if (topArtist) ids.push(`mix:artist:${topArtist.key}`);
  const topGenre = topBy(s.genreList, (g) => g.trackIds.reduce((n, id) => n + (s.byId.get(id)?.playCount ?? 0), 0) * 100 + g.trackIds.length);
  if (topGenre) ids.push(`mix:genre:${topGenre.name}`);
  ids.push('mix:rediscover');
  return ids.map((id) => buildMix(id, s)).filter((m): m is SmartCollection => !!m);
}

// ---------- local search ----------

export interface SearchResults {
  songs: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: LibraryState['playlists'];
  genres: LibraryState['genreList'];
}

function score(text: string, query: string): number {
  const t = normalize(text);
  if (!t) return 0;
  if (t === query) return 4;
  if (t.startsWith(query)) return 3;
  if (t.split(' ').some((w) => w.startsWith(query))) return 2;
  if (t.includes(query)) return 1;
  return 0;
}

export function searchLibrary(s: LibraryState, raw: string): SearchResults {
  const q = normalize(raw);
  const empty: SearchResults = { songs: [], artists: [], albums: [], playlists: [], genres: [] };
  if (!q) return empty;
  const rank = <T,>(items: T[], pick: (x: T) => number) =>
    items
      .map((x) => ({ x, v: pick(x) }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .map((r) => r.x);
  return {
    songs: rank(s.tracks, (t) => Math.max(score(t.title, q) * 2, score(t.artist, q), score(t.album, q), score(t.genre, q))),
    artists: rank(s.artistList, (a) => score(a.name, q)),
    albums: rank(s.albumList, (a) => Math.max(score(a.title, q) * 2, score(a.artist, q))),
    playlists: rank(s.playlists, (p) => Math.max(score(p.name, q), score(p.description, q))),
    genres: rank(s.genreList, (g) => score(g.name, q)),
  };
}
