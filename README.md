# Aurora Music

A private, offline music player for the songs you own, inspired by Apple Music. It runs as an installable web app (PWA) and is designed for iPhone 11 and newer. Nothing is uploaded anywhere: your songs, playlists and lyrics stay on your phone.

## What it does
- Five tabs: Listen Now, Browse, Radio, Library, Search, with a mini player and a full Now Playing screen.
- Imports MP3, M4A/AAC, FLAC and WAV files from the Files app. Reads title, artist, album, genre, track number, year and cover art.
- Albums, artists, genres, favorites, recently added/played, most played, playlists and automatic "mixes" (built from artists and genres you pick).
- Queue (play next, add to queue, drag to reorder), shuffle, repeat, lock-screen controls.
- Lyrics: paste lyrics or import a `.lrc`/`.txt` file. `.lrc` lyrics highlight in time with the song. Nothing is downloaded, and no lyrics are included.
- Works offline once opened one time. Dark and light themes, reduced-motion support, screen-reader labels.
- "Radio" means shuffle stations made from your own library (no internet radio).

## Run it on your computer
```
npm install
npm run dev        # development
npm run build      # production build into dist/
npm run preview    # try the production build
npm test           # browser test at iPhone size (needs: npm run build first, and ffmpeg)
```

## Put it on your iPhone
A PWA must be served over **HTTPS**. Upload the `dist/` folder to any free static host, for example Netlify Drop (drag the folder onto app.netlify.com/drop), Cloudflare Pages or GitHub Pages. Then:
1. Open the address in **Safari** on the iPhone.
2. Tap Share, then **Add to Home Screen**.
3. Open **Aurora** from the Home Screen once while online so it saves itself.
4. Download songs to the Files app, open Aurora, tap **Library > +** (or Import Music) and choose them.

Installing to the Home Screen matters: Safari may erase storage of websites you have not opened for a week, but installed apps are protected.

## Honest limits on iPhone
- The volume slider is hidden because iOS does not let web apps set volume. Use the side buttons.
- Some formats (OGG, Opus, WMA) do not play in Safari. Convert them to MP3 or M4A.
- If the iPhone is very low on storage, Safari can refuse to save songs. Aurora tells you when that happens.
- The app files and your music are stored separately. The app opens offline after the first visit. Your songs are stored on the device when imported.
- Updating the app: after a new build is deployed, close and reopen the app twice to pick it up.

## Project layout
- `src/store` data and state (library, player, UI), `src/lib` importing, tags, search, storage
- `src/components`, `src/screens`, `src/sheets` the interface
- `src-sw/sw.template.js` service worker (filled in at build time by `vite.config.ts`)
- `tests/run.ts` end-to-end test
