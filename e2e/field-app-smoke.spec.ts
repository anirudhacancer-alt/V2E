import { test, expect } from "@playwright/test";

test.describe("field-app smoke", () => {
	test("root mounts", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("#root")).toBeVisible();
	});
});
