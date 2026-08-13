# Mobile device smoke test (Capacitor)

Run this after `pnpm --filter @v2e/mobile build` or `pnpm sync`.

## Preconditions

- `VITE_API_URL` points to a reachable API from the device.
- `VITE_API_TOKEN` is set for the build you installed.
- `ai-gateway` is running if you are testing transcription, extraction, or
  standup summary.
- Native projects include:
  - iOS: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`,
    `NSPhotoLibraryUsageDescription`
  - Android: `RECORD_AUDIO`, `CAMERA`

## First-run permission pass

1. Install the app on a real iPhone.
2. Install the app on a real Android phone.
3. On each platform, verify:
   - microphone prompt appears on first record
   - camera prompt appears on first capture
   - denied permission shows retry plus open-settings recovery
   - returning from settings restores the route and allows another attempt

## Core workflow

1. Open the app and confirm field app home loads.
2. Go to **Record**.
3. Record a voice update with the native microphone flow.
4. Add one camera photo and one gallery photo.
5. Submit the update.
6. Open **Review Transcript** and add another photo.
7. Trigger transcription.
8. Continue to extraction and create a task.
9. Open **Tasks** and confirm the new task appears with the expected source.
10. Open **Standup** and optionally generate the AI summary.

## Interruption checks

1. Start recording, background the app, then return.
2. Confirm the app warns that recording may have been interrupted.
3. On Android, take a photo and simulate process death / activity restore if
   possible; confirm the restored result is recovered into the route.
4. Use the Android hardware back button on nested field-app routes and confirm
   it follows router history before minimizing the app at the root.

## Known limits

- Offline queueing is out of scope.
- Long background recordings remain best-effort and should be treated as a
  pilot hardening item, not a guaranteed workflow.
