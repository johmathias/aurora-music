// Things the user can do with songs, albums and playlists, in one place.
// Screens call these so the menus behave the same everywhere.

import { addToQueue, playNext, playTracks } from './store/player';
import {
  deletePlaylist, library, markPlaylistPlayed, playlistTrackIds, removeFromPlaylist, removeTracks, setFavorite, toggleFavorite, updatePlaylist,
} from './store/library';
import { confirmDialog, nav, openMenu, sheets, showToast, type MenuItem } from './store/ui';
import { artistKey, trackAlbumKey } from './lib/indexing';
import { plural } from './lib/format';
import type { Album, Playlist, Track } from './types';

/** Play a list. `shuffle: true` also turns shuffle on, `false` plays in order. */
export function playList(ids: string[], opts: { shuffle?: boolean; from?: number } = {}): void {
  if (!ids.length) return;
  if (opts.shuffle) playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true });
  else playTracks(ids, opts.from ?? 0, { shuffle: false });
}

export function playPlaylist(p: Playlist, shuffle = false): void {
  const ids = playlistTrackIds(p);
  if (!ids.length) {
    showToast('Add some songs to this playlist first.');
    return;
  }
  markPlaylistPlayed(p.id);
  playList(ids, { shuffle });
}

/** Open a screen after closing anything floating above it. */
export function goTo(route: Parameters<typeof nav.push>[0]): void {
  sheets.closeAll();
  nav.push(route);
}

export async function removeFromLibrary(ids: string[]): Promise<boolean> {
  const first = library.get().byId.get(ids[0]);
  const ok = await confirmDialog({
    title: ids.length === 1 ? 'Remove this song?' : `Remove ${ids.length} songs?`,
    message:
      (ids.length === 1 && first ? `“${first.title}” will be removed from Aurora Music's storage on this device. ` : 'These songs will be removed from Aurora Music\'s storage on this device. ') +
      'The original files in the Files app are not deleted. Playlists keep working without them.',
    confirmLabel: 'Remove',
    destructive: true,
  });
  if (!ok) return false;
  await removeTracks(ids);
  showToast(ids.length === 1 ? 'Song removed' : `${plural(ids.length, 'song')} removed`, 'success');
  return true;
}

export function openTrackMenu(track: Track, ctx: { playlistId?: string; position?: number } = {}): void {
  const items: MenuItem[] = [
    { label: 'Play Next', icon: 'play-next', onSelect: () => playNext([track.id]) },
    { label: 'Play Last', icon: 'add-queue', onSelect: () => addToQueue([track.id]) },
    { label: 'Add to Playlist…', icon: 'add-playlist', onSelect: () => sheets.open({ type: 'addToPlaylist', trackIds: [track.id] }) },
    {
      label: track.favorite ? 'Remove from Favorites' : 'Favorite',
      icon: track.favorite ? 'heart-fill' : 'heart',
      onSelect: () => toggleFavorite(track.id),
    },
    { label: 'Go to Album', icon: 'album', onSelect: () => goTo({ kind: 'album', key: trackAlbumKey(track) }) },
    { label: 'Go to Artist', icon: 'person', onSelect: () => goTo({ kind: 'artist', key: artistKey(track.artist) }) },
    { label: 'Edit Info & Artwork…', icon: 'edit', onSelect: () => sheets.open({ type: 'editTrack', trackId: track.id }) },
    { label: 'Song Info', icon: 'info', onSelect: () => sheets.open({ type: 'trackInfo', trackId: track.id }) },
  ];
  if (ctx.playlistId !== undefined && ctx.position !== undefined) {
    const { playlistId, position } = ctx;
    items.push({ label: 'Remove from Playlist', icon: 'minus-circle', destructive: true, onSelect: () => removeFromPlaylist(playlistId, position) });
  }
  items.push({ label: 'Remove from Library', icon: 'trash', destructive: true, onSelect: () => void removeFromLibrary([track.id]) });
  openMenu({ title: track.title, subtitle: track.artist, items });
}

export function openAlbumMenu(album: Album): void {
  openMenu({
    title: album.title,
    subtitle: album.artist,
    items: [
      { label: 'Play Next', icon: 'play-next', onSelect: () => playNext(album.trackIds) },
      { label: 'Play Last', icon: 'add-queue', onSelect: () => addToQueue(album.trackIds) },
      { label: 'Add to Playlist…', icon: 'add-playlist', onSelect: () => sheets.open({ type: 'addToPlaylist', trackIds: album.trackIds }) },
      { label: 'Change Artwork…', icon: 'photo', onSelect: () => sheets.open({ type: 'editTrack', trackId: album.trackIds[0] }) },
      { label: 'Go to Artist', icon: 'person', onSelect: () => goTo({ kind: 'artist', key: artistKey(album.artist) }) },
      { label: 'Remove Album from Library', icon: 'trash', destructive: true, onSelect: () => void removeFromLibrary(album.trackIds) },
    ],
  });
}

export function openPlaylistMenu(p: Playlist, after?: () => void): void {
  const ids = playlistTrackIds(p);
  const isMix = p.kind === 'mix';
  openMenu({
    title: p.name,
    subtitle: isMix ? 'Mix' : plural(ids.length, 'song'),
    items: [
      { label: 'Play', icon: 'play', disabled: !ids.length, onSelect: () => playPlaylist(p) },
      { label: 'Shuffle', icon: 'shuffle', disabled: !ids.length, onSelect: () => playPlaylist(p, true) },
      { label: 'Play Next', icon: 'play-next', disabled: !ids.length, onSelect: () => playNext(ids) },
      { label: 'Play Last', icon: 'add-queue', disabled: !ids.length, onSelect: () => addToQueue(ids) },
      {
        label: p.favorite ? 'Remove from Favorites' : 'Favorite',
        icon: p.favorite ? 'heart-fill' : 'heart',
        onSelect: () => updatePlaylist(p.id, { favorite: !p.favorite }),
      },
      { label: isMix ? 'Edit Mix' : 'Edit Playlist', icon: 'edit', onSelect: () => sheets.open(isMix ? { type: 'mixEditor', id: p.id } : { type: 'playlistEditor', id: p.id }) },
      { label: isMix ? 'Delete Mix' : 'Delete Playlist', icon: 'trash', destructive: true, onSelect: () => void removePlaylist(p, after) },
    ],
  });
}

export async function removePlaylist(p: Playlist, after?: () => void): Promise<void> {
  const ok = await confirmDialog({
    title: `Delete “${p.name}”?`,
    message: 'Your songs stay in your library. Only this ' + (p.kind === 'mix' ? 'mix' : 'playlist') + ' is deleted.',
    confirmLabel: 'Delete',
    destructive: true,
  });
  if (!ok) return;
  await deletePlaylist(p.id);
  showToast(`“${p.name}” deleted`, 'success');
  after?.();
}

/** Favorite or unfavorite many songs at once; the first tap favorites, if all are already favorites it removes. */
export function favoriteMany(ids: string[]): void {
  const { byId } = library.get();
  const allFav = ids.every((id) => byId.get(id)?.favorite);
  setFavorite(ids, !allFav);
  showToast(allFav ? 'Removed from Favorites' : 'Added to Favorites', 'success');
}
