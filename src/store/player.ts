// The audio engine: one <audio> element, a queue, shuffle/repeat, saved position,
// lock-screen controls. Screens never touch the <audio> element directly.

import { getAudioBlob, kvGet, kvSet } from '../lib/db';
import { shuffled, uid } from '../lib/format';
import { artworkUrl } from '../lib/artwork';
import { library, onTracksRemoved, recordPlayCounted, recordPlayStart, trackById, updateTrack, useLibrary } from './library';
import { createStore, useStore } from './createStore';
import { showToast, toastError } from './ui';
import type { QueueItem, RepeatMode, Track } from '../types';

// ---------- state ----------

export interface PlayerState {
  queue: QueueItem[]; // the order songs will play in
  base: QueueItem[]; // the order before shuffle (equal to queue when shuffle is off)
  index: number; // position in queue, -1 when nothing is loaded
  playing: boolean;
  loading: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  canSetVolume: boolean;
  volume: number;
  airplay: 'unsupported' | 'available' | 'unavailable';
}

export const player = createStore<PlayerState>({
  queue: [],
  base: [],
  index: -1,
  playing: false,
  loading: false,
  shuffle: false,
  repeat: 'off',
  canSetVolume: false,
  volume: 1,
  airplay: 'unsupported',
});

export const usePlayer = <S,>(selector: (s: PlayerState) => S) => useStore(player, selector);

/** Whole seconds only, so labels re-render once a second, not on every tick. */
export const time = createStore({ second: 0, duration: 0 });
export const usePlaybackSecond = () => useStore(time, (t) => t.second);
export const usePlaybackDuration = () => useStore(time, (t) => t.duration);

// ---------- the one audio element ----------

const audio = new Audio();
audio.preload = 'auto';
audio.setAttribute('playsinline', '');
audio.setAttribute('x-webkit-airplay', 'allow');

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
const isSilent = () => audio.src.startsWith('data:audio/wav');

let loadToken = 0; // lets us ignore a load that was replaced by a newer one
let loadedUid: string | null = null; // which queue entry is inside the audio element
let currentUrl: string | null = null;
let prefetched: { trackId: string; url: string } | null = null;
let pendingSeek = 0;
let startRecorded = false;
let playCounted = false;
let lastSave = 0;
let failures = 0;

export const getPosition = () => audio.currentTime || 0;
export const getDuration = () => {
  if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const t = currentTrack();
  return t?.duration ?? 0;
};
export const isPlaying = () => !audio.paused;

export function currentItem(): QueueItem | undefined {
  const { queue, index } = player.get();
  return queue[index];
}
export function currentTrack(): Track | undefined {
  const item = currentItem();
  return item ? trackById(item.trackId) : undefined;
}

/**
 * iPhone Safari only lets an <audio> element start playing after a tap.
 * Playing a silent clip on the first tap "unlocks" it for the whole session.
 */
export function unlockAudio(): void {
  if (audio.src) return;
  audio.src = SILENT_WAV;
  audio
    .play()
    .then(() => {
      if (isSilent()) audio.pause();
    })
    .catch(() => {
      if (isSilent()) audio.removeAttribute('src');
    });
}

// ---------- loading & playing ----------

function setSource(url: string) {
  const old = currentUrl;
  currentUrl = url;
  audio.src = url;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 4000);
}

function describeAudioError(): string {
  const code = audio.error?.code;
  if (code === 3) return 'This file looks damaged.';
  if (code === 4) return 'This format is not supported on this device.';
  return 'The song could not be played.';
}

function playIndex(index: number, startAt = 0): void {
  const state = player.get();
  const item = state.queue[index];
  if (!item) return;
  const token = ++loadToken;
  player.set({ index, loading: true, playing: true });
  pendingSeek = startAt;
  startRecorded = false;
  playCounted = false;
  time.set({ second: Math.floor(startAt), duration: trackById(item.trackId)?.duration ?? 0 });
  updateMediaSession();

  const start = (url: string) => {
    if (token !== loadToken) {
      URL.revokeObjectURL(url);
      return;
    }
    loadedUid = item.uid;
    setSource(url);
    attemptPlay();
  };

  // Fast path: the next song was already prepared, so we can start inside the same tap/event.
  if (prefetched && prefetched.trackId === item.trackId) {
    const url = prefetched.url;
    prefetched = null;
    start(url);
    return;
  }
  getAudioBlob(item.trackId)
    .then((blob) => {
      if (token !== loadToken) return;
      if (!blob) throw new Error('missing');
      start(URL.createObjectURL(blob));
    })
    .catch(() => {
      if (token !== loadToken) return;
      const track = trackById(item.trackId);
      if (track) updateTrack(track.id, { missing: true });
      handleUnplayable(`“${track?.title ?? 'This song'}” is no longer stored on this device. You can remove it from your library in Settings.`);
    });
}

