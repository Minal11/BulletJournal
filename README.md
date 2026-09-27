# My Bullet Journal

A local-first bullet journal. Pages are written to IndexedDB on the device first, then copied to that person’s private Supabase journal when the network is available. There is no shared notebook.

## Local setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the two values from your Supabase project:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use the publishable (anon) key. Do not put the service-role key in this app.

```bash
npm run dev
```

The dev server listens on your machine and on the local network, so a phone on the same Wi-Fi can open the Network address Vite prints.

```bash
npm run build
npm run preview
```

## Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/migrations/001_initial_schema.sql`.
3. In Project Settings → API, copy the project URL and the publishable/anon key into `.env.local` or into Vercel.
4. In Authentication → URL configuration, set:
   - Site URL: `http://127.0.0.1:5173` while developing, and your Vercel URL in production.
   - Redirect URLs:
     - `http://127.0.0.1:5173/auth/callback`
     - `http://127.0.0.1:5173/auth/reset`
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/auth/reset`
     - `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback`
     - `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/reset`

Password reset and signup confirmation return to those paths. The app then opens `#/reset-password` or Today. Nothing in the client hardcodes one deployment URL.

If email confirmation is enabled, a new account opens after the person confirms the email. You can turn confirmation off in Authentication → Providers → Email while you are testing.

Row Level Security is on every journal table. A signed-in person can only read and write rows whose `user_id` is their own.

## How sync behaves

A line is saved in IndexedDB immediately. If the browser is online, that change is uploaded in the background. If it is offline, the line stays on the device and is marked pending. Coming back online, or choosing Sync now in Settings, uploads it.

Each account has its own IndexedDB database (`MyBulletJournal-<user id>`). Signing out attempts a last sync, then the next account cannot see the previous one. A journal that existed on this device before accounts were added is offered once, after the first sign-in, if the cloud journal is still empty. Importing copies it up and leaves the local copy in place. Importing again uses the same ids, so it does not create a second copy of each line.

If the same line changed on two devices after the last sync, the journal asks which version to keep, or whether to keep both. It does not silently overwrite the words.

Cloud failure never blocks writing. The page still saves locally and shows a small sync note.

## Vercel

1. Push the repository to GitHub.
2. Import it in Vercel. The framework preset is Vite.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy. `npm run build` is the production build.
5. Add the Vercel domain to the Supabase redirect URLs above, and set the Site URL to that domain when you are ready for production email links.

`vercel.json` sends every path to `index.html`, so a refresh on `/auth/reset` still opens the app. Journal pages themselves use hash routes (`/#/today`).

## Phone

On the same Wi-Fi as `npm run dev`, open the Network URL from the terminal.

After the app is deployed, open the Vercel URL.

iPhone: Safari → Share → Add to Home Screen.

Android: Chrome → Install app, or Add to Home screen.

The first successful load caches the app, so later visits open offline. New lines wait on the phone until it is online again, then they show up on the other device after that device syncs.

## Scripts

- `npm run dev` — local journal
- `npm run build` — typecheck and static build
- `npm run preview` — serve the build
- `npm test` — domain and sync tests
