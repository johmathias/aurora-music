// Shared data types for Aurora Music.
// Albums, artists and genres are NOT stored: they are worked out from the tracks.

export interface Track {
  id: string; // stable id made from the file contents (see lib/hash.ts)
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  trackNo: number; // 0 = unknown
  discNo: number; // 0 = unknown
  year: number; // 0 = unknown
  duration: number; // seconds
  size: number; // bytes of the stored audio file
  mime: string;
  fileName: string;
  addedAt: number; // ms since 1970
  playCount: number;
  lastPlayedAt: number; // 0 = never
  favorite: boolean;
  artId?: string; // link to an ArtworkRec
  hasLyrics: boolean;
  sample?: boolean; // true for the generated sample tracks
  missing?: boolean; // set when the audio file could not be found on this device
}

export interface ArtworkRec {
  id: string;
  full: Blob; // up to 700px, used on Now Playing
  thumb: Blob; // up to 360px, used in lists and grids
  colors: string[]; // up to 4 colours picked from the picture
}

export interface MixRules {
  artists: string[];
  genres: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  kind: 'manual' | 'mix'; // a "mix" fills itself from rules, a manual playlist holds a list
  trackIds: string[]; // order is the playlist order
  rules?: MixRules;
  coverArtId?: string; // user chosen cover (an ArtworkRec id)
  coverSeed: number; // used for the generated cover
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt: number;
}

export interface LyricsRec {
  trackId: string;
  text: string;
  synced: boolean;
  source: 'embedded' | 'manual' | 'imported' | 'sample';
}

export interface HistoryEntry {
  id?: number;
  trackId: string;
  at: number;
}

export interface LyricLine {
  time: number; // seconds, -1 when the lyrics are not synchronised
  text: string;
}

// ----- derived collections -----
export interface Album {
  key: string;
  title: string;
  artist: string;
  trackIds: string[];
  artId?: string;
  year: number;
  genre: string;
  addedAt: number;
  playCount: number;
  lastPlayedAt: number;
  duration: number;
}

export interface Artist {
  key: string;
  name: string;
  trackIds: string[];
  albumKeys: string[];
  artId?: string;
  ownArtId?: string; // a picture the user picked for this artist
  playCount: number;
  duration: number;
}

export interface Genre {
  name: string;
  trackIds: string[];
  artId?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueItem {
  uid: string; // unique per queue entry, so the same song can appear twice
  trackId: string;
}

export interface Preferences {
  appearance: 'system' | 'dark' | 'light';
  lyricsBackground: boolean;
  volume: number;
}
