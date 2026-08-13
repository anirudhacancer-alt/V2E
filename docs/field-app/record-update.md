# Record Update Page

## Purpose

Capture a site update from the supervisor as audio, optional image/video evidence (or typed text), and create a pending update record.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ ← Back          Record update    Riverside · 1328          │
├────────────────────────────────────────────────────────────┤
│ Microphone   [ Ready — tap to record ]                     │
│              ( ● )  REC    0:42                             │
│ Upload        [========······]  Retry                        │
│ Evidence      [+ Image] [+ Video]   thumbnails …           │
│ Fallback      ┌──────────────────────────────────────────┐  │
│ text          │ Type here if audio unavailable…         │  │
│               └──────────────────────────────────────────┘  │
│              [ Save as pending update ]  [ Discard ]       │
├────────────────────────────────────────────────────────────┤
│  Home      Board      (+)      Standup      Me             │
│                       ●                                     │
└────────────────────────────────────────────────────────────┘
```

## Primary Data Inputs

- `updates.csv` (new row on save)
- current user from `users.csv`
- selected contract from app context

## Page Layout

1. Header
   - Back action
   - Contract label
2. Recording Panel
   - Permission state
   - Record button
   - Stop button
   - Elapsed timer
3. Upload State
   - Upload progress
   - Retry action
4. Evidence Capture Panel
   - Add image(s)
   - Add short video
   - Preview/remove captured media
5. Fallback Text Area
   - Manual update entry
6. Footer Actions
   - Save as pending update
   - Discard

## Render Rules

- New record enters with update `status` = `Pending`.
- Persist `audioDuration` when audio exists.
- Disable save while upload/transcription is in progress.

## Error States

- Microphone denied: show inline permission guidance.
- Upload failure: show retry with retained local draft.
- Empty transcript and empty text: prevent submission.
