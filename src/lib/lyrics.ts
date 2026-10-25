// Lyrics system: reads plain lyrics and timestamped LRC lyrics.
// We never invent or download lyrics. Only text the user pastes/imports
// (or that is already inside their own audio file) is used.

import type { LyricLine } from '../types';

export interface ParsedLyrics {
  synced: boolean;
  lines: LyricLine[];
}

// [mm:ss], [mm:ss.xx], [mm:ss:xx], [m:ss.xxx]
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
// Metadata tags such as [ar:Artist] [ti:Title] [offset:+200]
const META_TAG = /^\[([a-zA-Z#]+):(.*)\]$/;
// Word-level timing from "enhanced" LRC files: <00:12.34>
const WORD_TAG = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

function toSeconds(min: string, sec: string, frac?: string): number {
  let fraction = 0;
  if (frac) fraction = parseInt(frac, 10) / Math.pow(10, frac.length);
  return parseInt(min, 10) * 60 + parseInt(sec, 10) + fraction;
}

export function parseLyrics(raw: string): ParsedLyrics {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rows = text.split('\n');
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];
  let offset = 0; // seconds, from [offset:+500] (milliseconds in the file)

  for (const row of rows) {
    const trimmed = row.trim();
    const meta = META_TAG.exec(trimmed);
    if (meta && !/^\d/.test(meta[1])) {
      if (meta[1].toLowerCase() === 'offset') {
        const ms = parseInt(meta[2], 10);
        if (!isNaN(ms)) offset = ms / 1000;
      }
      continue; // skip ar/ti/al/by/length ... lines
    }

    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    let lastEnd = 0;
    while ((match = TIME_TAG.exec(trimmed)) !== null) {
      times.push(toSeconds(match[1], match[2], match[3]));
      lastEnd = TIME_TAG.lastIndex;
    }

    if (times.length) {
      const lineText = trimmed.slice(lastEnd).replace(WORD_TAG, '').replace(/\s+/g, ' ').trim();
      for (const t of times) timed.push({ time: Math.max(0, t - offset), text: lineText });
    } else {
      plain.push({ time: -1, text: trimmed });
    }
  }

  if (timed.length >= 2) {
    timed.sort((a, b) => a.time - b.time);
    return { synced: true, lines: timed };
  }

  // Not synchronised: keep blank lines as verse gaps, trim blanks at both ends.
  const all = rows.map((r) => ({ time: -1, text: r.replace(TIME_TAG, '').trim() }));
  while (all.length && !all[0].text) all.shift();
  while (all.length && !all[all.length - 1].text) all.pop();
  void plain;
  return { synced: false, lines: all };
}

/** True when the text has at least two timestamped lines. */
export function looksSynced(raw: string): boolean {
  return parseLyrics(raw).synced;
}

/**
 * Index of the line that should be highlighted at `time` (seconds).
 * Returns -1 before the first line. Uses binary search, so it is fast.
 */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let answer = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= time + 0.05) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}

/** Makes a small LRC text from lines (used by the sample tracks). */
export function toLrc(lines: { time: number; text: string }[]): string {
  return lines
    .map((l) => {
      const m = Math.floor(l.time / 60);
      const s = l.time - m * 60;
      return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]${l.text}`;
    })
    .join('\n');
}
