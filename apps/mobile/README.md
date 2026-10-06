# @noted/mobile

Thin Android shell for Noted: a Capacitor app that loads production
(`https://noted-six-chi.vercel.app`) in a native webview. No Expo, no
duplicated API client — the web app and its tRPC links run as-is.

## Prereqs

- Node + pnpm (see root README)
- Android SDK (`ANDROID_HOME`) with platform-tools for builds

## Commands

- `pnpm --filter @noted/mobile sync` — copy web assets into the native project
- `pnpm --filter @noted/mobile open:android` — open `android/` in Android Studio
- `pnpm --filter @noted/mobile build:apk` — unsigned debug APK
  (`android/app/build/outputs/apk/debug/app-debug.apk`)
- `pnpm --filter @noted/mobile assets` — regenerate icons/splash from `resources/`

## Release

Push a `mobile-v*` tag from green `main` (bump `versionName` in
`android/app/build.gradle` first); the `Release mobile` workflow builds the
debug APK on Ubuntu and attaches it to the GitHub Release. Debug builds
install via sideloading, outside the Play Store flow.

## Notes

- Native capture uses `@capacitor/camera` (take photo, record video, gallery
  pick); `cap sync` registers it in the native project. The web app calls it
  through `src/platform/capture/` only on native shells — desktop keeps plain
  `<input type="file">`. The Android manifest declares camera/media
  permissions so the system chooser also offers camera and gallery as a
  fallback for photos and videos.
- Google sign-in uses a redirect flow inside the native webview (popups do not
  work there); see `apps/web/src/platform/auth/auth-provider.tsx`. The web app
  must be redeployed for mobile sign-in to work.
- Release signing is not set up yet: debug builds only, no store upload.
