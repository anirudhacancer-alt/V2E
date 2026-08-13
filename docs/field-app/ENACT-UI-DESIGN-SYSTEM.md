# Enact UI Design System Guidelines

## Core Philosophy

**Stay native to Enact UI.** The design system provides consistent spacing, typography, and component behaviors. Avoid adding explicit padding, margins, or styling that conflicts with the system's defaults.

---

## Card Component System

### ⚠️ CRITICAL: Card Already Has Padding Built-In

**The `Card` component automatically wraps children in a `p-4` div. DO NOT use `CardContent` inside `Card` - this creates double padding!**

**The problem:**
```tsx
// ❌ WRONG - Creates double padding (32px total)
<Card>
  <CardContent>  {/* Card already has p-4, CardContent adds p-4 pt-0 */}
    Content gets 32px padding!
  </CardContent>
</Card>
```

**The solution:**
```tsx
// ✅ CORRECT - Just use Card, it has built-in padding
<Card>
  <div className="space-y-4">  {/* Use regular div for layout */}
    Content gets proper 16px padding
  </div>
</Card>
```

### Default Padding Values

The Card system from `@enact-ui/react` has carefully designed padding defaults:

```typescript
// Card (base component)
// - Children content area: p-4 (16px) - AUTOMATICALLY APPLIED
// - Header: px-4 py-3 (16px horizontal, 12px vertical)
// - Footer: px-4 py-3 (16px horizontal, 12px vertical)

// CardContent - USE ONLY OUTSIDE OF CARD
// - Default: p-4 pt-0 (16px all sides, but 0 top)
// - Use Case: When you need a padded container but NOT inside a Card

// CardHeader  
// - Default: p-4 (16px all sides)

// CardFooter
// - Default: p-4 pt-0 (16px all sides, but 0 top)
```

### Anti-Patterns ❌

**NEVER add explicit padding to Card subcomponents:**

```tsx
// ❌ WRONG - Doubles the padding
<Card>
  <CardContent className="p-5">  {/* 20px + built-in 16px = 36px total */}
    Content
  </CardContent>
</Card>

// ❌ WRONG - Redundant
<CardContent className="p-4">  {/* Already has p-4 built-in */}
  Content
</CardContent>

// ❌ WRONG - Use default instead
<CardHeader className="pb-4">  {/* Already has consistent padding */}
  <CardTitle>Title</CardTitle>
</CardHeader>
```

### Correct Usage ✅

```tsx
// ✅ CORRECT - Use component defaults
<Card>
  <CardHeader>
    <CardTitle>Task Details</CardTitle>
  </CardHeader>
  <CardContent>
    Content automatically gets proper padding
  </CardContent>
</Card>

// ✅ CORRECT - Override only when necessary
<CardContent className="p-0">  {/* Remove padding for custom layouts */}
  <CustomLayout />
</CardContent>

// ✅ CORRECT - Smaller padding for compact items
<CardContent className="p-3">  {/* Intentionally compact: 12px */}
  <CompactListItem />
</CardContent>

// ✅ CORRECT - Use layout utilities instead
<CardContent className="space-y-4">  {/* Gap between children */}
  <Item1 />
  <Item2 />
</CardContent>
```

---

## Common Pitfalls

### 1. Double Padding Pattern

**Problem:** Adding explicit padding to components that already have it.

```tsx
// ❌ AVOID
<Card className="rounded-3xl">
  <CardContent className="p-5 flex flex-col">  {/* Extra padding */}
    <div className="p-3">Icon</div>
    <h3>Title</h3>
  </CardContent>
</Card>

// ✅ PREFER
<Card className="rounded-3xl">
  <CardContent className="flex flex-col">
    <div className="mb-3">Icon</div>
    <h3>Title</h3>
  </CardContent>
</Card>
```

### 2. Inconsistent Wrapper Components

When creating wrapper components around Enact UI cards, don't add default padding:

```tsx
// ❌ WRONG - entity-card.tsx
export function SupervisorEntityCard({ children, contentClassName }) {
  return (
    <Card>
      <CardContent className={cx("p-4", contentClassName)}>  {/* Doubles padding */}
        {children}
      </CardContent>
    </Card>
  );
}

// ✅ CORRECT - Let CardContent use its defaults
export function SupervisorEntityCard({ children, contentClassName }) {
  return (
    <Card>
      <CardContent className={cx(contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
```

### 3. Spacing Between Elements

Use layout utilities instead of padding overrides:

