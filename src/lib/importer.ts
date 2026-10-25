// Bringing songs in from the Files app: check, read tags, save.
// Songs are copied INTO the app's own storage, so they keep working even if
// the original file is moved or deleted.

import { addTrackRecord, library } from '../store/library';
import { isQuotaError, requestPersistence } from './db';
import { fileFingerprint } from './hash';
import { guessFromFileName, mimeFor, readTags } from './tags';
import { processArtwork } from './artwork';
import { parseLyrics } from './lyrics';
import type { LyricsRec, Track } from '../types';

export type ImportStatus = 'queued' | 'working' | 'done' | 'duplicate' | 'failed';

export interface ImportItem {
  id: number;
  name: string;
  size: number;
  status: ImportStatus;
  message?: string;
}

export interface ImportSummary {
  added: number;
  duplicates: number;
  failed: number;
  stoppedForSpace: boolean;
}

const AUDIO_EXTENSIONS = /\.(mp3|m4a|m4b|mp4|aac|wav|wave|flac|caf|ogg|oga|opus|aif|aiff)$/i;

export function looksLikeAudio(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name);
}

/** Asks the browser to load the file. Gives us the real duration and tells us if it can be played. */
export function probeAudio(blob: Blob, timeoutMs = 12000): Promise<{ ok: boolean; duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let done = false;
    const finish = (ok: boolean, duration: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve({ ok, duration });
    };
    const timer = window.setTimeout(() => finish(false, 0), timeoutMs);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(true, isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => finish(false, 0);
    audio.src = url;
  });
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function importFiles(
  files: File[],
  onUpdate: (items: ImportItem[]) => void,
  options: { sample?: boolean } = {},
): Promise<ImportSummary> {
  const items: ImportItem[] = files.map((f, i) => ({ id: i, name: f.name, size: f.size, status: 'queued' as const }));
  const summary: ImportSummary = { added: 0, duplicates: 0, failed: 0, stoppedForSpace: false };
  const push = () => onUpdate(items.map((i) => ({ ...i })));
  const set = (i: number, patch: Partial<ImportItem>) => {
    Object.assign(items[i], patch);
    push();
  };
  push();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (summary.stoppedForSpace) {
      set(i, { status: 'failed', message: 'Skipped: storage is full.' });
      summary.failed++;
      continue;
    }
    set(i, { status: 'working' });
    await tick();
    try {
      if (!looksLikeAudio(file)) {
        set(i, { status: 'failed', message: 'This is not an audio file.' });
        summary.failed++;
        continue;
      }
      if (file.size === 0) {
        set(i, { status: 'failed', message: 'The file is empty (0 bytes). Try downloading it again.' });
        summary.failed++;
        continue;
      }

      const fingerprint = await fileFingerprint(file);
      const id = `trk-${fingerprint}`;
      if (library.get().byId.has(id)) {
        set(i, { status: 'duplicate', message: 'Already in your library.' });
        summary.duplicates++;
        continue;
      }

      const { kind, tags } = await readTags(file);
      const mime = mimeFor(file.name, kind, file.type);
      const blob = file.slice(0, file.size, mime);

      const probe = await probeAudio(blob);
      if (!probe.ok) {
        set(i, {
          status: 'failed',
          message: 'This iPhone cannot play this file. It may be damaged or in an unsupported format. MP3, M4A, AAC and WAV work best.',
        });
        summary.failed++;
        continue;
      }

      const guess = guessFromFileName(file.name);
      const title = tags.title?.trim() || guess.title;
      const artist = tags.artist?.trim() || guess.artist || 'Unknown Artist';
      const album = tags.album?.trim() || 'Unknown Album';
      const duration = probe.duration || tags.duration || 0;

      // Same song under another file name? Skip it.
      const twin = library
        .get()
        .tracks.find(
          (t) => t.title.toLowerCase() === title.toLowerCase() && t.artist.toLowerCase() === artist.toLowerCase() &&
            t.album.toLowerCase() === album.toLowerCase() && Math.abs(t.duration - duration) < 1,
        );
      if (twin) {
        set(i, { status: 'duplicate', message: 'The same song is already in your library.' });
        summary.duplicates++;
        continue;
      }

      let artwork = null;
      if (tags.picture) artwork = await processArtwork(tags.picture.data, tags.picture.mime);

      let lyrics: LyricsRec | null = null;
      if (tags.lyrics) lyrics = { trackId: id, text: tags.lyrics, synced: parseLyrics(tags.lyrics).synced, source: 'embedded' };

      const track: Track = {
        id,
        title,
        artist,
        album,
        albumArtist: tags.albumArtist?.trim() || '',
        genre: tags.genre?.trim() || '',
        trackNo: tags.trackNo || guess.trackNo || 0,
        discNo: tags.discNo || 0,
        year: tags.year || 0,
        duration,
        size: file.size,
        mime,
        fileName: file.name,
        addedAt: Date.now() + i, // keeps the order of a batch
        playCount: 0,
        lastPlayedAt: 0,
        favorite: false,
        artId: artwork?.id,
        hasLyrics: !!lyrics,
        sample: options.sample || undefined,
      };
      await addTrackRecord(track, blob, artwork, lyrics);
      set(i, { status: 'done' });
      summary.added++;
      if (summary.added === 1) void requestPersistence();
    } catch (e) {
      if (isQuotaError(e)) {
        summary.stoppedForSpace = true;
        set(i, { status: 'failed', message: 'Not enough storage space on this iPhone. Free some space, or remove songs you no longer need.' });
      } else {
        console.error(e);
        set(i, { status: 'failed', message: 'This file could not be saved. Please try again.' });
      }
      summary.failed++;
    }
  }
  return summary;
}
