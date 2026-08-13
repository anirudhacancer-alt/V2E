import type { LucideIcon } from "lucide-react";
import {
  Home,
  ClipboardList,
  MessageSquare,
  Users,
  User,
} from "lucide-react";

/** Desktop sidebar navigation (full supervisor IA). */
export const supervisorSidebarNavItems = [
  { to: "/supervisor/home", label: "Home", icon: Home },
  { to: "/supervisor/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/supervisor/updates", label: "Updates", icon: MessageSquare },
  { to: "/supervisor/standup", label: "Standup", icon: Users },
  { to: "/supervisor/profile", label: "Profile", icon: User },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  icon: LucideIcon;
}>;

/** Mobile bottom bar: four tabs + center Record FAB (not in this list). */
export const supervisorBottomNavItems = [
  { to: "/supervisor/home", label: "Home", icon: Home },
  { to: "/supervisor/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/supervisor/updates", label: "Updates", icon: MessageSquare },
  { to: "/supervisor/profile", label: "Profile", icon: User },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  icon: LucideIcon;
}>;

export const supervisorRecordPath = "/supervisor/record";

/** True when the main nav “Record” affordance should read as active. */
export function isRecordRouteActive(pathname: string): boolean {
  return (
    pathname === supervisorRecordPath ||
    /^\/supervisor\/[^/]+\/(review|extraction)$/.test(pathname)
  );
}

/** Exact path match for tab highlighting. */
export function isNavPathActive(pathname: string, navTo: string): boolean {
  return pathname === navTo;
}