function attemptPlay() {
  audio
    .play()
    .then(() => {
      failures = 0;
    })
    .catch((e: unknown) => {
      const name = (e as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        // iPhone wants a tap first. The song is loaded; the next tap on Play starts it.
        player.set({ playing: false, loading: false });
        showToast('Tap Play to start the song.');
      } else if (name !== 'AbortError') {
        handleUnplayable(describeAudioError());
      }
    });
}

function handleUnplayable(message: string) {
  failures++;
  const { queue, index } = player.get();
  if (failures >= 3 || queue.length <= 1) {
    toastError(message);
    player.set({ playing: false, loading: false });
    failures = 0;
    return;
  }
  toastError(`${message} Skipping to the next song.`);
  window.setTimeout(() => advance(true), 700);
  void index;
}

function nextIndex(auto: boolean): number | null {
  const { queue, index, repeat } = player.get();
  if (!queue.length) return null;
  if (auto && repeat === 'one') return index;
  const n = index + 1;
  if (n < queue.length) return n;
  return repeat === 'all' ? 0 : null;
}

function advance(auto: boolean) {
  const n = nextIndex(auto);
  if (n === null) {
    // Reached the end of the queue with repeat off: stop on the last song.
    audio.pause();
    seekTo(0);
    player.set({ playing: false, loading: false });
    saveNow();
    return;
  }
  if (auto && n === player.get().index && player.get().repeat === 'one') {
    audio.currentTime = 0;
    playCounted = false;
    attemptPlay();
    return;
  }
  playIndex(n);
}

/** Gets the next song ready while the current one plays, so changing songs is instant. */
async function prefetchNext() {
  const n = nextIndex(false);
  const { queue, index } = player.get();
  if (n === null || n === index) return;
  const item = queue[n];
  if (!item || prefetched?.trackId === item.trackId) return;
  try {
    const blob = await getAudioBlob(item.trackId);
    if (!blob) return;
    // still the right song to prepare?
    const stillNext = nextIndex(false);
    if (stillNext === null || player.get().queue[stillNext]?.trackId !== item.trackId) return;
    if (prefetched) URL.revokeObjectURL(prefetched.url);
    prefetched = { trackId: item.trackId, url: URL.createObjectURL(blob) };
  } catch {
    /* preparing ahead is only an optimisation */
  }
}

// ---------- audio element events ----------

audio.addEventListener('play', () => {
  if (isSilent()) return;
  player.set({ playing: true });
  syncMediaState();
});
audio.addEventListener('pause', () => {
  if (isSilent() || audio.ended) return;
  // A real pause (button, headphones, phone call). Not a song change.
  player.set({ playing: false, loading: false });
  syncMediaState();
  saveNow();
});
audio.addEventListener('playing', () => {
  if (isSilent()) return;
  player.set({ playing: true, loading: false });
  const track = currentTrack();
  if (track && !startRecorded) {
    startRecorded = true;
    recordPlayStart(track.id);
    void prefetchNext();
    saveNow();
  }
});
audio.addEventListener('waiting', () => {
  if (!isSilent() && !audio.paused) player.set({ loading: true });
});
audio.addEventListener('loadedmetadata', () => {
  if (isSilent()) return;
  if (pendingSeek > 0 && isFinite(audio.duration)) {
    audio.currentTime = Math.min(pendingSeek, Math.max(0, audio.duration - 0.5));
    pendingSeek = 0;
  }
  time.set({ duration: getDuration() });
  updatePositionState();
});
audio.addEventListener('durationchange', () => {
  if (!isSilent()) time.set({ duration: getDuration() });
});
audio.addEventListener('timeupdate', () => {
  if (isSilent()) return;
  const sec = Math.floor(audio.currentTime);
  if (sec !== time.get().second) time.set({ second: sec });
  const track = currentTrack();
  if (track && !playCounted && audio.currentTime >= Math.min(30, (getDuration() || 60) * 0.5)) {
    playCounted = true;
    recordPlayCounted(track.id);
  }
  const now = Date.now();
  if (now - lastSave > 5000) saveNow();
});
audio.addEventListener('ended', () => {
  if (isSilent()) return;
  advance(true);
});
audio.addEventListener('error', () => {
  if (isSilent() || !audio.src) return;
  handleUnplayable(describeAudioError());
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
  else {
    // coming back to the app: make sure the buttons match reality
    if (!isSilent() && currentItem()) player.set({ playing: !audio.paused });
    time.set({ second: Math.floor(audio.currentTime) });
  }
});
window.addEventListener('pagehide', saveNow);

