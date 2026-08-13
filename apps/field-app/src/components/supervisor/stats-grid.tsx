import type { ReactNode } from "react";
import { cx } from "../../lib/supervisor-layout";

interface SupervisorStatsGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive grid for dashboard `StatisticCard` blocks (or similar KPIs).
 */
export function SupervisorStatsGrid({ children, className }: SupervisorStatsGridProps) {
  return (
    <div className={cx("grid grid-cols-2 gap-4 xl:grid-cols-4", className)}>{children}</div>
  );
}
