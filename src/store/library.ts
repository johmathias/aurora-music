// The music library: tracks, playlists, play history and lyrics.
// Every change is saved to IndexedDB first-class, so nothing is lost on reload.

import { store as db, getAudioBlob, kvGet, kvSet } from '../lib/db';

import { buildIndex, artistKey, primaryArtist, type LibraryIndex } from '../lib/indexing';
import { forgetArtwork } from '../lib/artwork';
import { parseLyrics } from '../lib/lyrics';
import { uid } from '../lib/format';
import { createStore, useStore } from './createStore';
import { toastError } from './ui';
import type { ArtworkRec, HistoryEntry, LyricsRec, MixRules, Playlist, Track } from '../types';

export interface LibraryState extends LibraryIndex {
  ready: boolean;
  error: string | null;
  tracks: Track[];
  byId: Map<string, Track>;
  playlists: Playlist[];
  playlistById: Map<string, Playlist>;
  history: HistoryEntry[];
  totalBytes: number;
}

const emptyIndex = buildIndex([]);

export const library = createStore<LibraryState>({
  ...emptyIndex,
  ready: false,
  error: null,
  tracks: [],
  byId: new Map(),
  playlists: [],
  playlistById: new Map(),
  history: [],
  totalBytes: 0,
});

export const useLibrary = <S,>(selector: (s: LibraryState) => S) => useStore(library, selector);

// ---------- helpers ----------

// Pictures the user picked for artists (artist key -> artwork id).
let artistPhotos: Record<string, string> = {};

function applyTracks(tracks: Track[]) {
  const index = buildIndex(tracks);
  for (const a of index.artists.values()) {
    a.ownArtId = artistPhotos[a.key];
    if (a.ownArtId) a.artId = a.ownArtId;
  }
  library.set({
    tracks,
    byId: new Map(tracks.map((t) => [t.id, t])),
    totalBytes: tracks.reduce((n, t) => n + t.size, 0),
    ...index,
  });
}

/** Give an artist their own picture (or pass null to go back to the album cover). */
export function setArtistPhoto(key: string, artId: string | null): void {
  const next = { ...artistPhotos };
  const old = next[key];
  if (artId) next[key] = artId;
  else delete next[key];
  artistPhotos = next;
  void kvSet('artistPhotos', artistPhotos);
  applyTracks(library.get().tracks);
  if (old && old !== artId) void db.delete('artwork', old).catch(() => undefined);
  if (old && old !== artId) forgetArtwork(old);
}

function applyPlaylists(playlists: Playlist[]) {
  library.set({ playlists, playlistById: new Map(playlists.map((p) => [p.id, p])) });
}

async function persist(work: () => Promise<void>, message = 'Could not save your change.') {
  try {
    await work();
  } catch (e) {
    console.error(e);
    toastError(message);
  }
}

type RemovalListener = (trackIds: string[]) => void;
const removalListeners = new Set<RemovalListener>();
/** The player listens here so it can drop songs that were deleted. */
export const onTracksRemoved = (fn: RemovalListener) => {
  removalListeners.add(fn);
  return () => removalListeners.delete(fn);
};

// ---------- start up ----------

export async function initLibrary(): Promise<void> {
  try {
    const [tracks, playlists, history] = await Promise.all([
      db.all<Track>('tracks'),
      db.all<Playlist>('playlists'),
      db.all<HistoryEntry>('history'),
    ]);
    history.sort((a, b) => b.at - a.at);
    if (history.length > 4000) {
      // keep the history from growing forever
      const old = history.splice(3000);
      await db.batch(old.filter((h) => h.id !== undefined).map((h) => ({ store: 'history' as const, delete: h.id! })));
    }
    artistPhotos = await kvGet<Record<string, string>>('artistPhotos', {});
    applyTracks(tracks);
    applyPlaylists(playlists);
    library.set({ history, ready: true, error: null });
  } catch (e) {
    console.error(e);
    library.set({
      ready: true,
      error: e instanceof Error ? e.message : 'Your library could not be opened.',
    });
  }
}

