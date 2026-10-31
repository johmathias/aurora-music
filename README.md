# ZERO OS

A private personal operating system: **Home · Habits · Schedule · Plans · Money · Progress**, plus a Journal.
Dark glass design, built for iPhone, works offline, optional cloud sync and push alerts.

> Start from zero. Build everything.

Do the steps in order. Steps 1 and 2 are all you need to start. Steps 3 and 4 are optional extras.

---

## 1. Run it on your computer (no accounts)

1. Unzip the folder.
2. Double-click **`index.html`**. It opens in Chrome.

Everything works offline. Your data is saved in the browser on that computer.

> Browsers keep data separately for each address. Data you enter by double-clicking the file is **not** the same as on your GitHub website. To move it: **Settings → Export everything (JSON)**, then **Settings → Restore from backup** on the other one.

---

## 2. Put it on the internet with GitHub Pages

You need this to install it on your iPhone.

**Important about free GitHub accounts:** GitHub Pages is free only for **public** repositories. If your `zero-os` repo is private, either (a) make it public (Settings → General → Danger Zone → Change visibility), or (b) use a new public repo. Making it public is safe here: the code has no secrets in it. Your personal data is never in the repo; it lives in your browser and in your Supabase account. The Supabase *anon* key is designed to be public (the database rules protect your data).

**A. Upload the files**
1. On github.com open your repo (or **New repository** → name it `zero-os` → Public).
2. Click **Add file → Upload files**. Unzip the project and drag **everything inside the `zero-os` folder** into the page. (Drag the contents, not the outer folder, so `index.html` is at the top.)
   - Make sure the hidden folder `.github` and the file `.nojekyll` are included. If your computer hides them, use the git commands below instead.
3. Click **Commit changes**.

*Or with git (Windows, in the unzipped folder):*
```
git init
git add .
git commit -m "ZERO OS"
git branch -M main
git remote add origin https://github.com/johmathias/zero-os.git
git push -u origin main
```

**B. Turn on Pages**
1. Repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab. The "Deploy to GitHub Pages" job runs by itself (about 1 minute). When it has a green tick, open **Settings → Pages** to see your address:
   `https://johmathias.github.io/zero-os/`

Every time you push a change, the site updates automatically. After changing files, open `sw.js` and the app now loads fresh files whenever the phone is online, so updates show up by themselves. (If you ever need to force it, raise the number in `sw.js`: `zero-os-v3` → `v4`.)

**C. Install on your iPhone**
1. Open your address in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Open ZERO OS from the new icon.

---

## 3. Cloud sync (optional) — set up Supabase

Skip this if one device is enough.

**A. Create the project**
1. Go to **supabase.com** → sign in → **New project**. Pick a name, set a database password (save it somewhere safe), choose a region close to you, **Free** plan. Wait ~2 minutes.

**B. Create the database**
1. Left menu → **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it, press **Run**. It should say "Success".
3. New query again. Paste `supabase/verify.sql` and **Run**. Every row must say **OK** (the two `pg_cron` / `pg_net` rows may say "not on yet" — that is fine until step 4).

**C. Copy your two keys**
1. **Project Settings → API** (or **Connect**).
2. Copy the **Project URL** and the **anon / publishable** key.
3. Open `config/config.js` and paste them between the quotes:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...',
   ```
4. **Never** put the `service_role` / secret key anywhere in this project.

**D. Login settings**
1. **Authentication → URL Configuration**: set **Site URL** to `https://johmathias.github.io/zero-os/` and add the same address under **Redirect URLs**. This makes password-reset emails come back to the app.
2. **Authentication → Providers → Email** is on by default. Leave "Confirm email" on for real use.

**E. Send the change to GitHub**
Upload the edited `config/config.js` (Add file → Upload files, or `git add . && git commit -m "config" && git push`). Wait for the green tick in **Actions**.

**F. Not working? Use the built-in check**
Open the app → **Settings → Cloud sync → Check connection**. It ticks each step (file found, URL, key, library, Supabase reachable) and tells you what to fix. Swipe the app away and reopen it after changing `config.js`.

**G. Make your account**
Open the app → **Settings → Cloud sync → Create account**. Confirm the email, then sign in. Do the same on your iPhone; your data appears on both.

How sync behaves:
- Every change is saved on your device first, then uploaded when online.
- The pill shows **Offline mode / Offline / Syncing / Synced / Sync issue**.
- If the same item is changed on two devices, the newest wins and the older copy is kept under **Settings → Review sync conflicts**. Nothing is silently lost.
- If an upload fails, changes stay queued and retry automatically.

---

## 4. Push alerts when the app is closed (optional)

Needs step 3 finished first. On iPhone you also need the app added to the Home Screen (iOS 16.4 or newer).

