import type { ReactNode } from "react";
import { cx, supervisorCardRadiusClass } from "../../lib/supervisor-layout";

interface SupervisorSectionCardProps {
	title?: string;
	icon?: ReactNode;
	actions?: ReactNode;
	className?: string;
	contentClassName?: string;
	headerClassName?: string;
	children: ReactNode;
}

export function SupervisorSectionCard({
	title,
	icon,
	actions,
	className,
	contentClassName,
	headerClassName,
	children,
}: SupervisorSectionCardProps) {
	const hasHeader = Boolean(title || icon || actions);

	return (
		<div
			className={cx(
				supervisorCardRadiusClass,
				"supervisor-material-card",
				className,
			)}
		>
			<div className={cx("p-4", contentClassName)}>
				{hasHeader ? (
					<div
						className={cx(
							"mb-4 flex items-center justify-between gap-3",
							headerClassName,
						)}
					>
						<div className="flex min-w-0 items-center gap-2">
							{icon}
							{title ? (
								<h2 className="text-sm font-semibold uppercase tracking-wider text-content-secondary">
									{title}
								</h2>
							) : null}
						</div>
						{actions ? <div className="shrink-0">{actions}</div> : null}
					</div>
				) : null}
				{children}
			</div>
		</div>
	);
}
