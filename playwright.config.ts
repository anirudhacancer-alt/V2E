import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";

/**
 * E2E tests run in WebKit only (no Chromium / Firefox projects).
 * Install: pnpm exec playwright install webkit
 */
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
	],
	webServer:
		process.env.CI && !process.env.E2E_SKIP_WEBSERVER
			? {
					command: "pnpm exec turbo run dev --filter=@v2e/field-app",
					url: baseURL,
					timeout: 120_000,
					/** If something already listens on :3001 (e.g. local dev), attach instead of failing. */
					reuseExistingServer: true,
				}
			: undefined,
});
