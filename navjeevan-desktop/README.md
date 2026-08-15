# Navjeevan Fertility EMR — Desktop Edition

An offline, single-computer patient management system for Navjeevan Fertility
& IVF Center: OPD intake, hormone/andrology reports, prescriptions, IUI/IVF
cycle monitoring, billing, and a dashboard — with a real local database,
password-hashed login, and automatic backups.

This is the **production build**. It shares its UI and features with the
browser demo you reviewed first, but the storage layer underneath is
completely different and real:

| | Browser demo | This desktop build |
|---|---|---|
| Data storage | Claude artifact sandbox storage | Local SQLite file on the clinic's PC |
| Login | Plaintext password compare | bcrypt-hashed passwords |
| Backups | None | Automatic, timestamped, on a schedule |
| Runs | Inside claude.ai | Installed like any Windows desktop app |

## What's verified so far

Everything below was actually built and run during development (not just
written) — you can re-run all of it yourself:

- The React UI compiles cleanly to a production JS bundle + CSS (`npm run build:renderer`).
- The local database, password hashing, and backup/restore logic pass an automated
  13-point test suite with **no Electron or display needed** (`npm run test:core`).
- The full app was launched headlessly (Electron + a virtual display), logged
  in with the seeded admin account, and rendered the dashboard correctly —
  confirming the login flow, IPC bridge, database, and UI all work together end to end.
- `npm run dist` was run through packaging — it correctly bundled the app,
  fetched the right native SQLite binary for Windows, and produced a full
  `win-unpacked` app folder. It stopped one step short of the final
  installer file because that last step needs either a Windows machine or
  Wine (see below) — not available in the sandbox this was built in.

## Getting the actual installer (.exe)

You have two options:

**Option A — GitHub Actions (recommended, no Windows machine needed)**
1. Push this folder to a GitHub repository (a private repo is fine).
2. Go to the repo's **Actions** tab → run **"Build Windows Installer"**
   (or just push to `main` — it runs automatically).
3. When the run finishes, download the `navjeevan-emr-windows-installer`
   artifact. That's the installer to hand to the clinic.

This works because GitHub's Windows runners build the installer natively —
no Wine, no cross-compilation quirks.

**Option B — Build directly on a Windows PC**
1. Install [Node.js LTS](https://nodejs.org) on the Windows machine.
2. Copy this folder over, open a terminal in it, and run:
   ```
   npm install
   npm run dist
   ```
3. The installer appears in `dist-installer\Navjeevan Fertility EMR Setup 1.0.0.exe`.

## Running it in development (any OS, for testing)

```
npm install
npm start
```

`npm install` automatically rebuilds the native database module for
Electron (via the `postinstall` script) — you don't need to do this by hand.

## First run

- A default account is created automatically: **username `admin`, password `admin123`**.
- **Change this immediately** — click "Change password" in the sidebar after
  your first login. There's no other way to reset it, so make a note of the
  new password somewhere safe (e.g. the clinic's password manager).
- You'll need to log in every time the app is opened. This is intentional —
  clinic front-desk computers are often shared, so the app doesn't stay
  signed in between launches.
- Add more staff accounts as needed — ask me to wire up a simple "Add Staff"
  screen if you want this exposed in the UI rather than done ad hoc.

## Where your data lives

Everything is stored in one file on the clinic's computer — nothing is sent
anywhere over the internet:

- **Windows:** `%APPDATA%\Navjeevan Fertility EMR\navjeevan.db`
- Backups: `%APPDATA%\Navjeevan Fertility EMR\backups\<timestamp>\`

You (or the clinic's IT person) can reach this folder quickly from inside
the app: sidebar → **Backups** → **Open Backups Folder**.

## Backups

- A snapshot is taken automatically: **on launch**, **every 6 hours** while
  the app stays open, and **on close**.
- The last **30 snapshots** are kept; older ones are pruned automatically.
- You can also back up on demand, and restore any previous snapshot, from
  the sidebar → **Backups**.
- **This is local-only.** For real protection against a stolen or failed
  computer, periodically copy the `backups` folder to a USB drive or a
  cloud-synced folder (Google Drive, OneDrive, etc.). This is the one piece
  I'd treat as non-optional before going live with real patient data.

## Security notes for a real deployment

- Passwords are hashed with bcrypt — never stored or logged in plain text.
- No data leaves the computer; there's no server, network calls, or
  telemetry in this build.
- The default admin password is a known, published value until changed —
  changing it is the single most important first step.
- Consider Windows-level protections too: a login password on the PC
  itself, and disk encryption (BitLocker) if the machine could be lost or
  stolen, since patient health data is sensitive under India's DPDP Act 2023.
- This build doesn't yet have per-role permissions (e.g. restricting
  front-desk staff from clinical notes) or an audit log of who viewed/edited
  a record. Worth adding before a multi-staff rollout — happy to help with
  this next.

## Project layout

```
navjeevan-desktop/
  src/
    main.js       Electron entry point — window, IPC handlers, scheduled backups
    preload.js    Safe bridge exposing window.api to the UI
    db.js         SQLite-backed key/value store
    auth.js       bcrypt password hashing, login, seeding
    backup.js     Timestamped backup/restore/pruning
  renderer/
    src/App.jsx   The full UI (dashboard, patients, prescriptions, billing, etc.)
    src/index.jsx React entry point
    index.html    Loaded by Electron
  test/
    test-core.js  Standalone test for db.js / auth.js / backup.js (no Electron needed)
  .github/workflows/build-windows.yml   Builds the installer on GitHub's servers
```

## Known gaps / good next steps

- **Fonts load from Google Fonts over the internet** on first run. If the
  clinic's internet is unreliable, the UI still works (it falls back to
  system fonts) but won't look quite as designed. Self-hosting the two font
  files would make this fully offline — small task, ask if you want it done.
- **No per-role access control** yet (see above).
- **No cloud/offsite backup automation** — currently manual (copy the
  backups folder somewhere safe).
- **Multi-computer / multi-clinic use** isn't supported by this architecture
  — it's one database per installed computer. If the clinic later wants
  several front-desk computers sharing one patient list, that's a bigger
  change (a real client-server setup, likely PostgreSQL + a small local
  network server) — let me know if that becomes a real need before building it.
