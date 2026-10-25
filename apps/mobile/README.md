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
- `pnpm --filter @noted/mobile build:apk` — debug-signed APK
  (`android/app/build/outputs/apk/debug/app-debug.apk`)
- `pnpm --filter @noted/mobile assets` — regenerate icons/splash from `resources/`

## Release

Push a `mobile-v*` tag from green `main` (bump `versionName` in
`android/app/build.gradle` first); the `Release mobile` workflow builds the
debug APK on Ubuntu and attaches it to a GitHub prerelease. The workflow requires
`ANDROID_DEBUG_KEYSTORE_BASE64`, an encrypted repository Actions secret containing
the persistent per-app debug keystore, and fails before building if it is missing.
Set `NOTED_ANDROID_DEBUG_KEYSTORE` to that same private keystore for local release
builds and back it up privately. Unset it for ordinary development builds. Never
commit the keystore. Debug builds
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
- These are debug-signed sideload builds, not Play Store release signing.
  The original GitHub v0.2.0 runner's ephemeral signing key was not retained.
  Its certificate differs from the persistent local debug key. An APK signed
  with a different key cannot update that install. Keep it installed until all
  pending notes and originals sync; never uninstall to troubleshoot pending work.
- App foreground and restored connectivity wake the existing queues and reset
  media backoff. Network status is a retry signal, not proof of server reachability.
- Browser approval keeps the verifier-bound exchange. Successful native sign-in
  closes the browser. Android approval pages also offer a fixed
  `com.noted.app://auth/complete` return link with no credential in the URL.

## Emulator regression checks

Build the app and instrumentation APK with JDK 21:

```sh
pnpm --filter @noted/mobile sync
cd apps/mobile/android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -e class 'com.noted.app.NativeTransferTest#browserClosesAndAuthLinkResolves' com.noted.app.test/androidx.test.runner.AndroidJUnitRunner
```

`NativeTransferTest#signedBinaryUpload` additionally accepts instrumentation
arguments `uploadUrl` and `checksum`. Use a disposable, short-lived S3 ticket
for the deterministic 524311-byte fixture whose byte at index i is i modulo 256. Match the production signing path: PUT, application/octet-stream, exact
length, SHA-256, and an unhoisted signed checksum header. Keep ticket values out
of committed files and shared logs. Verify the object's length/checksum with
HEAD, then remove only that disposable object. This test skips without a ticket;
it does not establish the full Google/account/media UI flow.

With a signed-in emulator, opt-in checks accept `-e interactive true` and
`-e homeIndex <zero-based home index>`. `NativeContentTest` creates only its own
fixtures and removes them through the normal UI; its native drag check observes
30 animation frames after release. These checks touch the signed-in backend,
so run them in an intended test home and keep the emulator idle while they run.

A failed opt-in photo run reports its fixture asset ID. To remove that specific
synthetic fixture through the app, run `NativeContentTest#cleanupFailedPhotoFixture`
with `-e fixtureAsset <reported UUID>` and the same `-e homeIndex`.
