# 🇯🇵 Nihongo jouzu · Nihongo-jouzu-app

A mobile-friendly app for drilling Japanese vocabulary and grammar from **Genki I**, with Duolingo-style practice.

> 日本語上手！ — “Your Japanese is so good!”

## ✨ Features

- **Lessons and topics**: Basics (numbers) and Lessons 1, 3, 4, and 5 — 263 words.
- **Duolingo-style practice**: hearts, XP, combos, and daily streaks. A topic is completed only after a mistake-free run.
- **New-word introductions** before the first question.
- **Spaced repetition**: 1 → 3 → 7 → 14 → 30 → 60 days.
- **Grammar**: tap-through notes and exercises covering fill-in-the-blank questions, word order, verb and adjective conjugation, and 〜ましょう / 〜ませんか.
- **Dictionary** with search, lesson filters, and a “Show kanji” toggle.
- **Profile**: streak, total XP, daily XP charts (7 / 14 / 30 days), and Russian, English, or Japanese interface language.
- **Accounts**: registration and sign-in with a username and a permanent secret code, with sign-out available in the profile. Each account has separate progress stored in SQLite and synced across devices.
- Light and dark themes.
- **Progress backups**: export to JSON and restore on another device from the profile.

## 🚀 Getting started

To use accounts and progress sync, run the app with its backend (Python 3.9+):

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
python3 tools/build.py
.venv/bin/python -m server.app
```
Open `http://127.0.0.1:8765/`, then go to **Profile → Sign in → Create account**. Usernames must contain 3–32 Latin letters, digits, or underscores (`_`), and are case-insensitive. Permanent secret codes must contain 4–128 characters and must be entered twice during registration. Self-service recovery for forgotten codes is not yet available.

The backend stores accounts, sessions, and progress in `instance/nihongo.sqlite3`. This file and the local Python environment are excluded from Git. Codes are stored using PBKDF2-HMAC-SHA256 with individual random salts and 600,000 iterations. Sessions use random tokens in HttpOnly/SameSite cookies and expire after 30 days. The server rate-limits repeated sign-in attempts.

Guest progress stays in the browser. Creating an account automatically imports guest progress; signing in to an existing account does not. Signing out returns to the guest profile. Local account caches are separated by user ID, retain changes while offline, and sync when the connection returns. Expired sessions require signing in again. Sync runs after answers, when returning to the app, and every 30 seconds while the tab is open. The server rejects outdated revisions; the client merges progress and retries.

You can still open `index.html` directly for guest use without a backend. Accounts and server-side sync are unavailable on static hosting such as GitHub Pages.

For production, run a WSGI server such as Gunicorn behind an HTTPS reverse proxy. Set `NIHONGO_ORIGIN=https://your-domain` to configure the allowed app origin and Secure cookies. The built-in Flask server is for development. See the VPS deployment instructions below and [deployment notes](deploy/DEPLOYMENT.md). When backing up a running SQLite database, use its backup API to include data from the WAL journal.

To transfer progress or save it before clearing browser data, use **Profile → Backup → Save to file**. On another device, choose **Restore from file** and confirm replacement. Backups include vocabulary progress, grammar, mistakes, review schedules, XP, streaks, and completed topics. Language, audio, and kanji settings remain device-specific.

Restoring a backup **replaces** current progress, including the server copy when sync is enabled. Save your current progress to a separate file first. Only Nihongo jouzu backups up to 5 MB are accepted; invalid files or save failures leave current progress unchanged.

## 🗂️ Project structure

```text
index.html                  Built app (a single file)
src/template.html           Markup and styles
src/data.js                 Course: lessons, topics, vocabulary, notes, exercises
src/words-en.js              English vocabulary and title translations
src/i18n.js                  Interface strings in three languages
src/app.js                  App logic, sign-in, and sync
server/app.py               Flask backend: accounts, sessions, SQLite, progress and admin APIs
server/monitor.html         VPS dashboard and user administration
server/static/globe.js      Interactive VPN connection globe
requirements.txt            Backend dependencies
tests/                      Backend tests
tools/accounts.browser.cjs  Optional account browser checks (Playwright)
src/backup.js               Backup format, validation, and restoration
src/legacy-v1.json          Original word order for migrating old progress; do not change
tools/build.py              Builds index.html from src/
tools/check.js              Script, word ID, translation, and interface key checks
tools/backup.test.js        Backup tests (Node.js 18+)
```