// ---------- adding tracks (used by the importer) ----------

export async function addTrackRecord(track: Track, audio: Blob, artwork: ArtworkRec | null, lyrics: LyricsRec | null): Promise<void> {
  // One transaction: the song, its file, its picture and lyrics are saved together or not at all.
  const ops: Parameters<typeof db.batch>[0] = [
    { store: 'tracks', put: track },
    { store: 'blobs', put: { id: track.id, blob: audio } },
  ];
  if (artwork) ops.push({ store: 'artwork', put: artwork });
  if (lyrics) ops.push({ store: 'lyrics', put: lyrics });
  await db.batch(ops);
  applyTracks([...library.get().tracks, track]);
}

// ---------- changing tracks ----------

export function updateTrack(id: string, patch: Partial<Track>): void {
  const current = library.get().byId.get(id);
  if (!current) return;
  const updated = { ...current, ...patch };
  applyTracks(library.get().tracks.map((t) => (t.id === id ? updated : t)));
  void persist(() => db.put('tracks', updated));
}

export function toggleFavorite(id: string): void {
  const t = library.get().byId.get(id);
  if (t) updateTrack(id, { favorite: !t.favorite });
}

export function setFavorite(ids: string[], value: boolean): void {
  const { tracks, byId } = library.get();
  const set = new Set(ids);
  const updated: Track[] = [];
  applyTracks(
    tracks.map((t) => {
      if (!set.has(t.id) || t.favorite === value) return t;
      const u = { ...t, favorite: value };
      updated.push(u);
      return u;
    }),
  );
  void byId;
  void persist(() => db.batch(updated.map((t) => ({ store: 'tracks' as const, put: t }))));
}

export function recordPlayStart(trackId: string): void {
  const t = library.get().byId.get(trackId);
  if (!t) return;
  const entry: HistoryEntry = { trackId, at: Date.now() };
  library.set((s) => ({ history: [entry, ...s.history].slice(0, 4000) }));
  const updated = { ...t, lastPlayedAt: entry.at };
  applyTracks(library.get().tracks.map((x) => (x.id === trackId ? updated : x)));
  void persist(() => db.batch([{ store: 'tracks', put: updated }, { store: 'history', put: { trackId, at: entry.at } }]));
}

/** Called once a song has really been listened to (30 seconds or half of it). */
export function recordPlayCounted(trackId: string): void {
  const t = library.get().byId.get(trackId);
  if (!t) return;
  updateTrack(trackId, { playCount: t.playCount + 1 });
}

export async function clearHistory(): Promise<void> {
  const { tracks } = library.get();
  const reset = tracks.map((t) => ({ ...t, playCount: 0, lastPlayedAt: 0 }));
  await db.batch([
    ...reset.filter((_, i) => tracks[i].playCount || tracks[i].lastPlayedAt).map((t) => ({ store: 'tracks' as const, put: t })),
  ]);
  await db.clear('history');
  applyTracks(reset);
  library.set({
    history: [],
    playlists: library.get().playlists.map((p) => ({ ...p, lastPlayedAt: 0 })),
  });
  const cleared = library.get().playlists;
  applyPlaylists(cleared);
  await persist(() => db.batch(cleared.map((p) => ({ store: 'playlists' as const, put: p }))));
}

// ---------- removing tracks ----------