```tsx
// ❌ WRONG - Using padding for spacing
<CardContent className="p-6">  {/* Bigger padding for spacing */}
  <h3>Title</h3>
  <p className="mt-4">Content</p>
</CardContent>

// ✅ CORRECT - Use gap or space utilities
<CardContent className="space-y-4">
  <h3>Title</h3>
  <p>Content</p>
</CardContent>
```

### 4. Edge-to-Edge Content (List Items, Tables)

**CRITICAL:** When you need content that goes edge-to-edge (like list items or settings rows), **DO NOT use Card** because its automatic `p-4` wrapper cannot be disabled from outside.

**The Problem:**
```tsx
// ❌ WRONG - p-0 doesn't help because it's INSIDE Card's p-4 wrapper
<Card>
  <div className="p-0">  {/* Still wrapped in Card's p-4 */}
    <button className="px-4 py-4">Item 1</button>  {/* 16px + 16px = 32px */}
    <button className="px-4 py-4">Item 2</button>
  </div>
</Card>
```

**The Solution - Use Plain Div with Card Styling:**
```tsx
// ✅ CORRECT - Use div with Card's visual classes, handle padding yourself
<div className="rounded-2xl overflow-hidden border border-border-default bg-surface-base shadow-sm">
  <button className="p-4">Item 1</button>  {/* Just 16px padding */}
  <button className="p-4">Item 2</button>
</div>
```

**Example from Profile Page:**
```tsx
// SettingsSection - List of buttons that need edge-to-edge layout
function SettingsSection({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      {/* Use div instead of Card for edge-to-edge content */}
      <div className="rounded-2xl overflow-hidden border border-border-default bg-surface-base shadow-sm">
        {children}
      </div>
    </div>
  );
}

function SettingsItem({ icon, label, description }) {
  return (
    <button type="button" className="flex min-h-[72px] w-full items-start gap-3 p-4 text-left">
      {/* Content with single 16px padding */}
    </button>
  );
}
```

---

## Route-Specific Patterns

### Home Page (/supervisor/home)

**Statistics Cards:** Use `StatisticCard` from Enact UI - it has optimized padding for KPI displays.

**Quick Action Cards:** Use `Card` + `CardContent` without explicit padding:

```tsx
<Card className="h-full cursor-pointer rounded-3xl border border-border-muted">
  <CardContent className="flex flex-col">  {/* No p-5 */}
    <div className="mb-3">Icon</div>
    <p>Title</p>
  </CardContent>
</Card>
```

### Task Detail Page (/supervisor/tasks/$taskId)

```tsx
<Card className="rounded-2xl">
  <CardContent className="space-y-4">  {/* No p-4 */}
    {/* Content */}
  </CardContent>
</Card>
```

### Profile Page (/supervisor/profile)

**Regular Cards:**
```tsx
<Card className="rounded-2xl">
  <div className="flex flex-col items-center text-center">
    {/* Content - Card provides p-4 padding */}
  </div>
</Card>
```

**Settings Lists (Edge-to-Edge):**
```tsx
// ❌ WRONG - Card adds automatic padding that can't be removed
<Card className="rounded-2xl overflow-hidden">
  <div className="p-0">  {/* Still inside Card's p-4 wrapper */}
    <button className="px-4 py-4">Item</button>  {/* 32px total padding */}
  </div>
</Card>

// ✅ CORRECT - Use div with Card styling for edge-to-edge lists
<div className="rounded-2xl overflow-hidden border border-border-default bg-surface-base shadow-sm">
  <button className="p-4">Item</button>  {/* Single 16px padding */}
</div>
```

### Standup Page (/supervisor/standup)

**Compact List Items:** Intentionally use smaller padding for dense lists:

```tsx
// ✅ CORRECT - Compact items need less padding
<Card className="bg-green-50 border-0 rounded-xl">
  <CardContent className="p-3 flex items-start gap-3">
    <Icon />
    <div>Content</div>
  </CardContent>
</Card>
```

---

## Section Card Pattern

When creating section containers, be mindful of padding:

```tsx
// ❌ WRONG - section-card.tsx
<div className={cx("p-5", contentClassName)}>  {/* Too much padding */}

// ✅ CORRECT - Use consistent padding
<div className={cx("p-4", contentClassName)}>  {/* Matches CardContent */}
```

---

## Validation Checklist

Before committing components using Cards:

- [ ] **NO `CardContent` inside `Card` components** - This creates double padding!
- [ ] **Edge-to-edge content (lists, tables) uses div with Card styling** - NOT Card component
- [ ] No `p-4`, `p-5`, `p-6` classes on content containers inside Cards
- [ ] No `p-4`, `p-5`, `p-6` classes on `CardHeader` or `CardFooter`
- [ ] Wrapper components don't add default padding to Card subcomponents
- [ ] Use `space-y-*` or `gap-*` for spacing between children
- [ ] Only override padding when intentionally making items compact (`p-3`) or removing it (`p-0`)
- [ ] Check both mobile and desktop breakpoints for spacing consistency

---

## Migration Guide

### Step 1: Remove CardContent from Inside Card Components

**CRITICAL:** Card already has built-in padding. CardContent inside Card creates double padding.

**Find offending patterns:**
```bash
# Find CardContent inside Card components
grep -r "<Card.*>[\s\n]*<CardContent" --include="*.tsx" src/

# Find all CardContent usages
grep -r "CardContent" --include="*.tsx" src/
```

**Before:**
```tsx
import { Card, CardContent } from "@enact-ui/react";

<Card className="rounded-2xl">
  <CardContent className="space-y-4">
    <h3>Title</h3>
    <p>Content</p>
  </CardContent>
</Card>
```

**After:**
```tsx
import { Card } from "@enact-ui/react";

<Card className="rounded-2xl">
  <div className="space-y-4">
    <h3>Title</h3>
    <p>Content</p>
  </div>
</Card>
```

**Note:** CardContent is still valid when used OUTSIDE of a Card component as a standalone padded container.

---

## Automated Quality Check

We provide a script to automatically detect double padding issues:

```bash
# Run the padding quality check
pnpm check:padding

# Run all quality checks (padding + typecheck + tests)
pnpm check:all
```

**What it checks:**
- Card components with children that have `p-4` or higher padding classes
- These patterns create double padding (Card's p-4 + child's p-4 = 32px)
- Ignores intentional compact styling (p-0, p-1, p-2, p-3)

**Example output:**
```
🔍 Checking for Card padding issues...

❌ apps/field-app/src/routes/supervisor/home.tsx
  Card "Card" at line 186:
    Line 188: <div className="p-5 flex flex-col">...
    Padding found: p-5

============================================================
❌ Found 1 issue(s) in 1 file(s)

💡 Tip: Card components already have built-in p-4 padding.
   Remove explicit padding from direct children.
```

### Step 3: Manual Search for Remaining Issues

Search for remaining padding patterns:

```bash
# Find explicit padding on CardContent
grep -r "CardContent.*p-[0-9]" --include="*.tsx" src/

# Find padding on Cards themselves
grep -r "Card.*className.*p-[0-9]" --include="*.tsx" src/
```

### Step 4: Remove Redundant Padding

**Before:**
```tsx
<CardContent className="p-5 flex flex-col">
```

**After:**
```tsx
<div className="flex flex-col">
```

### Step 5: Replace with Layout Utilities

**Before:**
```tsx
<CardContent className="p-6">
  <h3>Title</h3>
  <p className="mt-4">Description</p>
</CardContent>
```

**After:**
```tsx
<CardContent className="space-y-4">
  <h3>Title</h3>
  <p>Description</p>
</CardContent>
```

### Step 6: Test Visual Regression

- Check all routes that use Cards
- Verify padding looks consistent
- Ensure no content is touching edges unexpectedly

---

## Design Token Reference

Enact UI uses these design tokens for spacing:

| Token | Value | Usage |
|-------|-------|-------|
| `p-3` | 12px | Compact items, list rows |
| `p-4` | 16px | Default card content |
| `p-5` | 20px | **Never use on Card subcomponents** |
| `p-6` | 24px | **Never use on Card subcomponents** |

---

## Files to Monitor

Keep these files clean of padding overrides:

- `apps/field-app/src/routes/supervisor/*.tsx`
- `apps/field-app/src/components/supervisor/*.tsx`
- Any component wrapping `Card`, `CardContent`, `CardHeader`, `CardFooter`

---

## Related Components

- **StatisticCard:** Has optimized internal padding - never add external padding
- **EmptyState:** Follows Card padding conventions
- **SupervisorSectionCard:** Use `p-4` consistently, not `p-5`
- **SupervisorEntityCard:** Don't add `p-4` to CardContent wrapper

---

## Questions?

When in doubt:
1. Check the Enact UI source in `/enact-ui/packages/react/src/components/base/card/`
2. Look at existing implementations in this codebase
3. Prefer less explicit styling - let the design system handle it
