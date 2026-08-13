import { Card, CardContent } from "@enact-ui/react";
import { AlertCircle } from "lucide-react";
import {
	cx,
	type SupervisorContainerWidth,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
} from "../../lib/supervisor-layout";

interface SupervisorPageErrorStateProps {
	title: string;
	message: string;
	width?: SupervisorContainerWidth;
	pageClassName?: string;
}

export function SupervisorPageErrorState({
	title,
	message,
	width = "wide",
	pageClassName,
}: SupervisorPageErrorStateProps) {
	return (
		<div className={cx(pageClassName, "pt-6")}>
			<div className={supervisorContainerClass(width)}>
				<Card
					className={cx(
						"supervisor-material-card border-border-error bg-surface-error/85 p-4",
						supervisorCardRadiusClass,
					)}
				>
					<CardContent className="py-12 text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-error-subtle">
							<AlertCircle className="h-6 w-6 text-content-error" />
						</div>
						<h3 className="mb-2 text-lg font-semibold text-content-error">
							{title}
						</h3>
						<p className="text-sm text-content-error">{message}</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

interface SupervisorPageMessageStateProps {
	message: string;
	width?: SupervisorContainerWidth;
	pageClassName?: string;
}

export function SupervisorPageMessageState({
	message,
	width = "flow",
	pageClassName,
}: SupervisorPageMessageStateProps) {
	return (
		<div className={cx(pageClassName, "pt-6")}>
			<div className={cx(supervisorContainerClass(width), "py-16 text-center")}>
				<p className="text-content-secondary">{message}</p>
			</div>
		</div>
	);
}

interface SupervisorInlineAlertProps {
	message: string;
	className?: string;
}

export function SupervisorInlineAlert({
	message,
	className,
}: SupervisorInlineAlertProps) {
	return (
		<div
			className={cx(
				"supervisor-material-card-quiet border-border-error bg-surface-error/88 p-4",
				supervisorControlRadiusClass,
				className,
			)}
		>
			<div className="flex items-center gap-2 text-content-error">
				<AlertCircle className="h-5 w-5 shrink-0" />
				<span className="text-sm">{message}</span>
			</div>
		</div>
	);
}
