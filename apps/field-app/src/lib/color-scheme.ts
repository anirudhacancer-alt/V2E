/**
 * Toggles Enact UI dark theme via `document.documentElement.classList.add("dark-mode")`.
 * @see `@enact-ui/react/styles/theme.css` — `.dark-mode { --color-* }`
 */
export const COLOR_SCHEME_STORAGE_KEY = "v2e-color-scheme";

export type ColorSchemePreference = "light" | "dark";

export function getStoredColorScheme(): ColorSchemePreference {
	if (typeof window === "undefined") return "light";
	const v = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
	return v === "dark" ? "dark" : "light";
}

export function applyColorScheme(scheme: ColorSchemePreference): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark-mode", scheme === "dark");
	try {
		localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
	} catch {
		/* ignore quota / private mode */
	}
}

/** Call once at startup (before paint) so the first screen matches the saved preference. */
export function initColorScheme(): void {
	applyColorScheme(getStoredColorScheme());
}

export function isDarkModeActive(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.classList.contains("dark-mode");
}
