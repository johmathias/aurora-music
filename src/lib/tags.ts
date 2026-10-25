// Reads song information (title, artist, album, cover picture, lyrics ...)
// straight from the audio file. No internet and no libraries needed.
//
// Supported: MP3 (ID3v2 and ID3v1), M4A/MP4/AAC-in-MP4, FLAC.
// Anything else (WAV, etc.) falls back to the file name.

export interface ParsedTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  duration?: number;
  picture?: { data: Uint8Array; mime: string };
  lyrics?: string;
}

const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal',
  'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial',
  'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk',
  'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'Alternative Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic',
  'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta',
  'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave', 'Psychedelic', 'Rave', 'Showtunes',
  'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock',
];

// ---------- small byte helpers ----------

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function u32le(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
function u16(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function synchsafe(b: Uint8Array, o: number): number {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}
function ascii(b: Uint8Array, o: number, n: number): string {
  let s = '';
  for (let i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
  return s;
}
async function readRange(blob: Blob, start: number, length: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    let text: string;
    if (encoding === 1) {
      // UTF-16 with a byte-order mark
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
      else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
      else text = new TextDecoder('utf-16le').decode(bytes);
    } else if (encoding === 2) text = new TextDecoder('utf-16be').decode(bytes);
    else if (encoding === 3) text = new TextDecoder('utf-8').decode(bytes);
    else text = new TextDecoder('windows-1252').decode(bytes);
    return text.replace(/﻿/g, '');
  } catch {
    return '';
  }
}

/** ID3 text can hold several values separated by a zero. Join them nicely. */
function cleanValues(text: string, joiner = ', '): string {
  return text
    .split('\u0000')
    .map((t) => t.trim())
    .filter(Boolean)
    .join(joiner);
}

function terminatorIndex(data: Uint8Array, start: number, encoding: number): { index: number; width: number } {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < data.length; i += 2) if (data[i] === 0 && data[i + 1] === 0) return { index: i, width: 2 };
    return { index: data.length, width: 0 };
  }
  for (let i = start; i < data.length; i++) if (data[i] === 0) return { index: i, width: 1 };
  return { index: data.length, width: 0 };
}

function removeUnsync(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) {
      out[n++] = 0xff;
      i++;
    } else out[n++] = bytes[i];
  }
  return out.slice(0, n);
}

function parseGenre(raw: string): string {
  const text = raw.trim();
  const match = /^\((\d+)\)\s*(.*)$/.exec(text);
  if (match) return match[2] || ID3V1_GENRES[parseInt(match[1], 10)] || '';
  if (/^\d+$/.test(text)) return ID3V1_GENRES[parseInt(text, 10)] || '';
  return text;
}

function parseNumberPair(text: string): number {
  const n = parseInt(text.split('/')[0], 10);
  return isNaN(n) ? 0 : n;
}

