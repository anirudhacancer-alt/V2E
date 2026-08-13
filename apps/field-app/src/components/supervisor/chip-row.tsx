import type { ReactNode } from "react";
import { cx } from "../../lib/supervisor-layout";

interface SupervisorChipRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal wrap row for status / metadata chips (`Badge` children from Enact).
 */
export function SupervisorChipRow({ children, className }: SupervisorChipRowProps) {
  return (
    <div className={cx("mb-2 flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}
