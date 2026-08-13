import { ArrowLeft, Search, Sparkles, X } from "lucide-react";
import {
	cx,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderHeightClass,
	type SupervisorContainerWidth,
} from "../../lib/supervisor-layout";

export interface SupervisorSearchHeaderProps {
	/** Placeholder text for search input */
	placeholder?: string;
	/** Current search value (controlled) - required if showSearch is true */
	searchValue?: string;
	/** Callback when search value changes - required if showSearch is true */
	onSearchChange?: (value: string) => void;
	/** Back button handler - if omitted, uses browser history back */
	onBack?: () => void;
	/** Show the back button (default: true). Use false on top-level list tabs (Tasks, Updates). */
	showBackButton?: boolean;
	/** Show the search input (default: true) */
	showSearch?: boolean;
	/** Container width - matches supervisor layout system */
	width?: SupervisorContainerWidth;
	/** Optional title to display instead of search (for detail pages) */
	title?: string;
	/** Show the AI assistant affordance (default: true) */
	showAiButton?: boolean;
}

const iconButtonClass = cx(
	"supervisor-material-pill",
	"supervisor-material-alive-icon-button",
	"flex h-12 w-12 shrink-0 items-center justify-center",
	supervisorControlRadiusClass,
	"text-content-secondary",
	"hover:bg-surface-secondary/50",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
);

const searchContainerClass = cx(
	"relative flex min-w-0 flex-1 items-center",
	"supervisor-material-frost",
	"h-12",
	supervisorControlRadiusClass,
	"focus-within:ring-2 focus-within:ring-ring-brand focus-within:ring-offset-2 focus-within:ring-offset-surface-base",
);

const searchInputClass = cx(
	"h-full w-full min-w-0 bg-transparent",
	"pl-10 pr-10",
	"text-sm text-content-primary",
	"placeholder:text-content-tertiary",
	"focus:outline-none",
);

export function SupervisorSearchHeader({
	placeholder = "Search...",
	searchValue = "",
	onSearchChange,
	onBack,
	showBackButton = true,
	showSearch = true,
	width = "wide",
	title,
	showAiButton = true,
}: SupervisorSearchHeaderProps) {
	const handleBack = () => {
		if (onBack) {
			onBack();
		} else {
			window.history.back();
		}
	};

	const handleClear = () => {
		onSearchChange?.("");
	};

	const handleAiChat = () => {
		// Placeholder for AI assistant - will be implemented later
		console.log("AI assistant coming soon");
	};

	return (
		<div className="fixed top-0 left-0 right-0 z-50 bg-transparent">
			<div
				className={cx(
					supervisorContainerClass(width),
					supervisorFixedHeaderHeightClass,
					"flex items-center",
				)}
			>
				<div
					className={cx(
						"supervisor-material-frost flex w-full items-center gap-2 rounded-full px-1 py-1",
					)}
				>
					{/* Back Button — detail / drill-in flows; hidden on main Tasks & Updates lists */}
					{showBackButton && (
						<button
							type="button"
							onClick={handleBack}
							className={cx(
								iconButtonClass,
								"h-10 w-10",
								"rounded-full bg-surface-primary/80",
								"hover:bg-surface-secondary",
							)}
							aria-label="Go back"
						>
							<ArrowLeft
								className="supervisor-material-alive-icon-glyph h-6 w-6"
								strokeWidth={2}
							/>
						</button>
					)}

					{/* Search Input or Title */}
					{showSearch ? (
						<div className={searchContainerClass}>
							<Search
								className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
								strokeWidth={2}
								aria-hidden
							/>
							<input
								type="search"
								value={searchValue}
								onChange={(e) => onSearchChange?.(e.target.value)}
								placeholder={placeholder}
								className={searchInputClass}
								aria-label={placeholder}
							/>
							{searchValue && (
								<button
									type="button"
									onClick={handleClear}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content-secondary"
									aria-label="Clear search"
								>
									<X className="h-4 w-4" strokeWidth={2} />
								</button>
							)}
						</div>
					) : (
						<div className="flex min-w-0 flex-1 items-center">
							{title && (
								<h1 className="truncate text-lg font-semibold text-content-primary">
									{title}
								</h1>
							)}
						</div>
					)}

					{/* AI — shown on all supervisor search headers unless explicitly hidden */}
					{showAiButton && (
						<button
							type="button"
							onClick={handleAiChat}
							className={cx(
								iconButtonClass,
								"text-content-brand",
								"rounded-full bg-linear-to-br from-content-brand/15 via-content-brand/10 to-content-brand/5",
								"hover:from-content-brand/25 hover:via-content-brand/15 hover:to-content-brand/10",
							)}
							aria-label="AI Assistant"
							title="AI Assistant (coming soon)"
						>
							<Sparkles
								className="supervisor-material-alive-icon-glyph h-5 w-5"
								strokeWidth={2}
							/>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
