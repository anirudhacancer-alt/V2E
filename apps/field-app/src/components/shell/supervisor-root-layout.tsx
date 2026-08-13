import { Outlet, useLocation } from "@tanstack/react-router";
import {
	supervisorBottomNavItems,
	supervisorSidebarNavItems,
} from "../../lib/navigation";
import { useProject } from "../../lib/project-context";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileRuntimeBridge } from "./mobile-runtime-bridge";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function SupervisorRootLayout() {
	const location = useLocation();
	const { currentProject } = useProject();

	const pathname = location.pathname;

	return (
		<div className="flex min-h-screen w-full overflow-x-hidden bg-surface-base">
			<MobileRuntimeBridge />
			<DesktopSidebar
				pathname={pathname}
				navItems={supervisorSidebarNavItems}
				openTaskCount={currentProject?.openTaskCount}
			/>

			<main className="relative min-h-screen min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(8rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
				<div className="safe-area-top shrink-0 lg:hidden" aria-hidden />
				<Outlet />
			</main>

			<MobileBottomNav pathname={pathname} items={supervisorBottomNavItems} />
		</div>
	);
}
