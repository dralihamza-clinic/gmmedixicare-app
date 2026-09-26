# GMMedixicare Desktop (staff app)

Electron + Vite + React + TypeScript + Tailwind. Talks straight to Supabase
(same project as the public website). Screens: staff sign-in, overview,
doctors (list / add / edit / activate / delete), and a "My Patients" stub for
doctor accounts.

## 1. Set up the database (once)

In the Supabase **SQL Editor**, run in order:

1. `sql/001_doctors_schema.sql`
2. `sql/002_roles_and_dashboard.sql`

Then create the first admin: Authentication → Add user, then Table Editor →
`user_roles` → insert `user_id` = that user's id, `role` = `admin`.
Also turn **off** public sign-ups (Authentication → Sign In / Providers).

## 2. Run it

Requires Node.js 22 LTS.

```
npm install
copy .env.example .env      (then fill in the two values)
npm run dev
```

`.env` needs the Supabase **URL** and **anon** key only. Never the
service_role key.

## 3. Build the installer for the USB

```
npm run dist
```

Output: `release/GMMedixicare-Setup-<version>.exe`. Copy that file to the USB.
The `.env` values are baked in at build time, so rebuild after changing them.

Notes:
- Unsigned installers show "Windows protected your PC" → More info → Run anyway.
- If the build fails with a "symbolic link" error, run the terminal as
  Administrator (or enable Windows Developer Mode) and retry.
- For a new release, bump `version` in `package.json` and run `npm run dist`.
- If the build fails with `EPERM: operation not permitted, rename ...
  win-unpacked.tmp`, Windows Defender (Controlled folder access) is blocking
  the Downloads folder. Allow Node/electron-builder there, or move the
  project out of Downloads.

## 4. Publish an update (auto-update)

Installed copies check GitHub Releases on
[dralihamza-clinic/gmmedixicare-app](https://github.com/dralihamza-clinic/gmmedixicare-app)
at startup and every 6 hours, download a newer version in the background,
then ask to **Restart now** or **Later** (Later installs on the next quit).
Only packaged installs update — never `npm run dev` / `npm start`.

1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`). Installed apps
   only update to a *higher* version.
2. Set a GitHub token with write access to that repo's contents (a
   fine-grained token with "Contents: Read and write" is enough) for this
   terminal only — never commit it:
   ```
   set GH_TOKEN=github_pat_...
   ```
3. Run:
   ```
   npm run release
   ```
   This builds and uploads the installer, `.blockmap`, and `latest.yml` to a
   GitHub release for that version. `npm run dist` still builds locally only.

The first install on each PC still has to come from the installer (USB or
the Releases page); every later version arrives automatically.

## Other commands

- `npm start` – build and run the production version locally
- `npm run typecheck` – TypeScript check
