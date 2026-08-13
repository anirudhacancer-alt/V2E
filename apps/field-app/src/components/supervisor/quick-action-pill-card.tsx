import { Card } from "@enact-ui/react";
import type { ReactNode } from "react";
import { cx, supervisorCardRadiusClass } from "../../lib/supervisor-layout";

interface SupervisorQuickActionPillCardProps {
	icon: ReactNode;
	title: string;
	className?: string;
}

/**
 * Home quick-action pill card shell (`New Task`, `Standup`, etc.).
 * Keep this centralized so spacing, radius, and elevation iterate in one place.
 */
export function SupervisorQuickActionPillCard({
	icon,
	title,
	className,
}: SupervisorQuickActionPillCardProps) {
	return (
		<Card
			className={cx(
				"supervisor-material-card supervisor-material-interactive h-full cursor-pointer p-2",
				supervisorCardRadiusClass,
				className,
			)}
		>
			<div className="flex h-full items-center gap-3">
				<div className="supervisor-material-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
					{icon}
				</div>
				<p className="text-base font-semibold text-content-primary">{title}</p>
			</div>
		</Card>
	);
}
