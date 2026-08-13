# Profile and Settings Page

## Purpose

Provide essential user identity, role context, and MVP settings for pilot operations.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ Profile                                                    │
│ Alex Rivera     [Site Supervisor]        ID: EMP-1042      │
├────────────────────────────────────────────────────────────┤
│ Contact         email@…   ·   +1 …                         │
│ Site assignment Riverside · RCC lead                         │
│ Preferences     Push on    Dark mode off                   │
│ Device          App 1.2.0 · Last sync 2m ago                │
│ [ Sign out ]              [ Privacy notice ]               │
├────────────────────────────────────────────────────────────┤
│  Home      Board      (+)      Standup      Me             │
│                                              ●              │
└────────────────────────────────────────────────────────────┘
```

## Primary Data Inputs

- `users.csv`
- `team_members.csv`

## Page Layout

1. Header
   - User name
   - Role chip
   - Employee id
2. Contact Section
   - Email
   - Phone
3. Site Assignment Section
   - Contract/site code
   - Team role
4. Preferences Section
   - Push notifications enabled (stored on user; **push delivery** is out of MVP scope per [phase-5](../common/plans/phase-5-standup-pilot-hardening-and-mobile-readiness.md) — treat as preference-only for the pilot)
   - Dark mode enabled
5. Device and App Section
   - App version
   - Last sync time
6. Actions
   - Sign out
   - View privacy notice

## Render Rules

- Role label uses `UserRoleEnum` values only.
- Preferences map to `preferences.pushNotificationsEnabled` and `preferences.darkModeEnabled`.
- Keep the settings list short for MVP to reduce pilot friction.

## Empty States

- Missing phone: show "Add phone number" placeholder.
- No member link: show "Assignment pending" info state.