**A. Make your push keys**
1. Double-click **`tools/generate-vapid-keys.html`** and press **Make my keys**.
2. You get a **public key** and a **private key**.
3. Paste the **public** key into `config/config.js` as `VAPID_PUBLIC_KEY`, then upload that file to GitHub (like step 3E).
4. Keep the **private** key for the next step. Never put it in `config.js`, GitHub or a chat.

**B. Save the secrets in Supabase**
**Edge Functions → Secrets** (or **Project Settings → Edge Functions**) → add these four:
| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:` + your email, e.g. `mailto:you@gmail.com` |
| `CRON_SECRET` | any long random text you invent (write it down) |

**C. Add the sending function**
1. **Edge Functions → Deploy a new function → Via Editor**. Name it exactly **`send-push`**.
2. Delete the sample code, paste all of `supabase/functions/send-push/index.ts`, and **Deploy**.
3. Open the function's settings and turn **OFF** "Enforce JWT verification" (the function protects itself with `CRON_SECRET`).

**D. Start the every-minute timer**
1. **SQL Editor → New query**. Paste `supabase/cron.sql`.
2. Replace `YOUR_PROJECT_REF` (the part of your URL before `.supabase.co`) and `YOUR_CRON_SECRET` (the same text as step B). **Run.** Do not save this edited version to GitHub.

**E. Turn it on in the app**
1. Open ZERO OS on your iPhone from the Home Screen icon → **Settings → Reminders → Push alerts → Turn on → Allow**.
2. Tap **Test**, then close the app. The alert should arrive within about a minute.
3. If not: Supabase → **Edge Functions → send-push → Logs**, and in SQL Editor run
   `select * from cron.job_run_details order by start_time desc limit 10;`

How it works: the app saves your next 14 days of alerts in your Supabase account, and the timer sends the ones that are due. Alerts come from events (with "Remind me"), tasks (with a reminder, at 09:00 on the day), university items, habits with a reminder time, and your challenge reminder.

**Limits to know:** the alert list refreshes whenever you open the app or change something, so if you do not open the app for more than 14 days, newer events will not have alerts yet. Push needs internet on the phone. iPhone push is Apple-controlled and can occasionally be delayed.

---

## Honest limits (please read)

- **Without step 4**, alerts only fire while ZERO OS is open or recently used. A **Due now** card shows what you missed. For alerts that always arrive, use **Settings → Export events to Apple Calendar**.
- **Internet is needed only for** creating an account, signing in, syncing and push. Everything else works offline.
- **No bank / mobile-money connections.** Enter transactions by hand or import a CSV statement (**Money → ⋯ → Import CSV**: map columns, preview, duplicates skipped).
- **The passcode** (Settings → Privacy) only locks the screen on that device. It does not encrypt data.
- Clearing Safari's website data deletes data that has not synced. Export a backup now and then.

---

## What's inside

```
index.html              the app page
manifest.webmanifest    install settings (name, icon, colours)
sw.js                   service worker (offline, fast start, push alerts)
.github/workflows/      GitHub Pages deploy (runs by itself on every push)
.nojekyll               tells GitHub to publish the files as they are
config/config.js        your Supabase URL, anon key and push public key (empty = offline mode)
supabase/
  schema.sql            tables + security rules (paste once)
  verify.sql            checks everything is set up and locked down
  cron.sql              every-minute timer for push (edit placeholders first)
  functions/send-push/  the function that sends push alerts
tools/generate-vapid-keys.html   makes your push keys (runs on your computer)
css/styles.css          the whole design system
assets/icons/           app icons
js/
  core.js  logic.js  ui.js  sync.js  reminders.js  push.js  motivation.js  app.js
  views/                one file per screen + shared forms
  vendor/               Chart.js and supabase-js (bundled so it works offline)
```

Icons are from Lucide (ISC licence).

## Tested

Automated browser tests: all screens at phone width (no sideways scrolling), balances after add / edit / delete, transfers excluded from income and expenses, form validation, habit / task / event actions, weekly repeats, slip handling that keeps progress, the 100-day challenge, backup and restore, data surviving reload, opening offline, opening straight from the file, running from a GitHub-Pages-style sub-path, and sync (upload, download, conflict, failed upload, delete) against a simulated Supabase.
Push: keys are valid and match; the send function's logic (due / future / stale / duplicate / expired phone / temporary failure) against mocks; the app's turn on, schedule, update and turn off flow with a simulated phone.
**Not tested here:** a real Supabase project, real iPhone Safari, and real delivery from Apple or Google. Please try Test push on your phone.

## Daily messages

Home shows one of 100+ short encouraging messages each day (it changes at midnight). They are written into `js/motivation.js`, so they work offline; nothing is downloaded. Edit that file to add your own. **I need a pause** opens a 10-minute breathing timer.
