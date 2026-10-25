// "Import Music": pick songs from the Files app. Shows progress, duplicates and any problems.

import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { importFiles, type ImportItem, type ImportSummary } from '../lib/importer';
import { installSamples } from '../lib/samples';
import { storageInfo, type StorageInfo } from '../lib/db';
import { formatBytes, plural } from '../lib/format';
import { showToast, sheets } from '../store/ui';
import { library, saveLyrics, useLibrary } from '../store/library';

// No "accept" list on the picker: iPhone greys out file types it does not know (like .lrc).
const isLyricsFile = (f: File) => /\.(lrc|txt)$/i.test(f.name);
const stem = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Attaches picked .lrc/.txt files to songs whose file name or title matches. Returns [attached, notMatched]. */
async function attachLyrics(files: File[]): Promise<[number, string[]]> {
  const tracks = library.get().tracks;
  let attached = 0;
  const missed: string[] = [];
  for (const f of files) {
    if (f.size > 500_000) { missed.push(f.name); continue; }
    const key = stem(f.name);
    const hit = tracks.find((t) => stem(t.fileName) === key) ?? tracks.find((t) => stem(t.title) === key) ?? tracks.find((t) => stem(`${t.artist} ${t.title}`) === key || stem(`${t.title} ${t.artist}`) === key);
    if (!hit) { missed.push(f.name); continue; }
    const text = await f.text();
    if (text.includes('\u0000') || !text.trim()) { missed.push(f.name); continue; }
    await saveLyrics(hit.id, text, 'imported');
    attached++;
  }
  return [attached, missed];
}

// Songs dropped onto the window (desktop) wait here until the sheet opens.
let pendingFiles: File[] | null = null;
export function openImportWith(files: File[]) {
  pendingFiles = files;
  sheets.open({ type: 'import' });
}

const statusText: Record<ImportItem['status'], string> = {
  queued: 'Waiting',
  working: 'Importing…',
  done: 'Added',
  duplicate: 'Already in library',
  failed: 'Not added',
};