export async function removeTracks(ids: string[]): Promise<void> {
  const { tracks, playlists, byId } = library.get();
  const remove = new Set(ids);
  const remaining = tracks.filter((t) => !remove.has(t.id));
  const stillUsed = new Set(remaining.map((t) => t.artId).filter(Boolean) as string[]);
  playlists.forEach((p) => p.coverArtId && stillUsed.add(p.coverArtId));
  Object.values(artistPhotos).forEach((a) => stillUsed.add(a));
  const orphanArt = new Set<string>();
  for (const id of ids) {
    const art = byId.get(id)?.artId;
    if (art && !stillUsed.has(art)) orphanArt.add(art);
  }

  const touchedPlaylists = playlists.filter((p) => p.trackIds.some((id) => remove.has(id)));
  const newPlaylists = playlists.map((p) =>
    touchedPlaylists.includes(p) ? { ...p, trackIds: p.trackIds.filter((id) => !remove.has(id)), updatedAt: Date.now() } : p,
  );

  const historyKeys = library.get().history.filter((h) => remove.has(h.trackId) && h.id !== undefined).map((h) => h.id!);
  await db.batch([
    ...ids.flatMap((id) => [
      { store: 'tracks' as const, delete: id },
      { store: 'blobs' as const, delete: id },
      { store: 'lyrics' as const, delete: id },
    ]),
    ...Array.from(orphanArt).map((id) => ({ store: 'artwork' as const, delete: id })),
    ...newPlaylists.filter((p) => touchedPlaylists.includes(p)).map((p) => ({ store: 'playlists' as const, put: p })),
    ...historyKeys.map((k) => ({ store: 'history' as const, delete: k })),
  ]);
  orphanArt.forEach(forgetArtwork);
  applyTracks(remaining);
  applyPlaylists(newPlaylists);
  library.set((s) => ({ history: s.history.filter((h) => !remove.has(h.trackId)) }));
  removalListeners.forEach((fn) => fn(ids));
}

export async function resetEverything(): Promise<void> {
  for (const name of ['tracks', 'blobs', 'artwork', 'playlists', 'lyrics', 'history'] as const) await db.clear(name);
  artistPhotos = {};
  void kvSet('artistPhotos', {});
  applyTracks([]);
  applyPlaylists([]);
  library.set({ history: [] });
  removalListeners.forEach((fn) => fn(['*']));
}

/** Checks that every song's audio file is still stored. Marks the ones that are not. */
export async function verifyLibrary(): Promise<number> {
  const { tracks } = library.get();
  const changed: Track[] = [];
  const next: Track[] = [];
  let missing = 0;
  for (const t of tracks) {
    let blob: Blob | null = null;
    try {
      blob = await getAudioBlob(t.id);
    } catch {
      blob = null;
    }
    const isMissing = !blob;
    if (isMissing) missing++;
    if (!!t.missing !== isMissing) {
      const u = { ...t, missing: isMissing };
      changed.push(u);
      next.push(u);
    } else next.push(t);
  }
  if (changed.length) {
    applyTracks(next);
    await persist(() => db.batch(changed.map((t) => ({ store: 'tracks' as const, put: t }))));
  }
  return missing;
}

// ---------- playlists ----------

export interface NewPlaylist {
  name: string;
  description?: string;
  trackIds?: string[];
  kind?: 'manual' | 'mix';
  rules?: MixRules;
  coverArtId?: string;
}

