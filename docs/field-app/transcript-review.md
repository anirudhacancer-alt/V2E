# Transcript Review Page

## Purpose

Let the supervisor verify transcript quality before AI extraction or save-only action.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ ← Back    Update #u-2048        Pending          10:14     │
├────────────────────────────────────────────────────────────┤
│ Audio   2:15   ▶ ━━━━━●━━━━━  speed 1×                     │
│ Transcript                                                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ We need the steel on Level 3 by Thursday. The crane…  │ │
│ │                                                         │ │
│ └────────────────────────────────────────────────────────┘ │
│ Evidence   [img] [img] [vid]                                │
│ Recorder · Site · Last saved …                              │
│ [ Process with AI ]  [ Save as update ]  [ Re-record ]    │
└────────────────────────────────────────────────────────────┘
  (detail: no tab bar; back returns to previous hub)
```

## Primary Data Inputs

- `updates.csv`
- `update_attachments.csv`
- current user context

## Page Layout

1. Header
   - Update id
   - Created timestamp
   - Current status chip
2. Audio Summary Strip
   - Duration
   - Playback control placeholder
3. Transcript Panel
   - Full transcript text
   - Edit capability (optional in MVP)
4. Evidence Panel
   - Attached photos
   - Attached videos
   - Attached audio
5. Metadata Row
   - Recorder
   - Contract/site
   - Last update time
6. Actions
   - Process with AI
   - Save as update
   - Re-record

## Render Rules

- Status chip uses contract values only:
  - Pending
  - Processed
  - ConvertedToTask
  - Escalated
  - Saved
- Save-as-update path should set status to `Saved` if no AI processing requested.

## Empty and Error States

- Transcript missing: show "Transcription failed. Retry or enter text."
- Audio missing: still allow text-only save.
