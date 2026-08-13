import { cx, supervisorControlRadiusClass } from "./supervisor-layout";

/**
 * Teal brand fill — darker at top-left, lighter toward bottom-right (subtle depth).
 * Stops align with the former Quick Action direction, reversed for the requested look.
 */
export const brandShellGradientClass =
  "bg-gradient-to-br from-[rgb(20,123,128)] via-[#2a9d94] to-[#51B9AD]";

export const brandShellGradientHoverClass =
  "transition-[filter,box-shadow] hover:brightness-[1.06] active:brightness-[0.98]";

export const brandShellShadowMdClass =
  "shadow-md shadow-[rgb(20,123,128)]/35 hover:shadow-lg hover:shadow-[rgb(20,123,128)]/40";

export const brandShellShadowFabClass =
  "shadow-lg shadow-[rgb(20,123,128)]/30 hover:shadow-xl hover:shadow-[rgb(20,123,128)]/35";

/** Hero Quick Action row — pill button + icon tray. */
export const brandQuickActionButtonClass = cx(
  brandShellGradientClass,
  brandShellGradientHoverClass,
  brandShellShadowMdClass,
  supervisorControlRadiusClass,
  /** Match Enact primary `Button`’s `::before` inset border to the same radius as the shell. */
  "before:rounded-3xl",
  "border-0 !text-content-on-brand",
);

/** Large circular record / playback controls (elevated). */
export const brandMicFabButtonClass = cx(
  brandShellGradientClass,
  brandShellGradientHoverClass,
  brandShellShadowFabClass,
  /** Align Enact primary `Button` `::before` with `rounded-full` shells (bottom nav mic, etc.). */
  "before:rounded-full",
  "text-content-on-brand",
);

/** Compact circular brand control (e.g. inline audio play) — same gradient, no FAB shadow. */
export const brandMicIconButtonClass = cx(
  brandShellGradientClass,
  brandShellGradientHoverClass,
  "text-content-on-brand",
);

/** Rectangular primary actions (submit, transcribe, etc.). */
export const brandCtaButtonClass = cx(
  brandShellGradientClass,
  brandShellGradientHoverClass,
  supervisorControlRadiusClass,
  "before:rounded-3xl",
  "!text-content-on-brand",
);

/** Horizontal progress fill (darker at start, lighter toward end). */
export const brandProgressFillClass =
  "bg-gradient-to-r from-[rgb(20,123,128)] to-[#51B9AD]";

/** Supervisor list filter chips — unselected icon + label (matches gradient anchor teal). */
export const brandFilterInactiveTextClass = "text-[rgb(20,123,128)]";

/** Unselected chip border — brand tint, not neutral black. */
export const brandFilterInactiveBorderClass = "border-[rgb(20,123,128)]/40";
