import { describe, it, expect } from "vitest";
import {
	supervisorBottomNavItems,
	supervisorRecordPath,
	supervisorSidebarNavItems,
	isRecordRouteActive,
} from "./navigation";

/**
 * Lightweight route IA checks (no import of routeTree.gen / full React shell).
 * Full router integration is covered by Playwright (e2e/) and jsdom smoke tests.
 */
describe("supervisor navigation manifest", () => {
	it("lists primary shell paths in sidebar order", () => {
		const paths = supervisorSidebarNavItems.map((i) => i.to);
		expect(paths).toEqual([
			"/supervisor/home",
			"/supervisor/tasks",
			"/supervisor/updates",
			"/supervisor/standup",
			"/supervisor/profile",
		]);
	});

	it("keeps bottom nav aligned with core tabs", () => {
		const bottom = supervisorBottomNavItems.map((i) => i.to);
		expect(bottom).toContain("/supervisor/home");
		expect(bottom).toContain("/supervisor/tasks");
		expect(supervisorRecordPath).toBe("/supervisor/record");
	});

	it("detects record-related routes for FAB highlight", () => {
		expect(isRecordRouteActive("/supervisor/record")).toBe(true);
		expect(
			isRecordRouteActive("/supervisor/00000000-0000-4000-8000-000000000001/review"),
		).toBe(true);
		expect(isRecordRouteActive("/supervisor/home")).toBe(false);
	});
});
