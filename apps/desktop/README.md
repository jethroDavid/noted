# @noted/desktop

Thin desktop shell for Noted: an Electron window that loads production
(`https://noted-six-chi.vercel.app`) remotely. No bundled UI, no Expo-style
duplication — the web app and its tRPC links run as-is.

## Prereqs

- Node + pnpm (see root README)

## Commands

- `pnpm --filter @noted/desktop dev` — launch against the local dev server
  (run `pnpm dev:web` first); `PORT` picks the port, `APP_URL` overrides the
  URL entirely (both already in `turbo.json` globalEnv)
- `pnpm --filter @noted/desktop start` — launch the last `build` output
- `pnpm --filter @noted/desktop build` — compile the main process to `dist/`
- `pnpm --filter @noted/desktop build:installer` — unsigned Windows NSIS
  installer (`release/`)
- `pnpm --filter @noted/desktop assets` — regenerate `resources/icon.ico`
  from `resources/icon.png` (brand-master artwork, mirrored from mobile)

## Notes

- Google sign-in keeps the popup flow inside the window (popups work on
  desktop, unlike the mobile webview); no web change was needed.
- The packaged app always loads production; `APP_URL`/`PORT` only apply to
  unpackaged dev runs.
- Release signing is not set up yet: unsigned builds only, no store
  upload. The app and installer icon is the brand origami-N artwork.
- No preload script: stage 1 exposes no native APIs to the page.
