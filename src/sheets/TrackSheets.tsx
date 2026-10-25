// Sheets about one song: details, edit info, lyrics editor, add to a playlist.

import { useEffect, useRef, useState } from 'react';
import { Sheet, useSheet } from '../components/Sheet';
import { Artwork } from '../components/Artwork';
import { Field } from '../components/Controls';
import { Icon } from '../components/Icon';
import { PlaylistArt } from '../components/Cards';
import { removeFromLibrary } from '../actions';
import { forgetArtwork, processArtwork } from '../lib/artwork';
import { store } from '../lib/db';
import { trackAlbumKey } from '../lib/indexing';
import { formatBytes, formatTime, plural, relativeDay } from '../lib/format';
import { looksSynced, parseLyrics } from '../lib/lyrics';
import { addToPlaylist, deleteLyrics, getLyrics, playlistTrackIds, saveLyrics, trackById, updateTrack, useLibrary } from '../store/library';
import { confirmDialog, showToast, sheets } from '../store/ui';

// ---------- Song Info ----------

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function TrackInfoSheet({ sid, trackId }: { sid: number; trackId: string }) {
  const track = useLibrary((s) => s.byId.get(trackId));
  if (!track) return null;
  const mimeLabel = track.mime.replace('audio/', '').replace('x-', '').toUpperCase();
  return (
    <Sheet sid={sid} title="Song Info" large right={{ label: 'Done' }}>
      <div className="info-sheet">
        <div className="info-art">
          <Artwork artId={track.artId} seed={track.album + track.artist} kind="full" />
        </div>
        <h3 className="info-title">{track.title}</h3>
        <p className="info-artist">{track.artist}</p>
        <div className="group-card details">
          <Detail label="Album" value={track.album} />
          {track.albumArtist ? <Detail label="Album artist" value={track.albumArtist} /> : null}
          <Detail label="Genre" value={track.genre || 'Not set'} />
          <Detail label="Track" value={track.trackNo ? String(track.trackNo) : 'Not set'} />
          <Detail label="Year" value={track.year ? String(track.year) : 'Not set'} />
          <Detail label="Length" value={formatTime(track.duration)} />
          <Detail label="File name" value={track.fileName} />
          <Detail label="Format" value={`${mimeLabel} · ${formatBytes(track.size)}`} />
          <Detail label="Added" value={relativeDay(track.addedAt)} />
          <Detail label="Plays" value={String(track.playCount)} />
          <Detail label="Last played" value={track.lastPlayedAt ? relativeDay(track.lastPlayedAt) : 'Never'} />
          <Detail label="Lyrics" value={track.hasLyrics ? 'Saved on this device' : 'None'} />
        </div>
        <div className="stack">
          <button className="btn-pill block" onClick={() => sheets.open({ type: 'editTrack', trackId })}>
            <Icon name="edit" size={19} />
            Edit Song Info
          </button>
          <button className="btn-pill block" onClick={() => sheets.open({ type: 'lyricsEditor', trackId })}>
            <Icon name="lyrics" size={19} />
            {track.hasLyrics ? 'Edit Lyrics' : 'Add Lyrics'}
          </button>
          <button
            className="btn-pill block danger"
            onClick={async () => {
              if (await removeFromLibrary([trackId])) sheets.close(sid);
            }}
          >
            Remove from Library
          </button>
        </div>
        <p className="footnote">“Remove” deletes only Aurora Music’s copy. The original file in the Files app is not touched.</p>
      </div>
    </Sheet>
  );
}

// ---------- Edit song info ----------

