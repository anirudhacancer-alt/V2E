# Mobile Strategy: Single Codebase with Capacitor

## Overview

V2E uses a **single codebase** approach:
- **One responsive web app** built with React + Tailwind (mobile-first)
- **Capacitor** wraps the web app into native iOS/Android apps
- **Same UI, same API, same experience** across web and native

**Scope:** This applies to **`apps/field-app`** + **`apps/mobile`** only. Other apps (`planning-web`, `marketing-site`) use Enact UI separately and do **not** share React components with the field app—see [Web UI and Enact UI](./web-ui-enact-ui.md#independent-surface-uis-locked).

## Why This Approach?

✅ **Single source of truth** - One React codebase to maintain  
✅ **Faster iteration** - Develop in browser, test on device  
✅ **Native features** - Capacitor provides camera, mic, push notifications  
✅ **App store distribution** - Wrap once, publish to iOS/Android stores  
✅ **Web fallback** - Works in mobile browser without install  

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NATIVE APP SHELL                         │
│              (Capacitor iOS/Android Wrapper)                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │          WEB APP (React + TanStack)                │   │
│  │                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │  Home    │ │  Tasks   │ │ Standup  │            │   │
│  │  │  Page    │ │  Board+  │ │  Prep    │            │   │
│  │  │          │ │  Detail  │ │          │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  │                                                     │   │
│  │  ┌──────────┐ ┌──────────┐                         │   │
│  │  │ Updates  │ │ Profile  │                         │   │
│  │  │  Page    │ │  Page    │                         │   │
│  │  └──────────┘ └──────────┘                         │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│              Capacitor Bridge (Native APIs)                 │
│                            │                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │  Camera    │  │    Mic     │  │   Files    │          │
│  │  Plugin    │  │  Plugin    │  │  Plugin    │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                            │
│                      (Bun + Hono)                           │
└─────────────────────────────────────────────────────────────┘
```

## Screen preview (typical shell)

One phone-sized frame: safe area, scrollable body, fixed bottom navigation (thumb reach). Content is illustrative; real screens are specified in [docs/field-app/AGENTS.md](../field-app/AGENTS.md).

```
 ┌─────────────────────────────────────────┐
 │  …  status bar / notch safe area  …     │
 ├─────────────────────────────────────────┤
 │  Header  (title · context · actions)    │
 ├─────────────────────────────────────────┤
 │                                         │
 │  ▲ scroll body (cards, lists, forms)   │
 │  │                                      │
 │  │                                      │
 │  ▼                                      │
 ├─────────────────────────────────────────┤
 │  Home   Board   (+)   Standup   Me      │
 │  home indicator safe area               │
 └─────────────────────────────────────────┘
```

## Development Workflow

### 1. Web Development (Primary)
```bash
cd apps/field-app
pnpm dev
# Develop at http://localhost:3001
# Mobile-first responsive design
# Test in Chrome DevTools mobile view
```

### 2. Native Testing
```bash
cd apps/mobile
# Capacitor syncs the web build
npx cap sync
# Run on device/simulator
npx cap run ios
npx cap run android
```

### 3. Production Build
```bash
# Build web app
pnpm build

# Capacitor copies build to native projects
npx cap sync

# Build native apps in Xcode/Android Studio
npx cap open ios
npx cap open android
```

## UI Design Principles

### Mobile-First
- Design for 375px - 428px width (iPhone SE to Pro Max)
- Touch targets minimum 48x48px
- Bottom navigation for thumb reachability
- Safe areas for notches and home indicators

### Responsive Breakpoints
```css
/* Mobile (default) */
.container {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    max-width: 720px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 960px;
  }
}
```

### Native-Like Feel
- Use `env(safe-area-inset-*)` for notch/home indicator
- Prevent pull-to-refresh on scrollable content (unless intended)
- Disable zoom on input focus
- Use `-webkit-tap-highlight-color: transparent`
- Hardware-accelerated animations

## Capacitor Configuration

### Required Plugins (Phase 1-2)
```typescript
// apps/mobile/capacitor.config.ts
export default {
  appId: 'app.v2e.mobile',
  appName: 'V2E',
  webDir: '../field-app/dist',
  bundledWebRuntime: false,
  plugins: {
    // Phase 3: Voice recording
    Microphone: {
      // Permissions configured in native projects
    },
    // Phase 3: Photo proof
    Camera: {
      // Photo capture settings
    },
    // Phase 5: Push notifications
    PushNotifications: {
      // FCM/APNs configuration
    },
  },
};
```

### Native Permissions
**iOS (Info.plist):**
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Record site updates and voice memos</string>
<key>NSCameraUsageDescription</key>
<string>Capture photo proof of work completion</string>
```

**Android (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
```

## File Structure

```
apps/
├── web/                    # Main web app (mobile-first)
│   ├── src/
│   │   ├── components/     # Shared React components
│   │   ├── routes/         # TanStack Router pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── styles/         # Global CSS, Tailwind
│   ├── index.html
│   └── vite.config.ts
│
└── mobile/                 # Capacitor wrapper
    ├── ios/               # iOS native project (generated)
    ├── android/           # Android native project (generated)
    ├── capacitor.config.ts
    └── package.json
```

## Key Differences from Separate Mobile App

| Approach | Separate Native | Capacitor Wrapper (Our Choice) |
|----------|----------------|--------------------------------|
| **Codebase** | 2+ (iOS, Android, Web) | 1 (Web only) |
| **Team** | Native + Web developers | Web developers only |
| **UI** | Platform-specific | Consistent across all |
| **Features** | Full native access | Via Capacitor plugins |
| **Maintenance** | Multiple codebases | Single codebase |
| **Performance** | Native speed | Near-native (WebView) |

## Web-first capture (pilot)

For **photo proof** on phones, the field app web app uses the **browser file picker** (`<input type="file" accept="image/*">`, often with `capture` for camera-on-mobile) and uploads to the API; images are stored as `update_attachments` and loaded via **`/uploads/...`** URLs. That path works in mobile Safari/Chrome and through Capacitor’s WebView without requiring the Capacitor Camera plugin first.

**Capacitor-native** microphone/camera plugins remain the right choice when you need stricter permission UX, background recording, or richer camera controls.

## When to Use Native Code

Most features work in web + Capacitor. Use native code only for:
- Background audio recording (Phase 3)
- Advanced camera controls (Phase 3)
- Push notifications with rich content (Phase 5)
- Deep OS integrations not covered by Capacitor plugins

## Testing Strategy

1. **Browser Development**: Chrome DevTools mobile view
2. **Local Network**: Test on real devices via LAN
3. **Native Preview**: Capacitor live reload
4. **Beta Testing**: TestFlight (iOS) / Play Console (Android)

## Summary

✅ **One React web app** - Mobile-first responsive design  
✅ **Capacitor wrapper** - No separate mobile codebase  
✅ **Native features** - Via plugins when needed  
✅ **App store ready** - Can publish to iOS/Android stores  

All task files (P1.x and P2.x) assume this single-codebase approach with mobile-first layouts.