function parseYear(text: string): number {
  const m = /(\d{4})/.exec(text);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------- ID3v2 (MP3) ----------

const V22_TO_V23: Record<string, string> = {
  TT2: 'TIT2', TP1: 'TPE1', TP2: 'TPE2', TAL: 'TALB', TRK: 'TRCK', TPA: 'TPOS', TCO: 'TCON', TYE: 'TYER', PIC: 'APIC', ULT: 'USLT',
};

export function parseId3v2(data: Uint8Array): ParsedTags {
  const tags: ParsedTags = {};
  if (data.length < 10 || ascii(data, 0, 3) !== 'ID3') return tags;
  const version = data[3];
  const flags = data[5];
  const size = synchsafe(data, 6);
  let body = data.subarray(10, Math.min(data.length, 10 + size));
  if (flags & 0x80 && version < 4) body = removeUnsync(body);

  let pos = 0;
  if (flags & 0x40 && version >= 3 && body.length >= 4) {
    // skip the extended header
    pos = version === 4 ? synchsafe(body, 0) : u32(body, 0) + 4;
  }

  let bestPicture: { data: Uint8Array; mime: string; type: number } | undefined;
  const headerSize = version === 2 ? 6 : 10;
  const idLength = version === 2 ? 3 : 4;

  while (pos + headerSize <= body.length) {
    const rawId = ascii(body, pos, idLength);
    if (!/^[A-Z0-9]+$/.test(rawId)) break; // reached the padding
    let frameSize: number;
    let frameFlags = 0;
    if (version === 2) frameSize = (body[pos + 3] << 16) | (body[pos + 4] << 8) | body[pos + 5];
    else {
      frameSize = version === 4 ? synchsafe(body, pos + 4) : u32(body, pos + 4);
      frameFlags = u16(body, pos + 8);
    }
    const start = pos + headerSize;
    if (frameSize <= 0 || start + frameSize > body.length) break;
    let frame = body.subarray(start, start + frameSize);
    pos = start + frameSize;

    if (version === 4) {
      if (frameFlags & 0x0001) frame = frame.subarray(4); // data length indicator
      if (frameFlags & 0x0002) frame = removeUnsync(frame);
    }
    const id = version === 2 ? V22_TO_V23[rawId] || rawId : rawId;
    if (frame.length < 1) continue;
    const enc = frame[0];

    const text = () => decodeText(frame.subarray(1), enc);
    switch (id) {
      case 'TIT2': tags.title = cleanValues(text(), ' / '); break;
      case 'TPE1': tags.artist = cleanValues(text()); break;
      case 'TPE2': tags.albumArtist = cleanValues(text()); break;
      case 'TALB': tags.album = cleanValues(text(), ' / '); break;
      case 'TCON': tags.genre = parseGenre(cleanValues(text()).split(', ')[0] || ''); break;
      case 'TRCK': tags.trackNo = parseNumberPair(cleanValues(text())); break;
      case 'TPOS': tags.discNo = parseNumberPair(cleanValues(text())); break;
      case 'TYER':
      case 'TDRC':
      case 'TDAT': tags.year = tags.year || parseYear(cleanValues(text())); break;
      case 'TLEN': {
        const ms = parseInt(cleanValues(text()), 10);
        if (!isNaN(ms) && ms > 0) tags.duration = ms / 1000;
        break;
      }
      case 'USLT': {
        // encoding, language(3), descriptor, text
        const t = terminatorIndex(frame, 4, enc);
        const lyricText = decodeText(frame.subarray(t.index + t.width), enc).trim();
        if (lyricText) tags.lyrics = lyricText;
        break;
      }
      case 'APIC': {
        let mime = '';
        let p = 1;
        if (version === 2) {
          const fmt = ascii(frame, 1, 3).toUpperCase();
          mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
          p = 4;
        } else {
          let e = p;
          while (e < frame.length && frame[e] !== 0) e++;
          mime = ascii(frame, p, e - p).toLowerCase();
          p = e + 1;
        }
        const pictureType = frame[p];
        p += 1;
        const t = terminatorIndex(frame, p, enc);
        const picture = frame.subarray(t.index + t.width);
        if (picture.length > 16) {
          if (!mime.startsWith('image/')) mime = picture[0] === 0x89 ? 'image/png' : 'image/jpeg';
          // prefer the front cover (type 3)
          if (!bestPicture || (pictureType === 3 && bestPicture.type !== 3)) bestPicture = { data: picture.slice(), mime, type: pictureType };
        }
        break;
      }
    }
  }
  if (bestPicture) tags.picture = { data: bestPicture.data, mime: bestPicture.mime };
  return tags;
}

export function parseId3v1(tail: Uint8Array): ParsedTags {
  const tags: ParsedTags = {};
  if (tail.length < 128) return tags;
  const o = tail.length - 128;
  if (ascii(tail, o, 3) !== 'TAG') return tags;
  const field = (start: number, n: number) => decodeText(tail.subarray(o + start, o + start + n), 0).replace(/\u0000.*$/, '').trim();
  tags.title = field(3, 30);
  tags.artist = field(33, 30);
  tags.album = field(63, 30);
  const year = parseYear(field(93, 4));
  if (year) tags.year = year;
  if (tail[o + 125] === 0 && tail[o + 126] > 0) tags.trackNo = tail[o + 126];
  const g = ID3V1_GENRES[tail[o + 127]];
  if (g) tags.genre = g;
  return tags;
}

async function readMp3(blob: Blob): Promise<ParsedTags> {
  const head = await readRange(blob, 0, 10);
  let tags: ParsedTags = {};
  if (ascii(head, 0, 3) === 'ID3') {
    const size = synchsafe(head, 6);
    // Cover pictures can be large; allow up to 16 MB of tag.
    const full = await readRange(blob, 0, Math.min(10 + size, 16 * 1024 * 1024));
    tags = parseId3v2(full);
  }
  if (!tags.title && !tags.artist && blob.size > 128) {
    const v1 = parseId3v1(await readRange(blob, blob.size - 128, 128));
    tags = { ...v1, ...tags, title: tags.title || v1.title, artist: tags.artist || v1.artist, album: tags.album || v1.album };
  }
  return tags;
}

// ---------- MP4 / M4A ----------

interface Atom {
  type: string;
  start: number;
  size: number;
  header: number;
}

async function topLevelAtoms(blob: Blob): Promise<Atom[]> {
  const atoms: Atom[] = [];
  let pos = 0;
  while (pos + 8 <= blob.size && atoms.length < 64) {
    const h = await readRange(blob, pos, 16);
    let size = u32(h, 0);
    const type = ascii(h, 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32(h, 8) * 4294967296 + u32(h, 12);
      header = 16;
    } else if (size === 0) size = blob.size - pos;
    if (size < header) break;
    atoms.push({ type, start: pos, size, header });
    pos += size;
  }
  return atoms;
}

function childAtoms(data: Uint8Array, start: number, end: number): Atom[] {
  const list: Atom[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = u32(data, pos);
    const type = ascii(data, pos + 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32(data, pos + 8) * 4294967296 + u32(data, pos + 12);
      header = 16;
    } else if (size === 0) size = end - pos;
    if (size < header || pos + size > end) break;
    list.push({ type, start: pos, size, header });
    pos += size;
  }
  return list;
}

export function parseMoov(moov: Uint8Array): ParsedTags {
  const tags: ParsedTags = {};
  const top = childAtoms(moov, 8, moov.length);

  const mvhd = top.find((a) => a.type === 'mvhd');
  if (mvhd) {
    const o = mvhd.start + mvhd.header;
    const v = moov[o];
    const timescale = v === 1 ? u32(moov, o + 20) : u32(moov, o + 12);
    const dur = v === 1 ? u32(moov, o + 24) * 4294967296 + u32(moov, o + 28) : u32(moov, o + 16);
    if (timescale > 0 && dur > 0) tags.duration = dur / timescale;
  }

  const udta = top.find((a) => a.type === 'udta');
  const meta = udta ? childAtoms(moov, udta.start + udta.header, udta.start + udta.size).find((a) => a.type === 'meta') : top.find((a) => a.type === 'meta');
  if (!meta) return tags;
  // "meta" is a full box: skip 4 bytes of version/flags
  const ilst = childAtoms(moov, meta.start + meta.header + 4, meta.start + meta.size).find((a) => a.type === 'ilst');
  if (!ilst) return tags;

  for (const item of childAtoms(moov, ilst.start + ilst.header, ilst.start + ilst.size)) {
    const dataAtom = childAtoms(moov, item.start + item.header, item.start + item.size).find((a) => a.type === 'data');
    if (!dataAtom) continue;
    const typeFlag = u32(moov, dataAtom.start + dataAtom.header) & 0xffffff;
    const payload = moov.subarray(dataAtom.start + dataAtom.header + 8, dataAtom.start + dataAtom.size);
    const str = () => new TextDecoder('utf-8').decode(payload).trim();
    switch (item.type) {
      case '©nam': tags.title = str(); break;
      case '©ART': tags.artist = str(); break;
      case 'aART': tags.albumArtist = str(); break;
      case '©alb': tags.album = str(); break;
      case '©gen': tags.genre = str(); break;
      case '©day': tags.year = parseYear(str()); break;
      case '©lyr': if (str()) tags.lyrics = str(); break;
      case 'gnre': if (payload.length >= 2) tags.genre = tags.genre || ID3V1_GENRES[u16(payload, 0) - 1] || ''; break;
      case 'trkn': if (payload.length >= 4) tags.trackNo = u16(payload, 2); break;
      case 'disk': if (payload.length >= 4) tags.discNo = u16(payload, 2); break;
      case 'covr':
        if (payload.length > 16) tags.picture = { data: payload.slice(), mime: typeFlag === 14 || payload[0] === 0x89 ? 'image/png' : 'image/jpeg' };
        break;
    }
  }
  return tags;
}

async function readMp4(blob: Blob): Promise<ParsedTags> {
  const atoms = await topLevelAtoms(blob);
  const moov = atoms.find((a) => a.type === 'moov');
  if (!moov || moov.size > 40 * 1024 * 1024) return {};
  return parseMoov(await readRange(blob, moov.start, moov.size));
}

// ---------- FLAC ----------

export function parseVorbisComment(block: Uint8Array): ParsedTags {
  const tags: ParsedTags = {};
  const utf8 = new TextDecoder('utf-8');
  let pos = 4 + u32le(block, 0); // skip the vendor string
  const count = u32le(block, pos);
  pos += 4;
  for (let i = 0; i < count && pos + 4 <= block.length; i++) {
    const len = u32le(block, pos);
    pos += 4;
    const text = utf8.decode(block.subarray(pos, pos + len));
    pos += len;
    const eq = text.indexOf('=');
    if (eq < 1) continue;
    const key = text.slice(0, eq).toUpperCase();
    const value = text.slice(eq + 1).trim();
    if (key === 'TITLE') tags.title = value;
    else if (key === 'ARTIST') tags.artist = tags.artist ? `${tags.artist}, ${value}` : value;
    else if (key === 'ALBUMARTIST') tags.albumArtist = value;
    else if (key === 'ALBUM') tags.album = value;
    else if (key === 'GENRE') tags.genre = tags.genre || value;
    else if (key === 'TRACKNUMBER') tags.trackNo = parseNumberPair(value);
    else if (key === 'DISCNUMBER') tags.discNo = parseNumberPair(value);
    else if (key === 'DATE' || key === 'YEAR') tags.year = parseYear(value);
    else if (key === 'LYRICS' || key === 'UNSYNCEDLYRICS') tags.lyrics = value;
  }
  return tags;
}

async function readFlac(blob: Blob): Promise<ParsedTags> {
  const tags: ParsedTags = {};
  let pos = 4;
  let last = false;
  let budget = 24 * 1024 * 1024;
  while (!last && pos + 4 <= blob.size && budget > 0) {
    const h = await readRange(blob, pos, 4);
    last = (h[0] & 0x80) !== 0;
    const type = h[0] & 0x7f;
    const length = (h[1] << 16) | (h[2] << 8) | h[3];
    pos += 4;
    budget -= length;
    if (type === 0 && length >= 18) {
      const s = await readRange(blob, pos, 18);
      const sampleRate = (s[10] << 12) | (s[11] << 4) | (s[12] >> 4);
      const totalSamples = (s[13] & 0x0f) * 4294967296 + u32(s, 14);
      if (sampleRate > 0 && totalSamples > 0) tags.duration = totalSamples / sampleRate;
    } else if (type === 4) {
      Object.assign(tags, parseVorbisComment(await readRange(blob, pos, length)));
    } else if (type === 6 && !tags.picture) {
      const b = await readRange(blob, pos, length);
      const mimeLen = u32(b, 4);
      const mime = ascii(b, 8, mimeLen) || 'image/jpeg';
      let o = 8 + mimeLen;
      o += 4 + u32(b, o); // description
      o += 16; // width, height, depth, colours
      const dataLen = u32(b, o);
      o += 4;
      if (dataLen > 16) tags.picture = { data: b.slice(o, o + dataLen), mime };
    }
    pos += length;
  }
  return tags;
}

// ---------- entry point ----------

export type AudioKind = 'mp3' | 'mp4' | 'flac' | 'wav' | 'other';

export async function sniffKind(blob: Blob): Promise<AudioKind> {
  const h = await readRange(blob, 0, 12);
  if (ascii(h, 0, 3) === 'ID3') return 'mp3';
  if (h[0] === 0xff && (h[1] & 0xe0) === 0xe0) return 'mp3';
  if (ascii(h, 4, 4) === 'ftyp') return 'mp4';
  if (ascii(h, 0, 4) === 'fLaC') return 'flac';
  if (ascii(h, 0, 4) === 'RIFF' && ascii(h, 8, 4) === 'WAVE') return 'wav';
  return 'other';
}

export async function readTags(blob: Blob): Promise<{ kind: AudioKind; tags: ParsedTags }> {
  const kind = await sniffKind(blob);
  try {
    if (kind === 'mp3') return { kind, tags: await readMp3(blob) };
    if (kind === 'mp4') return { kind, tags: await readMp4(blob) };
    if (kind === 'flac') return { kind, tags: await readFlac(blob) };
  } catch {
    // A damaged tag must never stop an import: use file name instead.
  }
  return { kind, tags: {} };
}

/** Best guess for the MIME type. iPhone Safari needs the right one to play a stored file. */
export function mimeFor(fileName: string, kind: AudioKind, declared: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (kind === 'mp3' || ext === 'mp3') return 'audio/mpeg';
  if (kind === 'flac' || ext === 'flac') return 'audio/flac';
  if (kind === 'wav' || ext === 'wav') return 'audio/wav';
  if (ext === 'm4a' || ext === 'mp4' || ext === 'm4b' || kind === 'mp4') return 'audio/mp4';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'caf') return 'audio/x-caf';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'opus') return 'audio/ogg; codecs=opus';
  return declared || 'audio/mpeg';
}

/** Turns "Artist - Title (Official Audio).mp3" into something readable. */
export function guessFromFileName(fileName: string): { title: string; artist?: string; trackNo?: number } {
  let name = fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
  name = name.replace(/[_]+/g, ' ');
  // remove site names and "(Official Video)" style noise
  name = name
    .replace(/\b(?:www\.)?[a-z0-9-]+\.(?:com|net|org|co|io|tz|me)\b/gi, '')
    .replace(/[\[(](?:official|lyrics?|audio|video|music video|hd|hq|4k|mp3|download|visuali[sz]er)[^\])]*[\])]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();
  let trackNo: number | undefined;
  const lead = /^(\d{1,3})[\s.\-_)]+(?=\S)/.exec(name);
  if (lead && name.length > lead[0].length + 2) {
    trackNo = parseInt(lead[1], 10);
    name = name.slice(lead[0].length).trim();
  }
  const parts = name.split(/\s+[-–—]\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), trackNo };
  }
  return { title: name || fileName, trackNo };
}
