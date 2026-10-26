// Create / edit a playlist, create / edit a mix, and add songs to a playlist.

import { useMemo, useRef, useState } from 'react';
import { Sheet, useSheet } from '../components/Sheet';
import { Artwork, CollageArt } from '../components/Artwork';
import { Field } from '../components/Controls';
import { Icon } from '../components/Icon';
import { artIdsFor } from '../components/Cards';
import { removePlaylist } from '../actions';
import { store } from '../lib/db';
import { forgetArtwork, processArtwork } from '../lib/artwork';
import { normalize, plural } from '../lib/format';
import { addToPlaylist, createPlaylist, playlistTrackIds, updatePlaylist, useLibrary, validatePlaylistName } from '../store/library';
import { nav, showToast, sheets } from '../store/ui';
import type { ArtworkRec } from '../types';

// ---------- playlist editor ----------

function PlaylistForm({ id, initialTrackIds }: { id?: string; initialTrackIds?: string[] }) {
  const { close } = useSheet();
  const lib = useLibrary((s) => s);
  const existing = id ? lib.playlistById.get(id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [coverArtId, setCoverArtId] = useState<string | undefined>(existing?.coverArtId);
  const [newArt, setNewArt] = useState<ArtworkRec | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const photo = useRef<HTMLInputElement>(null);

  const error = validatePlaylistName(name, id);
  const showError = touched ? error : null;

  // pictures the user can pick as a cover: from this playlist's songs first, then the rest of the library
  const choices = useMemo(() => {
    const own = existing ? playlistTrackIds(existing, lib) : initialTrackIds ?? [];
    const ids = [...artIdsFor(own, 8)];
    for (const a of artIdsFor(lib.tracks.map((t) => t.id), 12)) if (!ids.includes(a)) ids.push(a);
    return ids.slice(0, 12);
  }, [existing, initialTrackIds, lib]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const rec = await processArtwork(file, file.type || 'image/jpeg');
    if (!rec) return showToast('That picture could not be read. Try a JPG or PNG.', 'error');
    try {
      await store.put('artwork', rec);
    } catch {
      return showToast('Could not save that picture.', 'error');
    }
    forgetArtwork(rec.id);
    setNewArt(rec);
    setCoverArtId(rec.id);
  };

  const save = async () => {
    setTouched(true);
    if (error || busy) return;
    setBusy(true);
    try {
      if (newArt) await store.put('artwork', newArt);
      if (existing) {
        updatePlaylist(existing.id, { name: name.trim(), description: description.trim(), coverArtId });
        showToast('Playlist saved', 'success');
        close();
      } else {
        const p = await createPlaylist({ name, description, trackIds: initialTrackIds, coverArtId });
        close();
        if (initialTrackIds?.length) showToast(`“${p.name}” created`, 'success');
        else {
          nav.push({ kind: 'playlist', id: p.id });
          sheets.open({ type: 'addSongs', playlistId: p.id });
        }
      }
    } catch {
      showToast('The playlist could not be saved. Please try again.', 'error');
    }
    setBusy(false);
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="cover-preview">
        {coverArtId ? <Artwork artId={coverArtId} seed={name} kind="full" /> : <CollageArt artIds={choices.slice(0, 4)} seed={name || 'new playlist'} kind="full" />}
      </div>
      <button type="button" className="btn-pill block" onClick={() => photo.current?.click()}>
        <Icon name="photo" size={19} />
        {coverArtId && !choices.includes(coverArtId) ? 'Change Photo' : 'Choose Photo'}
      </button>
      <Field label="Name" error={showError}>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} maxLength={70} placeholder="My Playlist" autoComplete="off" enterKeyHint="done" />
      </Field>
      <Field label="Description (optional)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="What is this playlist for?" />
      </Field>

      <div className="field">
        <span className="field-label">Cover</span>
        <div className="cover-choices" role="radiogroup" aria-label="Cover picture">
          <button type="button" role="radio" aria-checked={!coverArtId} className={`cover-choice auto${!coverArtId ? ' on' : ''}`} onClick={() => setCoverArtId(undefined)}>
            <Icon name="sparkle" size={22} />
            <span>Automatic</span>
          </button>
          <button type="button" className="cover-choice auto" onClick={() => photo.current?.click()}>
            <Icon name="photo" size={22} />
            <span>Choose Photo</span>
          </button>
          {choices.map((a) => (
            <button type="button" key={a} role="radio" aria-checked={coverArtId === a} aria-label="Use this cover" className={`cover-choice${coverArtId === a ? ' on' : ''}`} onClick={() => setCoverArtId(a)}>
              <Artwork artId={a} seed={a} />
              {coverArtId === a ? <span className="cover-check"><Icon name="check" size={14} /></span> : null}
            </button>
          ))}
        </div>
        <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      </div>

      <button type="submit" className="btn-pill primary block" disabled={busy}>
        {existing ? 'Save' : 'Create Playlist'}
      </button>
      {existing ? (
        <button type="button" className="btn-pill block danger" onClick={() => void removePlaylist(existing, close)}>
          Delete Playlist
        </button>
      ) : null}
    </form>
  );
}

export function PlaylistEditorSheet({ sid, id, trackIds }: { sid: number; id?: string; trackIds?: string[] }) {
  return (
    <Sheet sid={sid} title={id ? 'Edit Playlist' : 'New Playlist'} large left={{ label: 'Cancel' }}>
      <PlaylistForm id={id} initialTrackIds={trackIds} />
    </Sheet>
  );
}

// ---------- mix editor ----------

