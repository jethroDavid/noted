# @noted/mobile

Android shell for the bundled offline client and shared home scenes, using PowerSync Capacitor and
native SQLite. See the [native client guide](../../packages/native-client/README.md)
for runtime, current feature scope, and development setup.

## Prereqs

- Node + pnpm (see root README)
- Android SDK (`ANDROID_HOME`) with platform-tools for builds
- JDK 21 (`JAVA_HOME`), required by Capacitor 8

## Commands

- `pnpm --filter @noted/mobile sync` — copy web assets into the native project
- `pnpm --filter @noted/mobile run:local` — build/run against the local backend
  (run `adb reverse tcp:3000 tcp:3000` first, plus port 9000 for local MinIO)
- `pnpm --filter @noted/mobile dev` — browser preview of the native workspace
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
- Sign-in uses `/native-auth` in the system browser with a matching-code approval.
- Local builds allow HTTP only for a localhost backend through ADB reverse.
  Release builds use HTTPS and disable mixed content.
- Photos/videos persist in account-scoped native files before sync. Filesystem,
  file-transfer, and share plugins handle original bytes and diagnostic export.
  The illustrated fridge, TV, and book use the shared experience package.
- Release signing is not set up yet: debug builds only, no store upload.
