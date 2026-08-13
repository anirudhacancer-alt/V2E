import { Button } from "@enact-ui/react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import {
	brandCtaButtonClass,
	brandQuickActionButtonClass,
} from "../../lib/brand-gradient";
import { cx } from "../../lib/supervisor-layout";

/** Shared sizing for supervisor primary (brand) actions — matches home “Review now”. */
export const supervisorCtaButtonSizingClass =
	"min-h-12 border-0 px-4 py-3 text-base font-semibold";

export type SupervisorCtaBrandStyle = "standard" | "prominent";

/**
 * Merged brand gradient + sizing for a raw `Button` when layout must stay inline
 * (e.g. form footer next to Cancel) — no outer wrapper.
 */
export function supervisorCtaPrimaryClass(
	brandStyle: SupervisorCtaBrandStyle = "standard",
) {
	return cx(
		supervisorCtaButtonSizingClass,
		brandStyle === "prominent"
			? brandQuickActionButtonClass
			: brandCtaButtonClass,
	);
}

export type SupervisorCtaButtonProps = Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	"className"
> & {
	className?: string;
	children?: ReactNode;
	brandStyle?: SupervisorCtaBrandStyle;
	/** When false, renders intrinsic width instead of stretching to full row width. */
	fullWidth?: boolean;
	/** Extra classes on the outer `w-full` row (e.g. `mt-5`). */
	wrapperClassName?: string;
	/** Pass-through to Enact `Button` (preferred over `disabled` for a11y parity). */
	isDisabled?: boolean;
	isLoading?: boolean;
};

/**
 * Primary brand CTA: full width of the parent, `min-h-12`. Layout (centering, max width)
 * is controlled by the parent container.
 */
export function SupervisorCtaButton({
	brandStyle = "standard",
	fullWidth = true,
	wrapperClassName,
	className,
	children,
	disabled,
	isDisabled,
	isLoading,
	type = "button",
	...rest
}: SupervisorCtaButtonProps) {
	const brandClass =
		brandStyle === "prominent"
			? brandQuickActionButtonClass
			: brandCtaButtonClass;
	const merged = cx(supervisorCtaButtonSizingClass, brandClass, className);
	const materialClass = cx(
		"supervisor-material-interactive",
		brandStyle === "prominent" && "supervisor-material-pill-active",
	);
	const inactive = Boolean(disabled ?? isDisabled);

	const htmlType = (type ?? "button") as "button" | "submit" | "reset";
	// Enact `Button` props are a button|link union; HTML `type` is valid on the button branch only.
	const button = (
		<Button
			{...({
				...rest,
				color: "primary" as const,
				type: htmlType,
				className: cx(fullWidth && "w-full", materialClass, merged),
				isDisabled: inactive,
				isLoading,
			} as ComponentProps<typeof Button>)}
		>
			{children}
		</Button>
	);

	return <div className={cx(fullWidth && "w-full", wrapperClassName)}>{button}</div>;
}
