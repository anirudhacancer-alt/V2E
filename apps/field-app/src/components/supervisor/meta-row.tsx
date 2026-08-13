import type { ReactNode } from "react";
import { cx } from "../../lib/supervisor-layout";

interface SupervisorMetaRowProps {
  children: ReactNode;
  className?: string;
}

export function SupervisorMetaRow({ children, className }: SupervisorMetaRowProps) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 text-sm text-content-secondary lg:gap-4",
        className
      )}
    >
      {children}
    </div>
  );
}

interface SupervisorMetaItemProps {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  /** Hide entire item when false (e.g. unknown assignee) */
  when?: boolean;
}

export function SupervisorMetaItem({
  icon,
  children,
  className,
  when = true,
}: SupervisorMetaItemProps) {
  if (!when) {
    return null;
  }

  return (
    <div
      className={cx(
        "flex min-h-[32px] min-w-[44px] max-w-full items-center gap-1.5",
        className
      )}
    >
      <span className="text-content-tertiary">{icon}</span>
      <span className="max-w-full truncate sm:max-w-[100px]">{children}</span>
    </div>
  );
}
