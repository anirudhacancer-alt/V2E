import type { ReactNode } from "react";
import { cx } from "../../lib/supervisor-layout";

interface SupervisorSplitActionBarProps {
  start: ReactNode;
  end: ReactNode;
  className?: string;
}

/**
 * Equal-width primary/secondary actions (record review, manual text note, etc.).
 */
export function SupervisorSplitActionBar({ start, end, className }: SupervisorSplitActionBarProps) {
  return (
    <div className={cx("flex gap-3", className)}>
      <div className="min-w-0 flex-1">{start}</div>
      <div className="min-w-0 flex-1">{end}</div>
    </div>
  );
}
