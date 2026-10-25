import { ImportSheet } from './ImportSheet';
import { QueueSheet } from './QueueSheet';
import { SettingsSheet } from './SettingsSheet';
import { AddSongsSheet, MixEditorSheet, PlaylistEditorSheet } from './PlaylistSheets';
import { AddToPlaylistSheet, EditTrackSheet, LyricsEditorSheet, TrackInfoSheet } from './TrackSheets';
import { useUi } from '../store/ui';

/** Draws every open sheet, in the order they were opened. */
export function SheetHost() {
  const sheets = useUi((s) => s.sheets);
  return (
    <>
      {sheets.map((s) => {
        switch (s.type) {
          case 'import': return <ImportSheet key={s.sid} sid={s.sid} />;
          case 'queue': return <QueueSheet key={s.sid} sid={s.sid} />;
          case 'settings': return <SettingsSheet key={s.sid} sid={s.sid} />;
          case 'trackInfo': return <TrackInfoSheet key={s.sid} sid={s.sid} trackId={s.trackId} />;
          case 'editTrack': return <EditTrackSheet key={s.sid} sid={s.sid} trackId={s.trackId} />;
          case 'lyricsEditor': return <LyricsEditorSheet key={s.sid} sid={s.sid} trackId={s.trackId} />;
          case 'addToPlaylist': return <AddToPlaylistSheet key={s.sid} sid={s.sid} trackIds={s.trackIds} />;
          case 'playlistEditor': return <PlaylistEditorSheet key={s.sid} sid={s.sid} id={s.id} trackIds={s.trackIds} />;
          case 'mixEditor': return <MixEditorSheet key={s.sid} sid={s.sid} id={s.id} />;
          case 'addSongs': return <AddSongsSheet key={s.sid} sid={s.sid} playlistId={s.playlistId} />;
          default: return null;
        }
      })}
    </>
  );
}
