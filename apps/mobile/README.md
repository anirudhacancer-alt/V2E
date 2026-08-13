# V2E Mobile App

Capacitor shell for the V2E field app. The native app wraps the same React
web bundle from `apps/field-app`, but native builds now use Capacitor plugins for:

- camera capture and photo library access
- microphone recording
- status bar / splash behavior
- app settings recovery after denied permissions

## Prerequisites

- Node.js 18+
- pnpm
- For iOS: macOS with Xcode 15+ and CocoaPods
- For Android: Android Studio with SDK 34+
- Native builds must set `VITE_API_URL` and `VITE_API_TOKEN`

## One-time setup

From the repo root:

```bash
pnpm install
pnpm --filter @v2e/field-app build
cd apps/mobile
npx cap add ios
npx cap add android
pnpm sync
```

This generates `ios/` and `android/` and syncs the current web bundle plus
plugin metadata into both native projects.

## Local workflows

```bash
# Rebuild web and sync native assets
pnpm build

# Sync only
pnpm sync
pnpm sync:ios
pnpm sync:android

# Open native projects
pnpm ios
pnpm android

# Run on simulator / emulator / device
pnpm ios:run
pnpm android:run
```

## Internal beta flow

```bash
pnpm beta:ios
pnpm beta:android
```

Those scripts rebuild the web app, sync Capacitor, and open the native project
ready for archive/signing in Xcode or Android Studio.

## Environment contract

- `VITE_API_URL` is required for packaged native builds.
- `VITE_API_TOKEN` is required for authenticated mutations outside local dev.
- Local browser-only testing can still use the Vite proxy with
  `apps/field-app/.env.local`, but packaged native builds cannot rely on `localhost`.

## Development with live reload

1. Start the repo dev servers:

```bash
pnpm dev
```

2. In `apps/mobile/capacitor.config.ts`, temporarily uncomment:

```ts
server: {
  url: 'http://localhost:3001',
  cleartext: true,
},
```

3. Reach the dev server from the device using Tailscale or ngrok, then:

```bash
pnpm sync
pnpm ios
# or
pnpm android
```

Do not keep the `server` block enabled for production/beta builds.

## Native permissions

- iOS: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`,
  `NSPhotoLibraryUsageDescription`
- Android: `RECORD_AUDIO`, `CAMERA`, and the generated photo-picker permissions
  used by Capacitor plugins

The web app handles denied permissions by offering retry plus “Open Settings” in
native shells.

## Smoke test

Use [SMOKE_TEST.md](./SMOKE_TEST.md) after every native sync/build change.
