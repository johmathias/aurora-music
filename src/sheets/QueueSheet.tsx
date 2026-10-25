// "Playing Next": see what is coming, drag to reorder, remove songs, jump to a song.

import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Artwork } from '../components/Artwork';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/Screen';
import { useReorder } from '../hooks';
import { clearUpNext, cycleRepeat, jumpTo, moveInQueue, removeFromQueue, setShuffle, usePlayer } from '../store/player';
import { useLibrary } from '../store/library';
import { plural } from '../lib/format';

export function QueueSheet({ sid }: { sid: number }) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const byId = useLibrary((s) => s.byId);
  const [showHistory, setShowHistory] = useState(false);

  const upcoming = queue.slice(index + 1);
  const history = queue.slice(0, Math.max(0, index));
  const current = queue[index];
  const { handleProps, rowStyle } = useReorder(upcoming.length, 64, (from, to) => moveInQueue(index + 1 + from, index + 1 + to));

  const rowFor = (uid: string, trackId: string, onPlay: () => void, extra?: React.ReactNode) => {
    const t = byId.get(trackId);
    if (!t) return null;
    return (
      <>
        <button className="q-main" onClick={onPlay} aria-label={`Play ${t.title}`}>
          <div className="row-art">
            <Artwork artId={t.artId} seed={t.album + t.artist} />
          </div>
          <div className="grow">
            <div className="title">{t.title}</div>
            <div className="sub">{t.artist}</div>
          </div>
        </button>
        {extra}
        <span hidden>{uid}</span>
      </>
    );
  };

  return (
    <Sheet sid={sid} title="Queue" large right={{ label: 'Done' }}>
      {!queue.length || !current ? (
        <EmptyState icon="queue" title="The queue is empty" text="Play a song, or choose “Play Next” or “Play Last” from a song’s menu." />
      ) : (
        <div className="queue">
          <div className="queue-tools">
            <button className={`pill-toggle${shuffle ? ' on' : ''}`} aria-pressed={shuffle} onClick={() => setShuffle(!shuffle)}>
              <Icon name="shuffle" size={18} />
              Shuffle {shuffle ? 'On' : 'Off'}
            </button>
            <button className={`pill-toggle${repeat !== 'off' ? ' on' : ''}`} aria-pressed={repeat !== 'off'} onClick={cycleRepeat}>
              <Icon name={repeat === 'one' ? 'repeat1' : 'repeat'} size={18} />
              Repeat {repeat === 'off' ? 'Off' : repeat === 'all' ? 'All' : 'One'}
            </button>
          </div>

          {history.length ? (
            <>
              <button className="queue-disclosure" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
                <span>History · {plural(history.length, 'song')}</span>
                <Icon name={showHistory ? 'chevron-down' : 'chevron-right'} size={15} />
              </button>
              {showHistory
                ? history.map((q, i) => (
                    <div className="queue-row dim" key={q.uid}>
                      {rowFor(q.uid, q.trackId, () => jumpTo(i))}
                    </div>
                  ))
                : null}
            </>
          ) : null}

          <h3 className="queue-head">Now Playing</h3>
          <div className="queue-row current">{rowFor(current.uid, current.trackId, () => jumpTo(index))}</div>

          <div className="queue-head-row">
            <h3 className="queue-head">Playing Next</h3>
            {upcoming.length ? (
              <button className="link-btn" onClick={clearUpNext}>
                Clear
              </button>
            ) : null}
          </div>
          {upcoming.length ? (
            upcoming.map((q, i) => (
              <div className="queue-row reorder-row" key={q.uid} style={rowStyle(i)}>
                {rowFor(
                  q.uid,
                  q.trackId,
                  () => jumpTo(index + 1 + i),
                  <>
                    <button className="q-remove" aria-label="Remove from queue" onClick={() => removeFromQueue(q.uid)}>
                      <Icon name="close" size={16} />
                    </button>
                    <span className="grip" role="button" aria-label="Drag to reorder" {...handleProps(i)}>
                      <Icon name="reorder" size={20} />
                    </span>
                  </>,
                )}
              </div>
            ))
          ) : (
            <p className="queue-note">Nothing is lined up after this song{repeat === 'all' ? ', so the queue starts over.' : '.'}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