After editing files in `src/`:

```sh
python3 tools/build.py
node tools/check.js
node --test tools/backup.test.js
.venv/bin/python -m unittest discover -s tests -v
```

## ➕ Adding vocabulary

Add words to the relevant lesson's `topics[].items` in `src/data.js` using `[kana, kanji, romaji, translation, note]`. Add the English translation in `src/words-en.js`.

A word's ID is `kana|kanji`. Changing the kana or kanji of an existing word breaks its link to saved progress.

## 📖 Learning materials

Vocabulary and grammar are based on *Genki: An Integrated Course in Elementary Japanese I* (The Japan Times) and class materials. This is a personal learning project and is not affiliated with the publisher.

---

がんばって！ made by [@Amuru](https://t.me/amuru)

## 🖥️ VPS deployment

Install production dependencies with `pip install -r deploy/requirements.txt`.
Run from the project directory:

```sh
gunicorn -c deploy/gunicorn.conf.py 'server.app:create_app()'
```
Set these environment variables before starting:

- `NIHONGO_ORIGIN`: the exact HTTPS app origin, without a trailing `/`.
- `NIHONGO_DATABASE`: an absolute path to SQLite outside the application code directory, such as `/var/lib/nihongo-jouzu/nihongo.sqlite3`.
- `NIHONGO_BEHIND_PROXY=1`: enable only behind one trusted reverse proxy, with the app port accessible only locally. This allows sign-in rate limits to use the visitor's real IP address.

The Gunicorn configuration listens on `127.0.0.1:8765`. Configure the HTTPS proxy and system service for your VPS and its existing services.

Create a backup of a running database with an integrity check:

```sh
python3 tools/backup_db.py /var/lib/nihongo-jouzu/nihongo.sqlite3 /var/backups/nihongo-jouzu
```

This script creates a new file without deleting previous backups. Configure scheduling, retention, and off-site storage separately.

### Container deployment

On the VPS, place the source in `/opt/nihongo-jouzu`. Set `SITE_HOST` in `.env` without `https://`. The `data/` and `backups/` directories must be owned by UID/GID `10001:10001` with permissions `750`.

```sh
docker compose --profile public up -d --build
```
The app is accessible only inside the container network. Caddy exposes ports 80 and 443 and obtains an HTTPS certificate. SQLite data in `data/` survives container recreation. Do not delete `data/`, `backups/`, or Caddy volumes during updates. The `deploy/backup.sh` script creates a database backup and removes only matching backups older than 30 days after a successful backup.

To update the app, run `deploy/backup.sh`, upload the new code without replacing `.env`, `data/`, or `backups/`, then repeat the startup command. To change domains, update `SITE_HOST`, point DNS to the VPS, and recreate the containers. Users will need to sign in again; accounts and server-side progress are preserved.

### VPS status dashboard

The `/status` dashboard shows service status, CPU load, memory, disk usage, VPN clients, and fail2ban statistics. It includes interactive load charts, IP-based geolocation, a 3D connection globe, and a Nihongo jouzu tab listing registered users.

Owners are configured through `MONITOR_ADMINS` in the server environment and can grant or revoke dashboard access for existing accounts. Delegated administrators can view the dashboard but cannot manage roles. Ordinary users cannot access metrics, IP addresses, or the user list. Secret codes and session tokens are never included in the list.

The VPN privacy toggle hides IP addresses and location names. Points and connection arcs remain visible on the globe, so approximate geographic positions are still shown.

The `tools/collect_monitor.py` collector runs through systemd every 30 seconds and writes the required metrics to a separate file. The web container reads this file without access to the Docker socket. Collector commands do not change VPN settings or read private keys. IP geolocation uses ipwho.is with cached results. The dashboard runs on the VPS itself, so it is unavailable during a complete server outage.

See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for setup and operational details.
