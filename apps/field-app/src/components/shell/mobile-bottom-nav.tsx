import { Link } from "@tanstack/react-router";
import { Button } from "@enact-ui/react";
import { Mic } from "lucide-react";
import { brandMicFabButtonClass } from "../../lib/brand-gradient";
import {
  isNavPathActive,
  isRecordRouteActive,
  supervisorRecordPath,
} from "../../lib/navigation";
import { cx } from "../../lib/supervisor-layout";
import type { LucideIcon } from "lucide-react";
type BottomItem = { to: string; label: string; icon: LucideIcon };

interface MobileBottomNavProps {
  pathname: string;
  items: readonly BottomItem[];
}

export function MobileBottomNav({ pathname, items }: MobileBottomNavProps) {
  const recordActive = isRecordRouteActive(pathname);
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <nav className="safe-area-x fixed inset-x-0 bottom-0 z-30 lg:hidden">
      {/* Pill-shaped navbar container with mic inside */}
      <div className="mx-4 rounded-full bg-surface-primary/95 px-1 py-1 shadow-xl backdrop-blur-md border border-border-default/20">
        <div className="grid grid-cols-5 items-center gap-1">
            {left.map((item) => {
              const Icon = item.icon;
              const active = isNavPathActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cx(
                    "supervisor-material-interactive flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-center transition-all",
                    active 
                      ? "scale-[1.04] text-content-brand" 
                      : "text-content-tertiary hover:text-content-secondary"
                  )}
                >
                  <Icon className={cx("h-6 w-6 shrink-0", active && "scale-105")} />
                  <span className={cx("truncate text-[10px] font-medium leading-tight", active && "text-content-brand")}>{item.label}</span>
                </Link>
              );
            })}

            {/* Mic Button - positioned inside the container */}
            <div className="flex flex-col items-center justify-center -mt-6">
              <Link
                to={supervisorRecordPath}
                aria-label="Record"
                className="flex min-w-0 flex-col items-center"
              >
                <Button
                  color="primary"
                  className={cx(
                    "supervisor-material-fab supervisor-material-interactive supervisor-material-mic-idle h-[72px] w-[72px] rounded-full border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 shadow-xl",
                    brandMicFabButtonClass,
                    recordActive && "ring-2 ring-sky-400/85 ring-offset-0",
                  )}
                >
                  <Mic className="h-10 w-10" />
                </Button>
              </Link>
            </div>

            {right.map((item) => {
              const Icon = item.icon;
              const active = isNavPathActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cx(
                    "supervisor-material-interactive flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-center transition-all",
                    active 
                      ? "scale-[1.04] text-content-brand" 
                      : "text-content-tertiary hover:text-content-secondary"
                  )}
                >
                  <Icon className={cx("h-6 w-6 shrink-0", active && "scale-105")} />
                  <span className={cx("truncate text-[10px] font-medium leading-tight", active && "text-content-brand")}>{item.label}</span>
                </Link>
              );
            })}
        </div>
      </div>
    </nav>
  );
}
