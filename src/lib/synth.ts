// A very small music synthesiser. It creates the ORIGINAL sample songs that
// Aurora can install so you can try every feature before adding your own music.
// Pure maths: no browser features needed, so it also runs in the test script.

export interface SynthSpec {
  rootHz: number;
  bpm: number;
  seconds: number;
  // each chord: semitone offset from the root + chord tones in semitones
  progression: { root: number; tones: number[] }[];
  drums: boolean;
  seed: number;
}

export const SAMPLE_RATE = 22050;

const MAJ7 = [0, 4, 7, 11];
const MIN7 = [0, 3, 7, 10];
const MAJ = [0, 4, 7];
const MIN = [0, 3, 7];
const SUS = [0, 5, 7, 12];
export const CHORDS = { MAJ7, MIN7, MAJ, MIN, SUS };

const hz = (root: number, semitones: number) => root * Math.pow(2, semitones / 12);

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthesize(spec: SynthSpec): Int16Array {
  const total = Math.floor(spec.seconds * SAMPLE_RATE);
  const out = new Float32Array(total);
  const rand = mulberry(spec.seed);
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const bars = Math.ceil(spec.seconds / bar);

  const add = (start: number, length: number, fn: (t: number) => number) => {
    const s = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const e = Math.min(total, Math.floor((start + length) * SAMPLE_RATE));
    for (let i = s; i < e; i++) out[i] += fn((i - s) / SAMPLE_RATE);
  };

  for (let b = 0; b < bars; b++) {
    const chord = spec.progression[b % spec.progression.length];
    const t0 = b * bar;
    const rootFreq = hz(spec.rootHz, chord.root);

    // soft pad: the chord held for the whole bar
    for (const tone of chord.tones) {
      const f = hz(spec.rootHz, chord.root + tone);
      add(t0, bar + 0.6, (t) => {
        const env = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (bar + 0.6 - t) / 0.6));
        return 0.05 * env * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t));
      });
    }

    // bass: root note on beats 1 and 3
    for (const beatNo of [0, 2]) {
      add(t0 + beatNo * beat, beat * 1.8, (t) => {
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 1.6);
        return 0.17 * env * Math.sin(2 * Math.PI * (rootFreq / 2) * t);
      });
    }

    // arpeggio: eighth notes walking up and down through the chord
    const notes = chord.tones.concat(chord.tones.map((n) => n + 12));
    for (let step = 0; step < 8; step++) {
      const idx = step < 4 ? step % notes.length : (7 - step + 4) % notes.length;
      const f = hz(spec.rootHz, chord.root + notes[idx] + 12);
      const when = t0 + step * (beat / 2);
      const accent = step % 2 === 0 ? 1 : 0.7;
      add(when, 1.4, (t) => {
        const env = Math.min(1, t / 0.006) * Math.exp(-t * 3.2);
        return 0.13 * accent * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t));
      });
    }

    if (spec.drums) {
      for (const beatNo of [0, 1, 2, 3]) {
        // kick
        add(t0 + beatNo * beat, 0.3, (t) => {
          const freq = 42 + 90 * Math.exp(-t * 28);
          return 0.32 * Math.exp(-t * 11) * Math.sin(2 * Math.PI * freq * t);
        });
      }
      for (let step = 0; step < 8; step++) {
        if (step % 2 === 0) continue;
        // hi-hat: short burst of noise
        let last = 0;
        add(t0 + step * (beat / 2), 0.05, (t) => {
          const n = rand() * 2 - 1;
          const hp = n - last;
          last = n;
          return 0.05 * hp * Math.exp(-t * 90);
        });
      }
    }
  }

  const pcm = new Int16Array(total);
  const fade = SAMPLE_RATE * 0.8;
  for (let i = 0; i < total; i++) {
    const g = Math.min(1, i / fade) * Math.min(1, (total - i) / fade);
    pcm[i] = Math.round(Math.tanh(out[i] * 1.5 * g) * 0.82 * 32767);
  }
  return pcm;
}

/** Wraps 16-bit mono samples in a normal .wav file. */
export function encodeWav(pcm: Int16Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return bytes;
}