function Chips({ title, options, selected, onToggle }: { title: string; options: { key: string; label: string }[]; selected: Set<string>; onToggle: (k: string) => void }) {
  const [filter, setFilter] = useState('');
  const shown = options.filter((o) => !filter || normalize(o.label).includes(normalize(filter)));
  return (
    <div className="field">
      <span className="field-label">
        {title} {selected.size ? `· ${selected.size} chosen` : ''}
      </span>
      {options.length > 8 ? <input className="chip-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Find ${title.toLowerCase()}`} /> : null}
      <div className="chips">
        {shown.map((o) => (
          <button type="button" key={o.key} className={`chip${selected.has(o.key) ? ' on' : ''}`} aria-pressed={selected.has(o.key)} onClick={() => onToggle(o.key)}>
            {selected.has(o.key) ? <Icon name="check" size={13} /> : null}
            {o.label}
          </button>
        ))}
        {!shown.length ? <span className="chip-none">Nothing found</span> : null}
      </div>
    </div>
  );
}

function MixForm({ id }: { id?: string }) {
  const { close } = useSheet();
  const lib = useLibrary((s) => s);
  const existing = id ? lib.playlistById.get(id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [artists, setArtists] = useState(new Set(existing?.rules?.artists ?? []));
  const [genres, setGenres] = useState(new Set(existing?.rules?.genres ?? []));
  const [touched, setTouched] = useState(false);

  const flip = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    apply(next);
  };

  const nameError = validatePlaylistName(name, id);
  const needsChoice = artists.size + genres.size === 0 ? 'Choose at least one artist or genre.' : null;
  const count = useMemo(() => {
    const names = new Set(Array.from(genres).map((g) => g.toLowerCase()));
    return lib.tracks.filter((t) => !t.missing && (artists.has(normalize(t.artist.split(/,|;|feat\.?|ft\./i)[0])) || names.has(t.genre.toLowerCase()))).length;
  }, [lib.tracks, artists, genres]);

  const save = async () => {
    setTouched(true);
    if (nameError || needsChoice) return;
    const rules = { artists: Array.from(artists), genres: Array.from(genres) };
    if (existing) updatePlaylist(existing.id, { name: name.trim(), rules });
    else await createPlaylist({ name, kind: 'mix', rules });
    showToast(existing ? 'Mix saved' : `“${name.trim()}” created`, 'success');
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
      <p className="form-hint">A mix fills itself from the artists and genres you choose. When you import new songs that match, they join the mix automatically.</p>
      <Field label="Name" error={touched ? nameError : null}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={70} placeholder="Evening Chill" autoComplete="off" />
      </Field>
      <Chips title="Artists" options={lib.artistList.map((a) => ({ key: a.key, label: a.name }))} selected={artists} onToggle={(k) => flip(artists, k, setArtists)} />
      <Chips title="Genres" options={lib.genreList.map((g) => ({ key: g.name, label: g.name }))} selected={genres} onToggle={(k) => flip(genres, k, setGenres)} />
      {touched && needsChoice ? <p className="field-error" role="alert">{needsChoice}</p> : null}
      <p className="form-hint">{plural(count, 'song')} match right now.</p>
      <button type="submit" className="btn-pill primary block">
        {existing ? 'Save Mix' : 'Create Mix'}
      </button>
      {existing ? (
        <button type="button" className="btn-pill block danger" onClick={() => void removePlaylist(existing, close)}>
          Delete Mix
        </button>
      ) : null}
    </form>
  );
}

export function MixEditorSheet({ sid, id }: { sid: number; id?: string }) {
  return (
    <Sheet sid={sid} title={id ? 'Edit Mix' : 'New Mix'} large left={{ label: 'Cancel' }}>
      <MixForm id={id} />
    </Sheet>
  );
}

// ---------- add songs to a playlist ----------

function AddSongsList({ playlistId }: { playlistId: string }) {
  const { close } = useSheet();
  const lib = useLibrary((s) => s);
  const playlist = lib.playlistById.get(playlistId);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const inside = useMemo(() => new Set(playlist?.trackIds ?? []), [playlist]);

  const candidates = useMemo(() => {
    const q = normalize(query);
    return lib.tracks
      .filter((t) => !t.missing && !inside.has(t.id) && (!q || normalize(`${t.title} ${t.artist} ${t.album}`).includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 300);
  }, [lib.tracks, inside, query]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const add = () => {
    const n = addToPlaylist(playlistId, chosen);
    showToast(`${plural(n, 'song')} added`, 'success');
    close();
  };

  return (
    <>
      <div className="sheet-search">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your songs" aria-label="Search your songs" />
      </div>
      <div className="list">
        {candidates.map((t) => {
          const on = chosen.includes(t.id);
          return (
            <button key={t.id} className="row" role="checkbox" aria-checked={on} onClick={() => toggle(t.id)}>
              <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" size={14} /> : null}</span>
              <div className="row-art">
                <Artwork artId={t.artId} seed={t.album + t.artist} />
              </div>
              <div className="grow">
                <div className="title">{t.title}</div>
                <div className="sub">{t.artist}</div>
              </div>
            </button>
          );
        })}
        {!candidates.length ? <p className="footnote center">{query ? 'No songs match your search.' : 'Every song in your library is already in this playlist.'}</p> : null}
      </div>
      <div className="sheet-footer">
        <button className="btn-pill primary block" disabled={!chosen.length} onClick={add}>
          {chosen.length ? `Add ${plural(chosen.length, 'Song')}` : 'Choose songs to add'}
        </button>
      </div>
    </>
  );
}

export function AddSongsSheet({ sid, playlistId }: { sid: number; playlistId: string }) {
  return (
    <Sheet sid={sid} title="Add Songs" large left={{ label: 'Cancel' }}>
      <AddSongsList playlistId={playlistId} />
    </Sheet>
  );
}
