import type { LucideIcon } from "lucide-react";
import {
  brandCtaButtonClass,
} from "../../lib/brand-gradient";
import {
  cx,
  supervisorContainerClass,
  supervisorFixedHeaderHeightClass,
  type SupervisorContainerWidth,
} from "../../lib/supervisor-layout";

export interface SupervisorCompactFilter<T extends string> {
  value: T;
  icon: LucideIcon;
  /** Short visible label (one word when possible). */
  label: string;
}

interface SupervisorCompactListHeaderProps<T extends string> {
  title: string;
  count: number;
  filters: readonly SupervisorCompactFilter<T>[];
  /** `null` = no chip selected (show all per page rules). Tap active chip again to clear. */
  activeFilter: T | null;
  onFilterChange: (value: T | null) => void;
  width?: SupervisorContainerWidth;
  /**
   * When true, omits the title/count row and its divider (filters only). Use when nav already
   * shows the page name (e.g. Updates) to save vertical space.
   */
  hideTitleRow?: boolean;
  /**
   * When sticky, sets the top offset (e.g., "60px" when below a search header).
   * Defaults to "0px" (top of viewport).
   */
  stickyTop?: string;
}

export function SupervisorCompactListHeader<T extends string>({
  title,
  count,
  filters,
  activeFilter,
  onFilterChange,
  width = "wide",
  hideTitleRow: _hideTitleRow,
  stickyTop,
}: SupervisorCompactListHeaderProps<T>) {
  return (
    <div
      className="fixed left-0 right-0 z-40 bg-transparent"
      style={stickyTop ? { top: stickyTop } : { top: "60px" }}
    >
      <h1 className="sr-only">{title}{count > 0 ? ` · ${count}` : ""}</h1>
      <div className={cx(supervisorContainerClass(width), supervisorFixedHeaderHeightClass, "max-w-7xl w-full flex items-center")}>
        <div
          className="supervisor-material-frost flex w-full items-stretch gap-1.5 rounded-full px-1 py-1"
          role="toolbar"
          aria-label="Filters"
        >
          {filters.map((filter) => {
            const Icon = filter.icon;
            const selected =
              activeFilter !== null && activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() =>
                  selected ? onFilterChange(null) : onFilterChange(filter.value)
                }
                className={cx(
                  "supervisor-material-interactive flex min-h-[42px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-1.5 py-1.5 sm:flex-row sm:gap-1.5 sm:px-2.5 sm:py-2 rounded-full",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                  selected
                    ? cx(
                        "supervisor-material-pill-active border-0 text-content-on-brand! -translate-y-0.5",
                        brandCtaButtonClass,
                      )
                    : cx(
                        "border border-border-muted/70 bg-surface-primary/80 text-content-primary shadow-none",
                        "hover:bg-surface-secondary/45 hover:text-content-primary",
                      ),
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden strokeWidth={selected ? 2.25 : 2} />
                <span
                  className={cx(
                    "min-w-0 truncate text-center text-xs font-semibold leading-none tracking-tight",
                    selected ? "text-content-on-brand!" : "text-inherit",
                  )}
                >
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