// ---------- commands ----------

export function playTracks(ids: string[], startIndex = 0, opts: { shuffle?: boolean } = {}): void {
  const state = library.get();
  const startId = ids[startIndex];
  const playable = ids.filter((id) => {
    const t = state.byId.get(id);
    return t && !t.missing;
  });
  if (!playable.length) {
    toastError('There is nothing playable here yet.');
    return;
  }
  unlockAudio();
  const shuffleOn = opts.shuffle ?? player.get().shuffle;
  const items: QueueItem[] = playable.map((trackId) => ({ uid: uid('q'), trackId }));
  let first = Math.max(0, playable.indexOf(startId));
  if (shuffleOn && opts.shuffle === true && startId === undefined) first = Math.floor(Math.random() * items.length);
  if (shuffleOn) {
    const current = items[first];
    const rest = shuffled(items.filter((_, i) => i !== first));
    player.set({ queue: [current, ...rest], base: items, shuffle: true });
    playIndex(0);
  } else {
    player.set({ queue: items, base: items, shuffle: false });
    playIndex(first);
  }
}

export function toggle(): void {
  const { index } = player.get();
  if (index < 0) return;
  unlockAudio();
  const item = currentItem();
  if (!item) return;
  if (loadedUid !== item.uid || !audio.src || isSilent()) {
    playIndex(index, pendingSeek);
    return;
  }
  if (audio.paused) {
    player.set({ playing: true });
    attemptPlay();
  } else audio.pause();
}

export function next(): void {
  if (!player.get().queue.length) return;
  advance(false);
}

export function previous(): void {
  const { queue, index, repeat } = player.get();
  if (!queue.length) return;
  // More than 3 seconds in: restart this song. Otherwise go to the one before.
  if (audio.currentTime > 3 || (index === 0 && repeat !== 'all')) {
    seekTo(0);
    return;
  }
  playIndex(index === 0 ? queue.length - 1 : index - 1);
}

export function seekTo(seconds: number): void {
  const duration = getDuration();
  const clamped = Math.max(0, duration ? Math.min(seconds, duration - 0.05) : seconds);
  if (loadedUid !== currentItem()?.uid) {
    pendingSeek = clamped; // not loaded yet: apply when it loads
  } else {
    audio.currentTime = clamped;
  }
  time.set({ second: Math.floor(clamped) });
  updatePositionState();
}

export function setShuffle(on: boolean): void {
  const { queue, base, index } = player.get();
  if (on === player.get().shuffle) return;
  if (index < 0 || !queue.length) {
    player.set({ shuffle: on });
    return;
  }
  const current = queue[index];
  if (on) {
    const rest = shuffled(queue.filter((q) => q.uid !== current.uid));
    player.set({ shuffle: true, base: queue.slice(), queue: [current, ...rest], index: 0 });
  } else {
    const present = new Set(queue.map((q) => q.uid));
    const restored = base.filter((q) => present.has(q.uid));
    for (const q of queue) if (!restored.includes(q)) restored.push(q);
    player.set({ shuffle: false, queue: restored, base: restored, index: Math.max(0, restored.findIndex((q) => q.uid === current.uid)) });
  }
  void prefetchNext();
  saveSoon();
}

export function cycleRepeat(): void {
  const order: RepeatMode[] = ['off', 'all', 'one'];
  const nextMode = order[(order.indexOf(player.get().repeat) + 1) % 3];
  player.set({ repeat: nextMode });
  void prefetchNext();
  saveSoon();
}

export function jumpTo(index: number): void {
  if (index >= 0 && index < player.get().queue.length) playIndex(index);
}

const makeItems = (ids: string[]): QueueItem[] =>
  ids.filter((id) => library.get().byId.has(id)).map((trackId) => ({ uid: uid('q'), trackId }));

/** "Play Next": insert right after the current song. */
export function playNext(ids: string[]): void {
  const items = makeItems(ids);
  if (!items.length) return;
  const { queue, base, index } = player.get();
  if (index < 0) return playTracks(ids);
  const q = queue.slice();
  q.splice(index + 1, 0, ...items);
  const b = base.slice();
  const currentInBase = b.findIndex((x) => x.uid === queue[index].uid);
  b.splice(currentInBase + 1, 0, ...items);
  player.set({ queue: q, base: b });
  void prefetchNext();
  saveSoon();
  showToast(items.length === 1 ? 'Playing next' : `${items.length} songs will play next`, 'success');
}

