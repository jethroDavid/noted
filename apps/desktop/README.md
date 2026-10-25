# @noted/desktop

Electron shell for the bundled offline client and shared home scenes, using the secure `noted://app`
origin and PowerSync SQLite in persistent OPFS. See the
[native client guide](../../packages/native-client/README.md) for runtime and setup.

## Prereqs

- Node + pnpm (see root README)

## Commands

- `pnpm --filter @noted/desktop dev` — launch against the local dev server
  (run `pnpm dev:web` first); `NATIVE_API_URL` overrides the backend URL
- `pnpm --filter @noted/desktop start` — launch the last `build` output
- `pnpm --filter @noted/desktop build` — build the renderer and main process
- `pnpm --filter @noted/desktop build:installer` — unsigned Windows NSIS
  installer (`release/`)
- `pnpm --filter @noted/desktop assets` — regenerate `resources/icon.ico`
  from `resources/icon.png` (brand-master artwork, mirrored from mobile)

## Release

Push a `desktop-v*` tag from green `main` (bump `version` here first); the
`Release desktop` workflow builds the installer on Windows and attaches it
to the GitHub Release. Unsigned builds trip SmartScreen on other machines.

## Notes

- Sign-in uses `/native-auth` in the system browser with matching-code approval.
- Both development and release builds load local bundled assets. Development
  targets the local backend; normal release builds target production.
- Release signing is not set up yet: unsigned builds only, no store
  upload. The app and installer icon is the brand origami-N artwork.
- No preload or renderer Node access. External navigation is restricted to the
  configured backend's sign-in page, and asset paths stay inside the bundle.
- Originals and cached media use account-scoped OPFS files. Text and media share
  the illustrated screens while their persistence and upload queues stay separate.