function EditTrackForm({ trackId }: { trackId: string }) {
  const { close } = useSheet();
  const track = trackById(trackId);
  const [title, setTitle] = useState(track?.title ?? '');
  const [artist, setArtist] = useState(track?.artist ?? '');
  const [album, setAlbum] = useState(track?.album ?? '');
  const [genre, setGenre] = useState(track?.genre ?? '');
  const [trackNo, setTrackNo] = useState(track?.trackNo ? String(track.trackNo) : '');
  const [year, setYear] = useState(track?.year ? String(track.year) : '');
  const titleError = title.trim() ? null : 'A song needs a title.';
  const [artId, setArtId] = useState<string | undefined>(track?.artId);
    const [wholeAlbum, setWholeAlbum] = useState(true);
  const picker = useRef<HTMLInputElement>(null);
  const albumIds = useLibrary((s) => (track ? s.albums.get(trackAlbumKey(track))?.trackIds ?? [trackId] : [trackId]));

  const pickArt = async (file: File | undefined) => {
    if (!file) return;
    const rec = await processArtwork(file, file.type || 'image/jpeg');
    if (!rec) return showToast('That picture could not be read. Try a JPG or PNG.', 'error');
    await store.put('artwork', rec);
    forgetArtwork(rec.id);
    setArtId(rec.id);
  };

  const save = async () => {
    if (titleError) return;
    if (artId !== track?.artId) {
      for (const id of wholeAlbum ? albumIds : [trackId]) updateTrack(id, { artId });
    }
    updateTrack(trackId, {
      title: title.trim(),
      artist: artist.trim() || 'Unknown Artist',
      album: album.trim() || 'Unknown Album',
      genre: genre.trim(),
      trackNo: Math.max(0, parseInt(trackNo, 10) || 0),
      year: Math.max(0, parseInt(year, 10) || 0),
    });
    showToast('Song info saved', 'success');
    close();
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="art-edit">
        <div className="art-edit-img"><Artwork artId={artId} seed={(album || 'Unknown Album') + (artist || 'Unknown Artist')} kind="full" /></div>
        <div className="art-edit-btns">
          <button type="button" className="btn-pill" onClick={() => picker.current?.click()}>
            <Icon name="photo" size={19} />
            {artId ? 'Change Artwork' : 'Choose Artwork'}
          </button>
          {artId ? (
            <button type="button" className="btn-pill danger" onClick={() => { setArtId(undefined); }}>Remove Artwork</button>
          ) : null}
          {albumIds.length > 1 ? (
            <label className="art-edit-all">
              <input type="checkbox" checked={wholeAlbum} onChange={(e) => setWholeAlbum(e.target.checked)} />
              Use for all {albumIds.length} songs on this album
            </label>
          ) : null}
        </div>
        <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => void pickArt(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      </div>
      <Field label="Title" error={titleError}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Artist">
        <input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Album">
        <input value={album} onChange={(e) => setAlbum(e.target.value)} maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Genre">
        <input value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={80} autoComplete="off" />
      </Field>
      <div className="form-row">
        <Field label="Track number">
          <input inputMode="numeric" value={trackNo} onChange={(e) => setTrackNo(e.target.value.replace(/\D/g, ''))} maxLength={3} />
        </Field>
        <Field label="Year">
          <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} maxLength={4} />
        </Field>
      </div>
      <button type="submit" className="btn-pill primary block" disabled={!!titleError}>
        Save
      </button>
    </form>
  );
}

export function EditTrackSheet({ sid, trackId }: { sid: number; trackId: string }) {
  return (
    <Sheet sid={sid} title="Edit Song Info" large left={{ label: 'Cancel' }}>
      <EditTrackForm trackId={trackId} />
    </Sheet>
  );
}

// ---------- Lyrics editor ----------

