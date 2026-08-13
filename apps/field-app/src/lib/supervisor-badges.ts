/**
 * Maps API severity strings to Enact `Badge` `color` for consistent list chips.
 */
export function severityToBadgeColor(
	severity: string | null | undefined,
): "gray" | "warning" | "error" {
	if (!severity) return "gray";
	const s = severity.toLowerCase();
	if (s.includes("critical") || s.includes("high")) return "error";
	if (s.includes("medium") || s.includes("warn")) return "warning";
	return "gray";
}
