import { Button } from "@enact-ui/react";
import { Filter, RefreshCw } from "lucide-react";
import { brandCtaButtonClass } from "../../lib/brand-gradient";
import {
  cx,
  supervisorControlRadiusClass,
  type SupervisorContainerWidth,
} from "../../lib/supervisor-layout";
import { SupervisorPageHeader } from "./page-header";

interface SupervisorFilterOption<T extends string> {
  label: string;
  value: T;
}

interface SupervisorListPageHeaderProps<T extends string> {
  title: string;
  count: number;
  countLabel: string;
  filters: readonly SupervisorFilterOption<T>[];
  activeFilter: T;
  onFilterChange: (value: T) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  refreshHint?: string;
  width?: SupervisorContainerWidth;
}

export function SupervisorListPageHeader<T extends string>({
  title,
  count,
  countLabel,
  filters,
  activeFilter,
  onFilterChange,
  onRefresh,
  isRefreshing = false,
  refreshHint,
  width = "wide",
}: SupervisorListPageHeaderProps<T>) {
  return (
    <SupervisorPageHeader
      title={`${title} · ${count} ${countLabel}`}
      width={width}
      sticky
      surface="secondary"
      actions={(
        <Button
          type="button"
          color="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cx(
            "h-11 w-11 border p-0 lg:hidden",
            supervisorControlRadiusClass,
          )}
        >
          <RefreshCw className={cx("h-5 w-5", isRefreshing && "animate-spin")} />
        </Button>
      )}
    >
      {refreshHint ? (
        <div className="mb-3 flex items-center justify-center gap-1 text-xs text-content-tertiary lg:hidden">
          <RefreshCw className="h-3 w-3" />
          <span>{refreshHint}</span>
        </div>
      ) : null}

      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-content-tertiary lg:hidden">
        <Filter className="h-4 w-4" />
        <span>Status</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <div className="hidden items-center gap-2 text-content-tertiary lg:flex lg:shrink-0">
          <Filter className="h-4 w-4" />
        </div>
        {filters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            color={activeFilter === filter.value ? "primary" : "secondary"}
            size="sm"
            onClick={() => onFilterChange(filter.value)}
            className={cx(
              "supervisor-material-interactive min-h-[44px] w-full justify-center sm:w-auto",
              supervisorControlRadiusClass,
              activeFilter === filter.value
                ? cx(
                    "supervisor-material-pill-active border-0 text-content-on-brand! -translate-y-0.5",
                    brandCtaButtonClass,
                  )
                : "border border-border-muted/70 bg-surface-primary/80 text-content-primary shadow-none hover:bg-surface-secondary/45",
            )}
          >
            {filter.label}
          </Button>
        ))}
      </div>
    </SupervisorPageHeader>
  );
}
