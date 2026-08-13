import { Card } from "@enact-ui/react";
import type { ReactNode } from "react";
import { cx, supervisorCardRadiusClass } from "../../lib/supervisor-layout";

interface SupervisorEntityCardProps {
	children: ReactNode;
	className?: string;
	onClick?: () => void;
}

/**
 * List row card shell: Enact `Card`, consistent elevation and press affordance when `onClick` is set.
 */
export function SupervisorEntityCard({
	children,
	className,
	onClick,
}: SupervisorEntityCardProps) {
	return (
		<Card
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onClick();
							}
						}
					: undefined
			}
			className={cx(
				"supervisor-material-card supervisor-material-interactive relative overflow-hidden p-4",
				supervisorCardRadiusClass,
				onClick && "cursor-pointer hover:bg-surface-sunken/55",
				className,
			)}
		>
			{children}
		</Card>
	);
}
