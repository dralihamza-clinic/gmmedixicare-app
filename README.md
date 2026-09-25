# GmMedixicare Desktop (staff app)

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

Output: `release/GmMedixicare-Setup-<version>.exe`. Copy that file to the USB.
The `.env` values are baked in at build time, so rebuild after changing them.

Notes:
- Unsigned installers show "Windows protected your PC" → More info → Run anyway.
- If the build fails with a "symbolic link" error, run the terminal as
  Administrator (or enable Windows Developer Mode) and retry.
- For a new release, bump `version` in `package.json` and run `npm run dist`.

## Other commands

- `npm start` – build and run the production version locally
- `npm run typecheck` – TypeScript check
