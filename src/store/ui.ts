// Everything about what is on screen: tabs, pushed screens, sheets, menus, toasts.

import { createStore, useStore } from './createStore';

export type Tab = 'listen' | 'browse' | 'radio' | 'library' | 'search';
export type SongSource = 'all' | 'favorites' | 'recentlyAdded' | 'recentlyPlayed' | 'mostPlayed' | 'imported';

export type Route =
  | { kind: 'root' }
  | { kind: 'album'; key: string }
  | { kind: 'artist'; key: string }
  | { kind: 'playlist'; id: string }
  | { kind: 'genre'; name: string }
  | { kind: 'songs'; source: SongSource }
  | { kind: 'smart'; id: string }
  | { kind: 'albums' }
  | { kind: 'artists' }
  | { kind: 'genres' }
  | { kind: 'playlists' };

export interface Entry {
  sid: number;
  route: Route;
}

export type SheetDef =
  | { type: 'import' }
  | { type: 'queue' }
  | { type: 'settings' }
  | { type: 'trackInfo'; trackId: string }
  | { type: 'addToPlaylist'; trackIds: string[] }
  | { type: 'playlistEditor'; id?: string; trackIds?: string[] }
  | { type: 'mixEditor'; id?: string }
  | { type: 'lyricsEditor'; trackId: string }
  | { type: 'editTrack'; trackId: string }
  | { type: 'addSongs'; playlistId: string };

export interface MenuItem {
  label: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuDef {
  title?: string;
  subtitle?: string;
  art?: { artId?: string; seed: string };
  items: MenuItem[];
}

export interface ConfirmDef {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

export interface ToastDef {
  id: number;
  message: string;
  kind: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
}

interface UiState {
  tab: Tab;
  stacks: Record<Tab, Entry[]>;
  visited: Record<Tab, boolean>;
  nowPlayingOpen: boolean;
  nowPlayingMode: 'art' | 'lyrics';
  sheets: (SheetDef & { sid: number })[];
  menu: MenuDef | null;
  confirm: ConfirmDef | null;
  toast: ToastDef | null;
  online: boolean;
}

let counter = 1;
const next = () => counter++;
const root = (): Entry => ({ sid: next(), route: { kind: 'root' } });

export const ui = createStore<UiState>({
  tab: 'listen',
  stacks: { listen: [root()], browse: [root()], radio: [root()], library: [root()], search: [root()] },
  visited: { listen: true, browse: false, radio: false, library: false, search: false },
  nowPlayingOpen: false,
  nowPlayingMode: 'art',
  sheets: [],
  menu: null,
  confirm: null,
  toast: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
});

export const useUi = <S,>(selector: (s: UiState) => S) => useStore(ui, selector);

// ---------- navigation ----------

export const nav = {
  openTab(tab: Tab) {
    const s = ui.get();
    if (s.tab === tab) {
      // tapping the active tab goes back to its first screen
      if (s.stacks[tab].length > 1) ui.set({ stacks: { ...s.stacks, [tab]: [s.stacks[tab][0]] } });
      else document.querySelector<HTMLElement>(`[data-tab-root="${tab}"] .scroll`)?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    ui.set({ tab, visited: { ...s.visited, [tab]: true } });
  },
  push(route: Route) {
    const s = ui.get();
    const stack = s.stacks[s.tab];
    ui.set({ nowPlayingOpen: false, stacks: { ...s.stacks, [s.tab]: [...stack, { sid: next(), route }] } });
  },
  pop() {
    const s = ui.get();
    const stack = s.stacks[s.tab];
    if (stack.length > 1) ui.set({ stacks: { ...s.stacks, [s.tab]: stack.slice(0, -1) } });
  },
  /** Open a screen from anywhere, in the tab where it belongs. */
  goTo(tab: Tab, route: Route) {
    const s = ui.get();
    const stack = s.stacks[tab];
    ui.set({
      tab,
      nowPlayingOpen: false,
      sheets: [],
      visited: { ...s.visited, [tab]: true },
      stacks: { ...s.stacks, [tab]: [stack[0], { sid: next(), route }] },
    });
  },
};

// ---------- Now Playing ----------

export const nowPlaying = {
  open(mode: 'art' | 'lyrics' = 'art') {
    ui.set({ nowPlayingOpen: true, nowPlayingMode: mode });
  },
  close() {
    ui.set({ nowPlayingOpen: false });
  },
  setMode(mode: 'art' | 'lyrics') {
    ui.set({ nowPlayingMode: mode });
  },
};

// ---------- sheets, menus, confirmations ----------

export const sheets = {
  open(def: SheetDef) {
    ui.set((s) => ({ sheets: [...s.sheets, { ...def, sid: next() }] }));
  },
  close(sid?: number) {
    ui.set((s) => ({ sheets: sid === undefined ? s.sheets.slice(0, -1) : s.sheets.filter((x) => x.sid !== sid) }));
  },
  closeAll() {
    ui.set({ sheets: [] });
  },
};

export function openMenu(menu: MenuDef) {
  ui.set({ menu });
}
export function closeMenu() {
  ui.set({ menu: null });
}

export function confirmDialog(opts: Omit<ConfirmDef, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    ui.set({
      confirm: {
        ...opts,
        resolve: (ok) => {
          ui.set({ confirm: null });
          resolve(ok);
        },
      },
    });
  });
}

// ---------- toasts ----------

let toastTimer: number | undefined;
export function showToast(message: string, kind: ToastDef['kind'] = 'info', action?: ToastDef['action']) {
  const id = next();
  ui.set({ toast: { id, message, kind, action } });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (ui.get().toast?.id === id) ui.set({ toast: null });
  }, action ? 6000 : kind === 'error' ? 5000 : 2600);
}
export const toastError = (message: string) => showToast(message, 'error');
export function dismissToast() {
  ui.set({ toast: null });
}

// keep the "offline" banner honest
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => ui.set({ online: true }));
  window.addEventListener('offline', () => ui.set({ online: false }));
}