export function ImportSheet({ sid }: { sid: number }) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [samples, setSamples] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const songCount = useLibrary((s) => s.tracks.length);
  const canPickFolder = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input') && !/iPhone|iPad|iPod/.test(navigator.userAgent);

  const refreshStorage = () => void storageInfo().then(setStorage);
  useEffect(refreshStorage, []);

  const run = async (picked: File[]) => {
    if (!picked.length) return;
    const lyricsFiles = picked.filter(isLyricsFile);
    const files = picked.filter((f) => !isLyricsFile(f));
    setPhase('working');
    setItems([]);
    const result = files.length ? await importFiles(files, setItems) : { added: 0, duplicates: 0, failed: 0, stoppedForSpace: false };
    setSummary(result);
    setPhase('done');
    refreshStorage();
    let lyricsNote = '';
    let lyricsOk = false;
    if (lyricsFiles.length) {
      const [attached, missed] = await attachLyrics(lyricsFiles);
      lyricsOk = attached > 0;
      lyricsNote = attached
        ? `${plural(attached, 'lyrics file')} attached${missed.length ? `, ${missed.length} had no matching song` : ''}`
        : 'No song matched that lyrics file name. Rename it to match the song file, or add it from the song’s lyrics screen.';
    }
    const songNote = result.added ? `${plural(result.added, 'song')} added` : result.duplicates && !result.failed ? 'Those songs were already in your library' : files.length ? 'No songs were added' : '';
    showToast([songNote, lyricsNote].filter(Boolean).join('. '), result.added || lyricsOk ? 'success' : files.length ? 'info' : 'error');
  };

  useEffect(() => {
    if (pendingFiles) {
      const files = pendingFiles;
      pendingFiles = null;
      void run(files);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSamples = async () => {
    setSamples('Making sample songs…');
    try {
      const n = await installSamples((done, total) => setSamples(`Making sample songs… ${done}/${total}`));
      showToast(n ? `${plural(n, 'sample song')} added` : 'Sample songs are already in your library', n ? 'success' : 'info');
    } catch {
      showToast('Sample songs could not be created.', 'error');
    }
    setSamples(null);
    refreshStorage();
  };

  const finished = items.filter((i) => i.status === 'done' || i.status === 'duplicate' || i.status === 'failed').length;
  const problems = items.filter((i) => i.status === 'failed');
  const usedPct = storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <Sheet sid={sid} title="Import Music" large right={{ label: 'Done', disabled: phase === 'working' }}>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void run(files);
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        // @ts-expect-error webkitdirectory is not in the standard typings
        webkitdirectory=""
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void run(files);
        }}
      />

      {phase === 'idle' ? (
        <div className="import-idle">
          <div className="import-hero">
            <div className="glyph">
              <Icon name="import" size={36} />
            </div>
            <h3>Add songs from your iPhone</h3>
            <p>Choose the songs you downloaded. They open from the Files app, usually in the Downloads folder.</p>
          </div>
          <div className="stack">
            <button className="btn-pill primary block" onClick={() => fileInput.current?.click()}>
              <Icon name="folder" size={20} />
              Choose Songs…
            </button>
            {canPickFolder ? (
              <button className="btn-pill block" onClick={() => folderInput.current?.click()}>
                Choose a Folder…
              </button>
            ) : null}
          </div>

          <ul className="facts">
            <li>
              <Icon name="check" size={16} />
              <span>Songs are <b>copied into Aurora Music</b>, so they keep playing with no internet.</span>
            </li>
            <li>
              <Icon name="check" size={16} />
              <span>MP3, M4A, AAC and WAV work best. Some other formats may not play on iPhone.</span>
            </li>
            <li>
              <Icon name="check" size={16} />
              <span>Pick <b>.lrc</b> lyrics files together with the songs. They attach to the song with the same name.</span>
            </li>
            <li>
              <Icon name="check" size={16} />
              <span>Removing a song here never deletes the original file from the Files app.</span>
            </li>
          </ul>

          {storage && storage.quota ? (
            <div className="storage-card">
              <div className="storage-row">
                <span>Storage used by Aurora Music</span>
                <b>{formatBytes(storage.usage)}</b>
              </div>
              <div className="meter" role="img" aria-label={`${usedPct.toFixed(1)} percent of available space used`}>
                <div style={{ width: `${Math.max(1.5, usedPct)}%` }} />
              </div>
              <p>{plural(songCount, 'song')} stored. About {formatBytes(Math.max(0, storage.quota - storage.usage))} can still be used.</p>
            </div>
          ) : null}

          <div className="sample-card">
            <div>
              <b>No music yet?</b>
              <p>Add a few original sample songs (made on your device) to try the player, lyrics and playlists.</p>
            </div>
            <button className="btn-pill" disabled={!!samples} onClick={addSamples}>
              {samples ?? 'Add Samples'}
            </button>
          </div>
        </div>
      ) : (
        <div className="import-run">
          <div className="import-progress">
            <div className="import-progress-text">
              <b>{phase === 'working' ? `Importing ${finished + 1 > items.length ? items.length : finished + 1} of ${items.length}…` : 'Import finished'}</b>
              <span>
                {summary
                  ? [summary.added && `${summary.added} added`, summary.duplicates && `${summary.duplicates} already there`, summary.failed && `${summary.failed} not added`].filter(Boolean).join(' · ')
                  : 'Keep this screen open until it finishes.'}
              </span>
            </div>
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={finished}>
              <div style={{ width: `${items.length ? (finished / items.length) * 100 : 0}%` }} />
            </div>
          </div>

          {summary?.stoppedForSpace ? (
            <div className="notice error" role="alert">
              <Icon name="warning" size={20} />
              <span>Your iPhone ran out of space for this app. Free some space, or remove songs you no longer need, then try again.</span>
            </div>
          ) : null}

          <ul className="import-list">
            {items.map((i) => (
              <li key={i.id} className={i.status}>
                <span className="import-ico" aria-hidden="true">
                  {i.status === 'done' ? <Icon name="check" size={16} /> : i.status === 'failed' ? <Icon name="warning" size={16} /> : i.status === 'working' ? <span className="spinner" /> : i.status === 'duplicate' ? <Icon name="album" size={16} /> : <Icon name="clock" size={16} />}
                </span>
                <div className="grow">
                  <div className="import-name">{i.name}</div>
                  <div className="import-msg">{i.message ?? statusText[i.status]}</div>
                </div>
                <span className="import-size">{formatBytes(i.size)}</span>
              </li>
            ))}
          </ul>

          {phase === 'done' ? (
            <div className="stack">
              {problems.length ? <p className="footnote">Songs that could not be added are listed above with the reason. You can try them again after fixing the problem.</p> : null}
              <button className="btn-pill block" onClick={() => setPhase('idle')}>
                Import More
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
