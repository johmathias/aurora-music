// Small user preferences + recent searches. Saved in IndexedDB (kv) and mirrored in memory.

import { kvGet, kvSet } from '../lib/db';
import { createStore, useStore } from './createStore';
import type { Preferences } from '../types';

interface PrefState extends Preferences {
  recentSearches: string[];
  loaded: boolean;
}

export const prefs = createStore<PrefState>({
  appearance: 'system',
  lyricsBackground: true,
  volume: 1,
  recentSearches: [],
  loaded: false,
});

export const usePrefs = <S,>(selector: (s: PrefState) => S) => useStore(prefs, selector);

export function applyAppearance(value: Preferences['appearance']) {
  const el = document.documentElement;
  if (value === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', value);
  const meta = document.querySelector('meta[name="theme-color"]');
  const dark = value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  meta?.setAttribute('content', dark ? '#000000' : '#ffffff');
}

export async function loadPrefs(): Promise<void> {
  const saved = await kvGet<Partial<Preferences>>('prefs', {});
  const recent = await kvGet<string[]>('recentSearches', []);
  prefs.set({ ...saved, recentSearches: recent, loaded: true });
  applyAppearance(prefs.get().appearance);
}

export function setPref<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  prefs.set({ [key]: value } as Partial<PrefState>);
  const { appearance, lyricsBackground, volume } = prefs.get();
  void kvSet('prefs', { appearance, lyricsBackground, volume });
  if (key === 'appearance') applyAppearance(value as Preferences['appearance']);
}

export function rememberSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  const list = [t, ...prefs.get().recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 10);
  prefs.set({ recentSearches: list });
  void kvSet('recentSearches', list);
}

export function forgetSearch(term?: string) {
  const list = term ? prefs.get().recentSearches.filter((x) => x !== term) : [];
  prefs.set({ recentSearches: list });
  void kvSet('recentSearches', list);
}
