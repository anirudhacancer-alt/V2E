import { Card } from "@enact-ui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

import {
	cx,
	supervisorCardRadiusClass,
	supervisorControlMinHeightClass,
} from "../../lib/supervisor-layout";

export interface SupervisorCollapsibleSectionProps {
	title: string;
	icon: ReactNode;
	/**
	 * Optional numeric badge in the header (e.g. standup list counts).
	 * Omit to hide the trailing count column (e.g. risk assessment on extraction).
	 */
	count?: number;
	/** When `count === 0` and set, shows this message instead of `children`. */
	emptyMessage?: string;
	expanded: boolean;
	onToggle: () => void;
	children: ReactNode;
	/** Optional wrapper class on the outer `Card`. */
	className?: string;
}

/**
 * Compact collapsible block: shared shell with standup list sections — short collapsed
 * header (shared control min-height + `px-3 py-2`), chevron, animated expand.
 * Use one implementation
 * so supervisor pages stay visually aligned.
 */
export function SupervisorCollapsibleSection({
	title,
	icon,
	count,
	emptyMessage,
	expanded,
	onToggle,
	children,
	className,
}: SupervisorCollapsibleSectionProps) {
	const showEmpty =
		typeof count === "number" && count === 0 && emptyMessage !== undefined;

	return (
		<Card
			className={cx(
				supervisorCardRadiusClass,
				"supervisor-material-card overflow-hidden p-0",
				className,
			)}
		>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
				className={cx(
					"supervisor-material-interactive flex w-full items-center justify-between gap-2 px-3 py-2 text-left active:bg-surface-secondary/50 sm:px-4",
					supervisorControlMinHeightClass,
				)}
			>
				<div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
					<span className="flex h-8 w-8 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
						{icon}
					</span>
					<h2 className="truncate text-sm font-semibold leading-tight text-content-primary">
						{title}
					</h2>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{typeof count === "number" ? (
						<span className="tabular-nums text-xs text-content-tertiary">
							{count}
						</span>
					) : null}
					{expanded ? (
						<ChevronUp className="h-4 w-4 text-content-tertiary" aria-hidden />
					) : (
						<ChevronDown
							className="h-4 w-4 text-content-tertiary"
							aria-hidden
						/>
					)}
				</div>
			</button>

			<div
				className={`overflow-hidden transition-all duration-200 ease-in-out ${
					expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
				}`}
			>
				<div className="border-t border-border-muted px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
					{showEmpty ? (
						<p className="py-1 text-sm text-content-tertiary italic">
							{emptyMessage}
						</p>
					) : (
						children
					)}
				</div>
			</div>
		</Card>
	);
}
