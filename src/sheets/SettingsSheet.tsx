// Settings: appearance, offline status, storage, housekeeping and install help.

import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { Segmented, Switch } from '../components/Controls';
import { requestPersistence, storageInfo, type StorageInfo } from '../lib/db';
import { formatBytes, plural } from '../lib/format';
import { hasSamples, removeSamples } from '../lib/samples';
import { clearHistory, resetEverything, useLibrary, verifyLibrary } from '../store/library';
import { setPref, usePrefs } from '../store/prefs';
import { confirmDialog, showToast, sheets } from '../store/ui';
import type { Preferences } from '../types';

function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="group">
      {title ? <h3 className="group-title">{title}</h3> : null}
      <div className="group-card">{children}</div>
      {footer ? <p className="group-footer">{footer}</p> : null}
    </section>
  );
}

function Line({ label, value, onClick, destructive, icon, disabled }: { label: string; value?: ReactNode; onClick?: () => void; destructive?: boolean; icon?: string; disabled?: boolean }) {
  const inner = (
    <>
      {icon ? <Icon name={icon} size={20} /> : null}
      <span className="line-label">{label}</span>
      {value !== undefined ? <span className="line-value">{value}</span> : null}
    </>
  );
  return onClick ? (
    <button className={`line${destructive ? ' destructive' : ''}`} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  ) : (
    <div className="line">{inner}</div>
  );
}

type ShellState = 'checking' | 'ready' | 'pending' | 'unsupported';

function useShellStatus(): ShellState {
  const [state, setState] = useState<ShellState>('checking');
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) return alive && setState('unsupported');
      try {
        const keys = await caches.keys();
        const cached = keys.some((k) => k.startsWith('aurora-shell-'));
        if (alive) setState(cached && !!(await navigator.serviceWorker.getRegistration()) ? 'ready' : 'pending');
      } catch {
        if (alive) setState('unsupported');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const standalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function SettingsSheet({ sid }: { sid: number }) {
  const appearance = usePrefs((s) => s.appearance);
  const lyricsBackground = usePrefs((s) => s.lyricsBackground);
  const songCount = useLibrary((s) => s.tracks.length);
  const totalBytes = useLibrary((s) => s.totalBytes);
  const playlistCount = useLibrary((s) => s.playlists.length);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const shell = useShellStatus();
  const installed = standalone();
  const refresh = () => void storageInfo().then(setStorage);
  useEffect(refresh, []);

  const protect = async () => {
    const ok = await requestPersistence();
    refresh();
    showToast(ok ? 'Your music is protected from automatic clean-up.' : 'iPhone decides this by itself. Adding the app to your Home Screen gives the best protection.', ok ? 'success' : 'info');
  };

  const check = async () => {
    const missing = await verifyLibrary();
    showToast(missing ? `${plural(missing, 'song')} could not be found on this device. They are marked as unavailable.` : 'All your songs are stored safely.', missing ? 'error' : 'success');
  };

  const wipeHistory = async () => {
    const ok = await confirmDialog({
      title: 'Clear listening history?',
      message: 'This resets “Recently Played”, play counts, Heavy Rotation and Made For You. Your songs and playlists are not touched.',
      confirmLabel: 'Clear History',
      destructive: true,
    });
    if (ok) {
      await clearHistory();
      showToast('Listening history cleared', 'success');
    }
  };

  const dropSamples = async () => {
    const n = await removeSamples();
    showToast(`${plural(n, 'sample song')} removed`, 'success');
  };

  const wipeAll = async () => {
    const ok = await confirmDialog({
      title: 'Delete all music?',
      message: `This removes all ${plural(songCount, 'song')}, playlists and lyrics saved in Aurora Music on this device. Your original files in the Files app are not deleted.`,
      confirmLabel: 'Delete Everything',
      destructive: true,
    });
    if (ok) {
      await resetEverything();
      sheets.closeAll();
      showToast('Your library is empty', 'success');
    }
  };

  const shellText: Record<ShellState, string> = {
    checking: 'Checking…',
    ready: 'Ready to open offline',
    pending: 'Not saved yet. Open once online from the installed app.',
    unsupported: 'Not available in this browser',
  };

  return (
    <Sheet sid={sid} title="Settings" large right={{ label: 'Done' }}>
      <div className="settings">
        <Group title="Appearance">
          <div className="line stacked">
            <Segmented<Preferences['appearance']>
              label="Appearance"
              value={appearance}
              onChange={(v) => setPref('appearance', v)}
              options={[
                { value: 'system', label: 'Automatic' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>
          <div className="line">
            <span className="line-label">Blurred artwork behind lyrics</span>
            <Switch checked={lyricsBackground} onChange={(v) => setPref('lyricsBackground', v)} label="Blurred artwork behind lyrics" />
          </div>
        </Group>

        <Group title="Offline" footer="The app and your music are stored separately. The app files let Aurora open with no internet. Your songs are copied into this device’s storage when you import them.">
          <Line icon="offline" label="App" value={shellText[shell]} />
          <Line icon="note" label="Music" value={`${plural(songCount, 'song')} · ${formatBytes(totalBytes)} on this device`} />
          <Line icon="add-playlist" label="Playlists" value={String(playlistCount)} />
        </Group>

        <Group title="Storage" footer="Deleting a song here removes only Aurora Music’s copy. The original file in the Files app stays where it is.">
          <Line label="Used by Aurora Music" value={storage ? formatBytes(storage.usage) : '…'} />
          {storage?.quota ? <Line label="Space available to the app" value={formatBytes(Math.max(0, storage.quota - storage.usage))} /> : null}
          <Line
            label="Protected from clean-up"
            value={storage?.persisted === null ? 'Unknown' : storage?.persisted ? 'Yes' : 'Not yet'}
            onClick={storage?.persisted ? undefined : protect}
          />
        </Group>

        <Group title="Install on iPhone">
          {installed ? (
            <Line icon="check" label="Installed" value="Opened from the Home Screen" />
          ) : (
            <ol className="install-steps">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button <Icon name="share" size={16} className="inline-ico" />.</li>
              <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              <li>Open <b>Aurora</b> from your Home Screen. It also protects your music from Safari’s clean-up of unused websites.</li>
            </ol>
          )}
        </Group>

        <Group title="Library">
          <Line icon="check" label="Check for Missing Songs" onClick={check} />
          <Line icon="clock" label="Clear Listening History" onClick={wipeHistory} />
          {hasSamples() ? <Line icon="trash" label="Remove Sample Songs" onClick={dropSamples} /> : null}
          <Line icon="trash" label="Delete All Music…" onClick={wipeAll} destructive disabled={!songCount} />
        </Group>

        <Group title="About" footer="Aurora Music is a personal, offline player. It has no account, no ads and no tracking. Your listening history never leaves this device.">
          <Line label="Version" value="1.0.0" />
          <Line label="Not affiliated with Apple" value="Inspired by Apple Music’s design" />
        </Group>
      </div>
    </Sheet>
  );
}
