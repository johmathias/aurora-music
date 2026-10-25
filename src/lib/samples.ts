// Optional sample tracks. Everything here (music, cover art, lyrics) is original
// and made on the device, so there is nothing to download and no licence to worry about.
// They are marked as samples and can be removed in Settings.

import { addTrackRecord, library, removeTracks } from '../store/library';
import { processArtwork } from './artwork';
import { CHORDS, SAMPLE_RATE, encodeWav, synthesize, type SynthSpec } from './synth';
import { parseLyrics, toLrc } from './lyrics';
import { hashString } from './format';
import type { LyricsRec, Track } from '../types';

interface SampleDef {
  slug: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  trackNo: number;
  year: number;
  hue: number;
  spec: Omit<SynthSpec, 'seconds' | 'seed'>;
  seconds: number;
  lyrics: string[]; // original words; timed automatically
  synced: boolean;
}

const { MAJ7, MIN7, MAJ, MIN, SUS } = CHORDS;

const SAMPLES: SampleDef[] = [
  {
    slug: 'morning-glass', title: 'Morning Glass', artist: 'Aurora Samples', album: 'Sample Sessions', genre: 'Ambient', trackNo: 1, year: 2026, hue: 192,
    spec: { rootHz: 261.63, bpm: 84, drums: false, progression: [{ root: 0, tones: MAJ7 }, { root: 9, tones: MIN7 }, { root: 5, tones: MAJ7 }, { root: 7, tones: SUS }] },
    seconds: 44, synced: true,
    lyrics: ['Light on the window, slow and thin', 'The kettle hums, the day begins', 'Nothing to chase and nowhere to be', 'Just a quiet room and the sky for me', 'Let the morning glass the world', 'Let the hours unfurl', 'Everything gentle, everything bright', 'Easy as breathing in the light'],
  },
  {
    slug: 'night-signals', title: 'Night Signals', artist: 'Aurora Samples', album: 'Sample Sessions', genre: 'Electronic', trackNo: 2, year: 2026, hue: 268,
    spec: { rootHz: 220, bpm: 108, drums: true, progression: [{ root: 0, tones: MIN }, { root: 8, tones: MAJ }, { root: 3, tones: MAJ }, { root: 10, tones: MAJ }] },
    seconds: 42, synced: true,
    lyrics: ['City lights blink in a line', 'Messages travelling over the wire', 'Every window a small design', 'Every heartbeat a little fire', 'Send it out, let it ride', 'Signals crossing the dark', 'Somewhere out there, you reply', 'A single spark'],
  },
  {
    slug: 'paper-lanterns', title: 'Paper Lanterns', artist: 'Aurora Samples', album: 'Quiet Hours', genre: 'Chill', trackNo: 1, year: 2025, hue: 24,
    spec: { rootHz: 293.66, bpm: 92, drums: false, progression: [{ root: 0, tones: MAJ7 }, { root: 9, tones: MIN7 }, { root: 5, tones: MAJ7 }, { root: 2, tones: MIN7 }] },
    seconds: 44, synced: true,
    lyrics: ['Hang the lanterns, one by one', 'Warm little moons for everyone', 'Paper and wire and a breath of air', 'Glow like a promise hanging there', 'The street grows soft, the evening slows', 'Nobody knows where the music goes', 'Hold this light a little while', 'Let it stay, let it smile'],
  },
  {
    slug: 'neon-tide', title: 'Neon Tide', artist: 'Aurora Samples', album: 'Signal & Tide', genre: 'Synthwave', trackNo: 1, year: 2025, hue: 322,
    spec: { rootHz: 164.81, bpm: 118, drums: true, progression: [{ root: 0, tones: MIN7 }, { root: 5, tones: MAJ7 }, { root: 3, tones: MAJ7 }, { root: 10, tones: SUS }] },
    seconds: 40, synced: true,
    lyrics: ['Pink on the water, blue in the haze', 'The coast road hums in a midnight daze', 'Tide comes in with a silver sound', 'Radio low and the wheels go round', 'Chasing the glow down the shoreline wide', 'Neon and ocean side by side'],
  },
  {
    slug: 'slow-orbit', title: 'Slow Orbit', artist: 'Lumen Fields', album: 'Slow Orbit', genre: 'Ambient', trackNo: 1, year: 2026, hue: 214,
    spec: { rootHz: 196, bpm: 72, drums: false, progression: [{ root: 0, tones: MAJ7 }, { root: 7, tones: SUS }, { root: 9, tones: MIN7 }, { root: 5, tones: MAJ7 }] },
    seconds: 46, synced: false,
    // This one is deliberately plain (not timed) to show how unsynchronised lyrics look.
    lyrics: ['Round and round, a slow orbit', 'Quiet circles, nothing to forget', '', 'Hold the silence like a stone', 'Let the distance carry you home', '', 'Round and round, a slow orbit', 'Still the stars, still the song'],
  },
  {
    slug: 'lantern-rain', title: 'Lantern Rain', artist: 'Lumen Fields', album: 'Slow Orbit', genre: 'Chill', trackNo: 2, year: 2026, hue: 148,
    spec: { rootHz: 246.94, bpm: 88, drums: false, progression: [{ root: 0, tones: MIN7 }, { root: 3, tones: MAJ7 }, { root: 7, tones: MIN7 }, { root: 5, tones: MAJ }] },
    seconds: 42, synced: true,
    lyrics: ['Rain on the roof like a tapping clock', 'Steam on the glass and a book unlocked', 'Count the drops as they race and fall', 'Soft little drums on a window wall', 'Stay in, stay warm, let the grey go by', 'Lantern rain on a lullaby'],
  },
];