/** "Add to Queue": at the very end. */
export function addToQueue(ids: string[]): void {
  const items = makeItems(ids);
  if (!items.length) return;
  const { queue, base, index } = player.get();
  if (index < 0) return playTracks(ids);
  player.set({ queue: [...queue, ...items], base: [...base, ...items] });
  void prefetchNext();
  saveSoon();
  showToast(items.length === 1 ? 'Added to queue' : `${items.length} songs added to queue`, 'success');
}

export function removeFromQueue(queueUid: string): void {
  const { queue, base, index } = player.get();
  const at = queue.findIndex((q) => q.uid === queueUid);
  if (at < 0) return;
  if (at === index) {
    // removing the song that is playing: move on
    const rest = queue.filter((q) => q.uid !== queueUid);
    player.set({ queue: rest, base: base.filter((q) => q.uid !== queueUid) });
    if (!rest.length) return clearQueue();
    playIndex(Math.min(at, rest.length - 1));
    return;
  }
  player.set({
    queue: queue.filter((q) => q.uid !== queueUid),
    base: base.filter((q) => q.uid !== queueUid),
    index: at < index ? index - 1 : index,
  });
  void prefetchNext();
  saveSoon();
}

export function moveInQueue(from: number, to: number): void {
  const { queue, index } = player.get();
  if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
  const currentUid = queue[index]?.uid;
  const q = queue.slice();
  const [item] = q.splice(from, 1);
  q.splice(to, 0, item);
  player.set({ queue: q, index: Math.max(0, q.findIndex((x) => x.uid === currentUid)) });
  prefetched && (URL.revokeObjectURL(prefetched.url), (prefetched = null));
  void prefetchNext();
  saveSoon();
}

export function clearUpNext(): void {
  const { queue, base, index } = player.get();
  if (index < 0) return;
  const keep = queue.slice(0, index + 1);
  const keepIds = new Set(keep.map((q) => q.uid));
  player.set({ queue: keep, base: base.filter((q) => keepIds.has(q.uid)) });
  saveSoon();
}

export function clearQueue(): void {
  loadToken++;
  audio.pause();
  audio.removeAttribute('src');
  loadedUid = null;
  player.set({ queue: [], base: [], index: -1, playing: false, loading: false });
  time.set({ second: 0, duration: 0 });
  void kvSet('playback', null);
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

// ---------- volume & AirPlay ----------

type AirPlayAudio = HTMLAudioElement & { webkitShowPlaybackTargetPicker?: () => void };

export function setVolume(value: number): void {
  const v = Math.min(1, Math.max(0, value));
  if (player.get().canSetVolume) audio.volume = v;
  player.set({ volume: v });
}

export function showAirPlayPicker(): void {
  (audio as AirPlayAudio).webkitShowPlaybackTargetPicker?.();
}

(function detectOutputs() {
  try {
    const probe = new Audio();
    probe.volume = 0.37;
    player.set({ canSetVolume: Math.abs(probe.volume - 0.37) < 0.01 }); // false on iPhone
  } catch {
    /* leave false */
  }
  if (typeof (audio as AirPlayAudio).webkitShowPlaybackTargetPicker === 'function') {
    player.set({ airplay: 'unavailable' });
    audio.addEventListener('webkitplaybacktargetavailabilitychanged', (e) => {
      const availability = (e as Event & { availability?: string }).availability;
      player.set({ airplay: availability === 'available' ? 'available' : 'unavailable' });
    });
  }
})();

// ---------- lock screen / headphones (Media Session) ----------

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const track = currentTrack();
  if (!track) return;
  const base = { title: track.title, artist: track.artist, album: track.album };
  navigator.mediaSession.metadata = new MediaMetadata(base);
  if (track.artId) {
    const wanted = track.id;
    void artworkUrl(track.artId, 'full').then((url) => {
      if (url && currentTrack()?.id === wanted) {
        navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: [{ src: url, sizes: '700x700', type: 'image/jpeg' }] });
      }
    });
  }
}

function syncMediaState() {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const duration = getDuration();
  if (!duration || !isFinite(duration)) return;
  try {
    navigator.mediaSession.setPositionState({ duration, position: Math.min(audio.currentTime, duration), playbackRate: audio.playbackRate || 1 });
  } catch {
    /* some browsers are picky about the values */
  }
}

