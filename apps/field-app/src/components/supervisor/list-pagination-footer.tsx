import { cx } from "../../lib/supervisor-layout";

interface SupervisorListPaginationFooterProps {
  showing: number;
  total: number;
  noun: string;
  className?: string;
}

export function SupervisorListPaginationFooter({
  showing,
  total,
  noun,
  className,
}: SupervisorListPaginationFooterProps) {
  return (
    <div className={cx("mt-6 text-center text-sm text-content-tertiary", className)}>
      Showing {showing} of {total} {noun}
    </div>
  );
}
