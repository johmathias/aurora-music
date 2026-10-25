// Cover pictures: shrinking, picking colours, caching URLs, and
// drawing nice placeholders when a song has no picture.

import { useEffect, useState } from 'react';
import { store } from './db';
import { hashString } from './format';
import { bytesFingerprint } from './hash';
import type { ArtworkRec } from '../types';

// ---------- turning picture bytes into small, square pictures ----------

async function decodeImage(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to the <img> method */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image could not be read'));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function squareJpeg(source: CanvasImageSource, w: number, h: number, size: number, quality: number): Promise<Blob> {
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const target = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, target, target);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, side, side, 0, 0, target, target);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not shrink the picture'))), 'image/jpeg', quality),
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Picks up to 4 pleasant background colours from a picture. The first is the main one. */
function pickColors(source: CanvasImageSource, w: number, h: number): string[] {
  const grid = 4;
  const canvas = document.createElement('canvas');
  canvas.width = grid;
  canvas.height = grid;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h, 0, 0, grid, grid);
  const px = ctx.getImageData(0, 0, grid, grid).data;
  const cells: { hsl: [number, number, number]; score: number }[] = [];
  for (let i = 0; i < grid * grid; i++) {
    const [hue, sat, light] = rgbToHsl(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    // make colours usable as a dark, rich background
    const s = Math.min(0.85, Math.max(sat, 0.28));
    const l = Math.min(0.52, Math.max(0.24, light));
    cells.push({ hsl: [hue, s, l], score: sat * (1 - Math.abs(light - 0.45)) });
  }
  cells.sort((a, b) => b.score - a.score);
  const chosen: [number, number, number][] = [];
  for (const c of cells) {
    // skip colours that look almost the same as one we already have
    if (chosen.every((o) => Math.abs(o[0] - c.hsl[0]) > 18 || Math.abs(o[2] - c.hsl[2]) > 0.1)) chosen.push(c.hsl);
    if (chosen.length === 4) break;
  }
  while (chosen.length < 4) chosen.push(chosen[chosen.length % Math.max(1, chosen.length)] ?? [0, 0.05, 0.25]);
  return chosen.map(([hh, ss, ll]) => `hsl(${Math.round(hh)} ${Math.round(ss * 100)}% ${Math.round(ll * 100)}%)`);
}

export async function processArtwork(data: Uint8Array | Blob, mime = 'image/jpeg'): Promise<ArtworkRec | null> {
  try {
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
    const img = await decodeImage(blob);
    try {
      const [full, thumb] = await Promise.all([
        squareJpeg(img.source, img.width, img.height, 700, 0.86),
        squareJpeg(img.source, img.width, img.height, 360, 0.82),
      ]);
      const colors = pickColors(img.source, img.width, img.height);
      return { id: `art-${bytesFingerprint(bytes)}`, full, thumb, colors };
    } finally {
      img.close();
    }
  } catch {
    return null; // a damaged picture is simply ignored
  }
}

// ---------- looking pictures up (with a small cache) ----------

const urlCache = new Map<string, Promise<string | null>>();
const recCache = new Map<string, Promise<ArtworkRec | undefined>>();
const resolvedUrls = new Map<string, string>();
const MAX_URLS = 500;

function loadRec(id: string): Promise<ArtworkRec | undefined> {
  let p = recCache.get(id);
  if (!p) {
    p = store.get<ArtworkRec>('artwork', id).catch(() => undefined);
    recCache.set(id, p);
    if (recCache.size > 60) recCache.delete(recCache.keys().next().value as string);
  }
  return p;
}

export function artworkUrl(id: string, kind: 'thumb' | 'full'): Promise<string | null> {
  const key = `${id}:${kind}`;
  const hit = urlCache.get(key);
  if (hit) {
    // keep recently used entries at the end
    urlCache.delete(key);
    urlCache.set(key, hit);
    return hit;
  }
  const p = loadRec(id).then((rec) => {
    if (!rec) return null;
    const url = URL.createObjectURL(kind === 'thumb' ? rec.thumb : rec.full);
    resolvedUrls.set(key, url);
    return url;
  });
  urlCache.set(key, p);
  // forget the oldest pictures so memory does not grow forever
  while (urlCache.size > MAX_URLS) {
    const oldest = urlCache.keys().next().value as string;
    urlCache.delete(oldest);
    const url = resolvedUrls.get(oldest);
    if (url) {
      resolvedUrls.delete(oldest);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  }
  return p;
}

export function forgetArtwork(id: string): void {
  recCache.delete(id);
  for (const kind of ['thumb', 'full']) {
    const key = `${id}:${kind}`;
    urlCache.delete(key);
    const url = resolvedUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      resolvedUrls.delete(key);
    }
  }
}

export async function artworkColors(id?: string): Promise<string[] | null> {
  if (!id) return null;
  const rec = await loadRec(id);
  return rec?.colors ?? null;
}

export function useArtworkUrl(artId: string | undefined, kind: 'thumb' | 'full'): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!artId) {
      setUrl(null);
      return;
    }
    artworkUrl(artId, kind).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [artId, kind]);
  return url;
}

export function useArtworkColors(artId: string | undefined, seed: string): string[] {
  const [colors, setColors] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    setColors(null);
    artworkColors(artId).then((c) => {
      if (alive) setColors(c);
    });
    return () => {
      alive = false;
    };
  }, [artId]);
  return colors ?? placeholderColors(seed);
}

// ---------- placeholders (no picture available) ----------

export function placeholderColors(seed: string): string[] {
  const h = hashString(seed || 'aurora') % 360;
  return [`hsl(${h} 62% 44%)`, `hsl(${(h + 48) % 360} 58% 34%)`, `hsl(${(h + 300) % 360} 55% 38%)`, `hsl(${(h + 160) % 360} 48% 28%)`];
}

/** A soft, layered gradient. Same seed = same picture, always. */
export function placeholderBackground(seed: string): string {
  const [a, b, c, d] = placeholderColors(seed);
  const n = hashString(seed + 'x');
  const x1 = 15 + (n % 40);
  const y1 = 10 + ((n >> 3) % 35);
  const x2 = 55 + ((n >> 6) % 40);
  const y2 = 60 + ((n >> 9) % 35);
  return `radial-gradient(120% 90% at ${x1}% ${y1}%, ${a} 0%, transparent 62%), radial-gradient(110% 100% at ${x2}% ${y2}%, ${c} 0%, transparent 64%), linear-gradient(150deg, ${b}, ${d})`;
}