async function paintCover(seed: number, hue: number): Promise<Blob> {
  const size = 800;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, `hsl(${hue} 55% 10%)`);
  bg.addColorStop(1, `hsl(${(hue + 50) % 360} 60% 26%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // soft glowing ribbons (many faint strokes make a glow without blur filters)
  for (let r = 0; r < 5; r++) {
    const h = (hue + r * 24 + (seed % 20)) % 360;
    const y0 = size * (0.25 + 0.14 * r);
    const amp = 40 + ((seed >> (r * 3)) % 60);
    const phase = (seed % 100) / 15 + r;
    for (let w = 150; w >= 10; w -= 20) {
      ctx.beginPath();
      for (let x = -20; x <= size + 20; x += 10) {
        const y = y0 + amp * Math.sin(x / 130 + phase) + (amp / 3) * Math.sin(x / 47 + phase * 2);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `hsla(${h} 85% 62% / ${0.03 + (150 - w) / 4500})`;
      ctx.stroke();
    }
  }
  // a small bright circle, like a moon
  const mx = size * (0.25 + ((seed >> 5) % 50) / 100);
  const my = size * (0.12 + ((seed >> 9) % 25) / 100);
  const moon = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
  moon.addColorStop(0, 'rgba(255,255,255,0.95)');
  moon.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  moon.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(mx - 80, my - 80, 160, 160);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('cover failed'))), 'image/png'));
}

export function hasSamples(): boolean {
  return library.get().tracks.some((t) => t.sample);
}

export async function installSamples(onProgress?: (done: number, total: number) => void): Promise<number> {
  let added = 0;
  const now = Date.now();
  for (let i = 0; i < SAMPLES.length; i++) {
    const def = SAMPLES[i];
    const id = `trk-sample-${def.slug}`;
    onProgress?.(i, SAMPLES.length);
    await new Promise((r) => setTimeout(r, 0)); // let the screen update
    if (library.get().byId.has(id)) continue;

    const seed = hashString(def.slug);
    const pcm = synthesize({ ...def.spec, seconds: def.seconds, seed });
    const wav = new Blob([encodeWav(pcm).slice().buffer as ArrayBuffer], { type: 'audio/wav' });
    const art = await processArtwork(await paintCover(seed, def.hue), 'image/png');

    // Time the lyric lines evenly across the song (after a short intro).
    const lines = def.lyrics;
    let lyrics: LyricsRec;
    if (def.synced) {
      const start = 4;
      const spanTime = def.seconds - start - 5;
      const timed = lines.map((text, n) => ({ time: start + (spanTime * n) / lines.length, text }));
      const text = toLrc(timed);
      lyrics = { trackId: id, text, synced: parseLyrics(text).synced, source: 'sample' };
    } else {
      lyrics = { trackId: id, text: lines.join('\n'), synced: false, source: 'sample' };
    }

    const track: Track = {
      id, title: def.title, artist: def.artist, album: def.album, albumArtist: def.artist, genre: def.genre,
      trackNo: def.trackNo, discNo: 1, year: def.year, duration: pcm.length / SAMPLE_RATE, size: wav.size, mime: 'audio/wav',
      fileName: `${def.slug}.wav`, addedAt: now + i, playCount: 0, lastPlayedAt: 0, favorite: false, artId: art?.id,
      hasLyrics: true, sample: true,
    };
    await addTrackRecord(track, wav, art, lyrics);
    added++;
  }
  onProgress?.(SAMPLES.length, SAMPLES.length);
  return added;
}

export async function removeSamples(): Promise<number> {
  const ids = library.get().tracks.filter((t) => t.sample).map((t) => t.id);
  if (ids.length) await removeTracks(ids);
  return ids.length;
}
