import { Badge } from "@enact-ui/react";
import { cx } from "../lib/supervisor-layout";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<
  string,
  { color: "gray" | "warning" | "error"; label: string }
> = {
  /** Product note queue */
  review: { color: "warning", label: "Review" },
  linked: { color: "gray", label: "Linked" },
  /** Legacy raw statuses */
  pending: { color: "warning", label: "Pending" },
  processed: { color: "gray", label: "Processed" },
  rejected: { color: "error", label: "Rejected" },
  escalated: { color: "error", label: "Escalated" },
  convertedtotask: { color: "gray", label: "Task" },
  saved: { color: "gray", label: "Saved" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config =
    statusStyles[normalizedStatus] ??
    { color: "gray" as const, label: status };

  return (
    <Badge color={config.color} variant="subtle" size="sm" className={className}>
      {config.label}
    </Badge>
  );
}

/** Task / standup severity — same pill language as {@link StatusBadge} */
const severityStyles: Record<string, "gray" | "warning" | "error"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "gray",
};

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const key = severity.toLowerCase();
  const color = severityStyles[key] ?? "gray";

  return (
    <Badge
      color={color}
      variant="subtle"
      size="sm"
      className={cx("shrink-0", className)}
    >
      {severity}
    </Badge>
  );
}