function registerMediaHandlers() {
  if (!('mediaSession' in navigator)) return;
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* action not supported here */
    }
  };
  set('play', () => toggle());
  set('pause', () => audio.pause());
  set('previoustrack', () => previous());
  set('nexttrack', () => next());
  set('seekto', (d) => d.seekTime !== undefined && seekTo(d.seekTime));
  set('seekbackward', (d) => seekTo(getPosition() - (d.seekOffset ?? 10)));
  set('seekforward', (d) => seekTo(getPosition() + (d.seekOffset ?? 10)));
}

// Keep the lock screen position fresh, about once a second.
setInterval(() => {
  if (!audio.paused && !isSilent()) updatePositionState();
}, 2000);

// ---------- remember where we were ----------

interface SavedPlayback {
  ids: string[];
  baseIds: string[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

let saveTimer: number | undefined;
function saveSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 400);
}

function saveNow() {
  lastSave = Date.now();
  const { queue, base, index, shuffle, repeat } = player.get();
  if (!queue.length || index < 0) return;
  const payload: SavedPlayback = {
    ids: queue.map((q) => q.trackId),
    baseIds: base.map((q) => q.trackId),
    index,
    position: loadedUid === queue[index]?.uid ? audio.currentTime : pendingSeek,
    shuffle,
    repeat,
  };
  void kvSet('playback', payload);
  void kvSet('volume', player.get().volume);
}

export async function restorePlayback(): Promise<void> {
  registerMediaHandlers();
  const volume = await kvGet<number>('volume', 1);
  setVolume(volume);
  const saved = await kvGet<SavedPlayback | null>('playback', null);
  if (!saved || !saved.ids?.length) return;
  const { byId } = library.get();
  const alive = (id: string) => byId.has(id);
  const items = saved.ids.map((trackId, i) => ({ trackId, i })).filter((x) => alive(x.trackId));
  if (!items.length) return;
  const queue: QueueItem[] = items.map((x) => ({ uid: uid('q'), trackId: x.trackId }));
  // find where the saved current song ended up after removing missing ones
  let index = items.findIndex((x) => x.i >= saved.index);
  if (index < 0) index = items.length - 1;
  const exact = items.some((x) => x.i === saved.index);
  const baseItems = (saved.baseIds ?? saved.ids).filter(alive).map((trackId) => ({ uid: uid('q'), trackId }));
  // base and queue must share the same item objects (matched by uid), so rebuild base from queue
  const base = saved.shuffle
    ? baseItems.map((b) => queue.find((q) => q.trackId === b.trackId) ?? b)
    : queue;
  pendingSeek = exact ? saved.position || 0 : 0;
  player.set({ queue, base: base.length ? base : queue, index, shuffle: !!saved.shuffle, repeat: saved.repeat ?? 'off', playing: false });
  time.set({ second: Math.floor(pendingSeek), duration: trackById(queue[index].trackId)?.duration ?? 0 });
  updateMediaSession();
}

// When songs are deleted from the library, take them out of the queue too.
onTracksRemoved((ids) => {
  const everything = ids.includes('*');
  const gone = new Set(ids);
  const { queue, base, index } = player.get();
  if (everything) return clearQueue();
  const current = queue[index];
  const nextQueue = queue.filter((q) => !gone.has(q.trackId));
  if (nextQueue.length === queue.length) return;
  if (!nextQueue.length) return clearQueue();
  const nextBase = base.filter((q) => !gone.has(q.trackId));
  if (current && gone.has(current.trackId)) {
    const wasPlaying = !audio.paused;
    const at = Math.min(index - queue.slice(0, index).filter((q) => gone.has(q.trackId)).length, nextQueue.length - 1);
    player.set({ queue: nextQueue, base: nextBase });
    if (wasPlaying) playIndex(Math.max(0, at));
    else {
      audio.pause();
      loadedUid = null;
      player.set({ index: Math.max(0, at), playing: false });
    }
  } else {
    player.set({ queue: nextQueue, base: nextBase, index: Math.max(0, nextQueue.findIndex((q) => q.uid === current?.uid)) });
  }
  saveSoon();
});

// ---------- hooks for screens ----------

export function useCurrentTrack(): Track | undefined {
  const id = usePlayer((s) => s.queue[s.index]?.trackId);
  return useLibrary((s) => (id ? s.byId.get(id) : undefined));
}

export function useIsCurrent(trackId: string): boolean {
  return usePlayer((s) => s.queue[s.index]?.trackId === trackId);
}

export function useIsPlayingTrack(trackId: string): boolean {
  return usePlayer((s) => s.playing && s.queue[s.index]?.trackId === trackId);
}
