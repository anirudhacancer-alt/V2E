import { Button } from "@enact-ui/react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import {
	cx,
	supervisorControlMinHeightClass,
	supervisorControlRadiusClass,
} from "../../lib/supervisor-layout";

export type SupervisorSecondaryButtonProps = Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	"className"
> & {
	className?: string;
	children?: ReactNode;
	/** Applies `w-full` while preserving shared secondary styling. */
	fullWidth?: boolean;
	isDisabled?: boolean;
	isLoading?: boolean;
};

/**
 * Local supervisor secondary action button.
 * Centralizes sizing, radius, and border so we can iterate quickly in V2E.
 */
export function SupervisorSecondaryButton({
	className,
	fullWidth = false,
	children,
	disabled,
	isDisabled,
	isLoading,
	type = "button",
	...props
}: SupervisorSecondaryButtonProps) {
	const inactive = Boolean(disabled ?? isDisabled);
	const htmlType = (type ?? "button") as "button" | "submit" | "reset";

	return (
		<Button
			{...({
				...props,
				color: "secondary" as const,
				type: htmlType,
				isDisabled: inactive,
				isLoading,
				className: cx(
					"supervisor-secondary-button supervisor-material-pill supervisor-material-interactive",
					// Local tone override: keep supervisor secondary buttons on the lighter surface.
					"!bg-surface-primary/85 hover:!bg-surface-secondary/75 data-loading:!bg-surface-secondary/75",
					supervisorControlMinHeightClass,
					supervisorControlRadiusClass,
					fullWidth && "w-full",
					className,
				),
			} as ComponentProps<typeof Button>)}
		>
			{children}
		</Button>
	);
}