export function validatePlaylistName(name: string, ignoreId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your playlist a name.';
  if (trimmed.length > 60) return 'Names can be up to 60 characters.';
  const clash = library.get().playlists.some((p) => p.id !== ignoreId && p.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (clash) return 'You already have a playlist with this name.';
  return null;
}

export async function createPlaylist(input: NewPlaylist): Promise<Playlist> {
  const now = Date.now();
  const playlist: Playlist = {
    id: uid('pl'),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    kind: input.kind ?? 'manual',
    trackIds: input.kind === 'mix' ? [] : Array.from(new Set(input.trackIds ?? [])),
    rules: input.rules,
    coverArtId: input.coverArtId,
    coverSeed: Math.floor(Math.random() * 1e9),
    favorite: false,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: 0,
  };
  await db.put('playlists', playlist);
  applyPlaylists([...library.get().playlists, playlist]);
  return playlist;
}

export function updatePlaylist(id: string, patch: Partial<Playlist>): void {
  const current = library.get().playlistById.get(id);
  if (!current) return;
  const updated: Playlist = { ...current, ...patch, updatedAt: Date.now() };
  applyPlaylists(library.get().playlists.map((p) => (p.id === id ? updated : p)));
  void persist(() => db.put('playlists', updated));
}

export async function deletePlaylist(id: string): Promise<void> {
  // Only the playlist is removed. The songs stay in the library.
  await db.delete('playlists', id);
  applyPlaylists(library.get().playlists.filter((p) => p.id !== id));
}

/** Adds songs. Returns how many were really added (songs already inside are skipped). */
export function addToPlaylist(playlistId: string, ids: string[]): number {
  const p = library.get().playlistById.get(playlistId);
  if (!p || p.kind === 'mix') return 0;
  const have = new Set(p.trackIds);
  const fresh = ids.filter((id, i) => !have.has(id) && ids.indexOf(id) === i);
  if (fresh.length) updatePlaylist(playlistId, { trackIds: [...p.trackIds, ...fresh] });
  return fresh.length;
}

export function removeFromPlaylist(playlistId: string, position: number): void {
  const p = library.get().playlistById.get(playlistId);
  if (!p) return;
  updatePlaylist(playlistId, { trackIds: p.trackIds.filter((_, i) => i !== position) });
}

export function moveInPlaylist(playlistId: string, from: number, to: number): void {
  const p = library.get().playlistById.get(playlistId);
  if (!p || from === to) return;
  const list = p.trackIds.slice();
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  updatePlaylist(playlistId, { trackIds: list });
}

export function markPlaylistPlayed(playlistId: string): void {
  const p = library.get().playlistById.get(playlistId);
  if (!p) return;
  const updated = { ...p, lastPlayedAt: Date.now() };
  applyPlaylists(library.get().playlists.map((x) => (x.id === playlistId ? updated : x)));
  void persist(() => db.put('playlists', updated));
}

/** The real list of songs in a playlist (a mix works out its songs from its rules). */
export function playlistTrackIds(p: Playlist, state: LibraryState = library.get()): string[] {
  if (p.kind === 'mix' && p.rules) {
    const artists = new Set(p.rules.artists);
    const genres = new Set(p.rules.genres.map((g) => g.toLowerCase()));
    return state.tracks
      .filter((t) => !t.missing && (artists.has(artistKey(t.artist)) || genres.has(t.genre.toLowerCase())))
      .map((t) => t.id);
  }
  return p.trackIds.filter((id) => state.byId.has(id));
}

/** Up to four picture ids for the playlist's collage cover. */
export function playlistArtIds(p: Playlist, state: LibraryState = library.get()): string[] {
  const ids: string[] = [];
  for (const id of playlistTrackIds(p, state)) {
    const art = state.byId.get(id)?.artId;
    if (art && !ids.includes(art)) ids.push(art);
    if (ids.length === 4) break;
  }
  return ids;
}

// ---------- lyrics ----------

export async function getLyrics(trackId: string): Promise<LyricsRec | undefined> {
  return db.get<LyricsRec>('lyrics', trackId);
}

export async function saveLyrics(trackId: string, text: string, source: LyricsRec['source'] = 'manual'): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return deleteLyrics(trackId);
  const rec: LyricsRec = { trackId, text: trimmed, synced: parseLyrics(trimmed).synced, source };
  await db.put('lyrics', rec);
  updateTrack(trackId, { hasLyrics: true });
}

export async function deleteLyrics(trackId: string): Promise<void> {
  await db.delete('lyrics', trackId);
  updateTrack(trackId, { hasLyrics: false });
}

// ---------- reading ----------

export function trackById(id: string): Track | undefined {
  return library.get().byId.get(id);
}

export function artistNameKey(name: string): string {
  return artistKey(primaryArtist(name));
}
