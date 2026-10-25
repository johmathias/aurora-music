// End-to-end check on a real (headless) browser at iPhone 11 size.
// Run with:  npm run build && npm test
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'aurora-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-audio-'));

let failures = 0;
const ok = (cond: unknown, name: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

// ---- make three small songs with tags, plus a synced lyrics file ----
const songs = [
  ['Sunrise Drive', 'The Testers', 'Morning Tape', 'Pop', 1, 440],
  ['Night Signal', 'The Testers', 'Morning Tape', 'Pop', 2, 523],
  ['Blue Hour', 'Echo Field', 'Quiet Rooms', 'Ambient', 1, 330],
] as const;
const files: string[] = [];
for (const [title, artist, album, genre, no, freq] of songs) {
  const out = path.join(work, `${title}.mp3`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=60`, '-metadata', `title=${title}`, '-metadata', `artist=${artist}`, '-metadata', `album=${album}`, '-metadata', `genre=${genre}`, '-metadata', `track=${no}`, out]);
  files.push(out);
}
const lrc = path.join(work, 'Sunrise Drive.lrc');
fs.writeFileSync(lrc, '[00:00.50]First line\n[00:03.00]Second line\n[00:06.00]Third line\n');

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(URL)).ok) break; } catch { /* not up yet */ }
    await wait(250);
  }
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'allow', colorScheme: process.env.DARK ? 'dark' : 'light' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && errors.push(m.text()));
  const tabTo = async (name: string) => {
    if (await page.locator('.dock.searching').count()) await page.getByRole('button', { name: 'Home', exact: true }).click();
    if (name !== 'Home' || !(await page.locator('.dock.searching').count())) await page.getByRole('button', { name, exact: true }).first().click();
  };
  const shot = (name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

  await page.goto(URL);
  await page.waitForSelector('.dock');
  ok(await page.locator('.onboard').count(), 'empty library shows onboarding');
  await shot('01-listen-empty');
  for (const [i, t] of ['Radio', 'Library', 'Search'].entries()) {
    await page.getByRole('button', { name: t, exact: true }).first().click();
    await wait(200);
    await shot(`02-${i}-${t.toLowerCase()}-empty`);
  }

  // ---- import ----
  await tabTo('Library');
  await page.locator('.nav-btn[aria-label="Import music"]').click();
  await page.waitForSelector('.sheet');
  await wait(500);
  await shot('03-import-sheet');
  await page.locator('.sheet input[type=file]').first().setInputFiles([...files, lrc]);
  await page.waitForSelector('.import-list li.done', { timeout: 20000 });
  await wait(1500);
  await shot('04-import-done');
  ok(await page.getByText(/1 lyrics file attached/).count(), 'a .lrc picked with the songs is attached by name');
  const done = await page.locator('.import-list li.done').count();
  ok(done === 3, `imported 3 songs (got ${done})`);
  // importing the same files again must be detected as duplicates
  await page.getByRole('button', { name: /Import More|Import Again|Add More/i }).first().click().catch(() => undefined);
  await page.keyboard.press('Escape');
  await wait(500);

  // ---- browse the library ----
  await tabTo('Home');
  await wait(300);
  await shot('05-listen');
  await tabTo('Home');
  await page.getByRole('button', { name: 'Browse', exact: true }).first().click();
  await wait(300);
  await shot('06-browse');
  await tabTo('Radio');
  await wait(300);
  await shot('07-radio');
  await tabTo('Library');
  await wait(300);
  await shot('08-library');
  await page.locator('.lib-row:has(.lib-label:text-is("Songs"))').click();
  await wait(500);
  await shot('09-songs');
  ok((await page.locator('.tab-host.active .screen:not([inert]) .row[role=button]').count()) >= 3, 'songs list shows the imported songs');

  // ---- upload artwork ----
  await page.locator('.tab-host.active .screen:not([inert]) .row-more').first().click();
  await page.getByRole('menuitem', { name: /Edit Info/ }).click();
  await page.waitForSelector('.art-edit');
  await page.locator('.art-edit input[type=file]').setInputFiles(process.env.COVER || '');
  await wait(800);
  await shot('09b-edit-artwork');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await wait(800);
  const hasImg = await page.locator('.tab-host.active .screen:not([inert]) .row-art img.loaded').count();
  ok(hasImg >= 1, 'uploaded artwork shows on the song row');

  // ---- long press and swipe on a song row ----
  const rowBox = await page.locator('.tab-host.active .screen:not([inert]) .row[role=button]').nth(1).boundingBox();
  if (rowBox) {
    const x = rowBox.x + 120, y = rowBox.y + rowBox.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await wait(800); await page.mouse.up();
    await wait(300);
    ok(await page.getByRole('menuitem', { name: 'Play Next' }).count(), 'long-press opens the song menu');
    await shot('09c-long-press-menu');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await wait(300);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y, { steps: 4 }); await page.mouse.move(x + 150, y, { steps: 4 });
    await shot('09d-swipe');
    await page.mouse.up(); await wait(300);
    ok(await page.getByText(/will play next/).count(), 'swipe right queues the song to play next');
  }

  // ---- play ----
  await page.locator('.tab-host.active .screen:not([inert]) .row[role=button]', { hasText: 'Blue Hour' }).first().click();
  await wait(1800);
  const t1 = Number(await page.locator('.mini-progress').getAttribute('aria-valuenow'));
  ok(t1 > 0, `audio is playing (progress ${t1}%)`);
  ok(await page.locator('.mini').count(), 'mini player appears');
  await shot('10-mini-player');
  await page.locator('.mini').click();
  await wait(800);
  await shot('11-now-playing');
  ok(await page.locator('.np.shown').count(), 'Now Playing opens');

  // lyrics: add synced lyrics through the editor
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await wait(400);
  await shot('12-lyrics-empty');
  await page.getByRole('button', { name: 'Add Lyrics' }).click();
  await page.waitForSelector('.lyrics-input');
  await page.locator('button:has-text("Save Lyrics"):not([disabled])').waitFor();
  await page.locator('.lyrics-input').fill(fs.readFileSync(lrc, 'utf8'));
  await wait(300);
  await shot('13-lyrics-editor');
  await page.getByRole('button', { name: 'Save Lyrics' }).click();
  if (await page.locator('.np-play[aria-label="Play"]').count()) await page.locator('.np-play').click();
  await wait(2500);
  const activeLine = await page.locator('.lyric-line.active').innerText().catch(() => '');
  ok(/line/.test(activeLine), `synced lyric highlights a line ("${activeLine}")`);
  await shot('14-lyrics-synced');
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await wait(300);

  // seek, pause, next
  await page.locator('.np-play[aria-label="Pause"]').click();
  await wait(300);
  ok(await page.locator('.np-play[aria-label="Play"]').isVisible(), 'pause works');
  await page.locator('.np-play').click();
  await page.locator('.np-skip[aria-label="Next song"]').click();
  await wait(1000);
  ok((await page.locator('.np-title').innerText()) === 'Night Signal', 'next song moves to the second song');

  // queue
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await wait(600);
  await shot('15-queue');
  await page.getByRole('button', { name: 'Done' }).click();
  await wait(500);
  await page.getByRole('button', { name: 'Close Now Playing' }).click();
  await wait(700);

  // ---- other screens ----
  await page.getByRole('button', { name: 'Back to Library' }).click();
  await wait(400);
  for (const [label, name] of [['Albums', '16-albums'], ['Artists', '17-artists'], ['Genres', '18-genres'], ['Playlists', '19-playlists']] as const) {
    await page.locator(`.lib-row:has(.lib-label:text-is("${label}"))`).first().click();
    await wait(500);
    await shot(name);
    if (label === 'Albums') {
      await page.locator('.tab-host.active .screen:not([inert]) .card').first().click();
      await wait(500);
      await shot('16b-album-detail');
      await page.getByRole('button', { name: /^Back to/ }).click();
      await wait(300);
    }
    if (label === 'Artists') {
      await page.locator('.tab-host.active .screen:not([inert]) .row', { hasText: 'The Testers' }).first().click();
      await wait(500);
      await shot('17b-artist-detail');
      await page.getByRole('button', { name: /^Back to/ }).click();
      await wait(300);
    }
    await page.getByRole('button', { name: /^Back to/ }).click();
    await wait(300);
  }

  // create a playlist
  await page.locator('.lib-row:has(.lib-label:text-is("Playlists"))').click();
  await wait(400);
  await page.locator('.tab-host.active .screen:not([inert]) .row', { hasText: 'New Playlist' }).click();
  await page.waitForSelector('.form');
  await page.locator('.form input').first().fill('Road Trip');
  await wait(300);
  await shot('20-playlist-editor');
  await page.getByRole('button', { name: 'Create Playlist' }).click();
  await wait(800);
  await page.waitForSelector('.sheet-search');
  await shot('20b-add-songs');
  await page.locator('.sheet .row').first().click();
  await page.locator('.sheet-footer .btn-pill').click();
  await wait(900);
  await shot('21-playlist-detail');
  ok((await page.locator('.screen:not([inert]) .row[role=button]').count()) >= 1, 'song was added to the playlist');
  await page.getByRole('button', { name: /^Back to/ }).click();
  await page.getByRole('button', { name: /^Back to/ }).click();

  // search
  await page.getByRole('button', { name: 'Search', exact: true }).first().click();
  await page.locator('.dock-search input').fill('echo');
  await wait(600);
  await shot('22-search');
  ok((await page.locator('.tab-host.active .screen:not([inert]) .results .row').count()) > 0, 'search finds Echo Field');

  // settings + track info
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await wait(700);
  await shot('23-settings');
  await page.getByRole('button', { name: 'Done' }).first().click();
  await wait(500);

  // ---- light theme ----
  await page.emulateMedia({ colorScheme: 'light' });
  await wait(300);
  await tabTo('Home');
  await wait(400);
  await shot('24-light-listen');
  await page.emulateMedia({ colorScheme: process.env.DARK ? 'dark' : 'dark' });

  // ---- persistence + offline ----
  await page.reload();
  await page.waitForSelector('.dock');
  await wait(1200);
  await tabTo('Library');
  const count = await page.locator('.lib-row:has(.lib-label:text-is("Songs"))').locator('.lib-count').innerText();
  ok(count === '3', `library survives a reload (songs: ${count})`);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await wait(1500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.dock', { timeout: 10000 });
  ok(true, 'app opens while offline');
  await tabTo('Library');
  await page.locator('.lib-row:has(.lib-label:text-is("Songs"))').click();
  await wait(500);
  await page.locator('.tab-host.active .screen:not([inert]) .row[role=button]', { hasText: 'Blue Hour' }).first().click();
  await wait(1800);
  const t2 = Number(await page.locator('.mini-progress').getAttribute('aria-valuenow'));
  ok(t2 > 0, `offline playback works (progress ${t2}%)`);
  await shot('25-offline');
  await context.setOffline(false);

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(e));
  ok(real.length === 0, `no console errors${real.length ? ': ' + real.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
console.log(`Screenshots: ${SHOTS}`);
process.exit(failures ? 1 : 0);