function LyricsForm({ trackId }: { trackId: string }) {
  const { close } = useSheet();
  const track = trackById(trackId);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<'manual' | 'imported'>('manual');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getLyrics(trackId).then((r) => {
      if (!alive) return;
      setText(r?.text ?? '');
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [trackId]);

  const parsed = text.trim() ? parseLyrics(text) : null;
  const lineCount = parsed ? parsed.lines.filter((l) => l.text).length : 0;

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 500_000) return showToast('That file is too large to be lyrics.', 'error');
    const content = await f.text();
    if (content.includes('\u0000')) return showToast('That does not look like a text file.', 'error');
    setText(content);
    setSource('imported');
  };

  const save = async () => {
    await saveLyrics(trackId, text, source);
    showToast(text.trim() ? 'Lyrics saved on this device' : 'Lyrics removed', 'success');
    close();
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: 'Remove these lyrics?', message: 'They will be deleted from this device.', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    await deleteLyrics(trackId);
    showToast('Lyrics removed', 'success');
    close();
  };

  return (
    <div className="form lyrics-form">
      <p className="form-hint">
        Paste lyrics for <b>{track?.title ?? 'this song'}</b>. Only use lyrics you have the right to use. For lines that light up in time with the music, start each line with a time, like <code>[01:23.50] Words here</code> (an .lrc file).
      </p>
      <textarea
        className="lyrics-input"
        aria-label="Lyrics"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSource('manual');
        }}
        placeholder={loaded ? 'Paste or type lyrics here…' : 'Loading…'}
        rows={11}
        spellCheck={false}
      />
      <div className="lyrics-meta">
        {parsed ? (
          <span>
            {parsed.synced ? <Icon name="clock" size={14} /> : <Icon name="lyrics" size={14} />}
            {parsed.synced ? `Synchronised · ${plural(lineCount, 'line')}` : `Plain text · ${plural(lineCount, 'line')}`}
          </span>
        ) : (
          <span>Nothing entered yet</span>
        )}
      </div>
      <input ref={file} type="file" hidden onChange={(e) => void readFile(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <div className="stack">
        <button className="btn-pill block" onClick={() => file.current?.click()}>
          <Icon name="import" size={19} />
          Import .lrc or .txt File…
        </button>
        <button className="btn-pill primary block" onClick={save} disabled={!loaded}>
          Save Lyrics
        </button>
        {track?.hasLyrics ? (
          <button className="btn-pill block danger" onClick={remove}>
            Remove Lyrics
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LyricsEditorSheet({ sid, trackId }: { sid: number; trackId: string }) {
  return (
    <Sheet sid={sid} title="Lyrics" large left={{ label: 'Cancel' }}>
      <LyricsForm trackId={trackId} />
    </Sheet>
  );
}

// ---------- Add to playlist ----------

function AddToPlaylistList({ trackIds }: { trackIds: string[] }) {
  const { close } = useSheet();
  const playlists = useLibrary((s) => s.playlists).filter((p) => p.kind === 'manual');
  const sorted = playlists.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="list">
      <button
        className="row"
        onClick={() => {
          sheets.open({ type: 'playlistEditor', trackIds });
          close();
        }}
      >
        <div className="row-art new-playlist-art">
          <Icon name="plus" size={24} />
        </div>
        <div className="grow">
          <div className="title accent">New Playlist…</div>
        </div>
      </button>
      {sorted.map((p) => {
        const have = new Set(playlistTrackIds(p));
        const all = trackIds.every((id) => have.has(id));
        return (
          <button
            key={p.id}
            className="row"
            disabled={all}
            onClick={() => {
              const n = addToPlaylist(p.id, trackIds);
              showToast(n ? `Added to “${p.name}”` : `Already in “${p.name}”`, n ? 'success' : 'info');
              close();
            }}
          >
            <div className="row-art">
              <PlaylistArt playlist={p} />
            </div>
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="sub">{all ? 'Already added' : plural(have.size, 'song')}</div>
            </div>
            {all ? <Icon name="check" size={18} className="done-check" /> : null}
          </button>
        );
      })}
      {!sorted.length ? <p className="footnote center">You have no playlists yet. Create one to start collecting songs.</p> : null}
    </div>
  );
}

export function AddToPlaylistSheet({ sid, trackIds }: { sid: number; trackIds: string[] }) {
  return (
    <Sheet sid={sid} title="Add to Playlist" large left={{ label: 'Cancel' }}>
      <AddToPlaylistList trackIds={trackIds} />
    </Sheet>
  );
}

export { looksSynced };
