export type SupervisorContainerWidth = "wide" | "content" | "flow" | "compact";

const supervisorContainerWidthClasses: Record<
	SupervisorContainerWidth,
	string
> = {
	wide: "max-w-7xl",
	content: "max-w-5xl",
	flow: "max-w-3xl",
	compact: "max-w-md",
};

export function cx(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ");
}

/** Page canvas — semantic surface + subtle atmospheric gradient layers. */
const supervisorCanvasClass = "min-h-screen supervisor-material-page pb-32 lg:pb-6";

export const supervisorPageClass = supervisorCanvasClass;

export function supervisorContainerClass(
	width: SupervisorContainerWidth = "wide",
) {
	return cx(
		"mx-auto w-full px-4 sm:px-6 lg:px-6",
		supervisorContainerWidthClasses[width],
	);
}

export function supervisorHeaderClass({
	sticky = false,
	surface = "primary",
}: {
	sticky?: boolean;
	/**
	 * `primary` / `secondary` = tinted header bands. `base` = flat page canvas (chips/cards carry elevation).
	 */
	surface?: "primary" | "secondary" | "base";
} = {}) {
	const surfaceClass =
		surface === "secondary"
			? sticky
				? "bg-surface-secondary/90"
				: "bg-surface-secondary"
			: surface === "base"
				? sticky
					? "bg-surface-base/88"
					: "bg-surface-base"
				: sticky
					? "bg-surface-primary/90"
					: "bg-surface-primary";

	return cx(
		"border-b border-border-muted",
		sticky && "supervisor-material-frost",
		surfaceClass,
		sticky && "fixed top-0 left-0 right-0 z-50",
	);
}

/** Standard header inner padding - used by all headers for consistent height */
export const supervisorHeaderInnerClass = "py-3";

/** Standard fixed header height - 60px (h-15) for consistency across all pages */
export const supervisorFixedHeaderHeightClass = "h-[60px]";

/** Top padding to account for fixed headers - 60px header + 8px gap */
export const supervisorFixedHeaderOffsetClass = "pt-[68px]";

/**
 * Card / panel shells (section cards, collapsibles, dashboard tiles, detail `Card`s).
 * `rounded-3xl` — consistent with iOS-style large corner radii across the supervisor UI.
 */
export const supervisorCardRadiusClass = "rounded-3xl";

/**
 * Buttons, inputs, native selects, filter chips, inline alerts.
 * Same family as cards for one unified “soft” shape language.
 */
export const supervisorControlRadiusClass = "rounded-3xl";

/** Shared minimum tap target height for supervisor controls/buttons. */
export const supervisorControlMinHeightClass = "min-h-12";

/**
 * Native `<select>` chrome for supervisor forms.
 * Keep borders neutral (no brand-tinted green outline).
 */
export const supervisorNativeSelectChromeClass =
	"supervisor-material-pill text-content-primary outline-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring-default/25";

export const supervisorNativeSelectClass = cx(
	"h-11 w-full cursor-pointer appearance-none bg-surface-primary pl-3 pr-8 text-sm",
	supervisorControlRadiusClass,
	supervisorNativeSelectChromeClass,
);

/** Compact picker in the mobile header (touch target + chevron gutter). */
export const supervisorNativeSelectMobileClass = cx(
	supervisorNativeSelectChromeClass,
	supervisorControlRadiusClass,
	"min-h-[44px] min-w-[44px] cursor-pointer appearance-none bg-surface-primary pl-3 pr-8 py-2 text-sm text-content-primary",
);
