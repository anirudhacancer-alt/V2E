import { Link } from "@tanstack/react-router";
import { Button } from "@enact-ui/react";
import { isNavPathActive, supervisorSidebarNavItems } from "../../lib/navigation";

type SidebarNavItem = (typeof supervisorSidebarNavItems)[number];

interface DesktopSidebarProps {
  pathname: string;
  navItems: readonly SidebarNavItem[];
  openTaskCount?: number;
}

export function DesktopSidebar({
  pathname,
  navItems,
  openTaskCount,
}: DesktopSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border-primary bg-surface-primary lg:flex">
      <div className="border-b border-border-primary p-4">
        <h1 className="text-lg font-semibold text-content-primary">V2E</h1>
        <p className="text-xs text-content-tertiary">Voice to Execution</p>
      </div>

      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavPathActive(pathname, item.to);
            return (
              <li key={item.to}>
                <Link to={item.to}>
                  <Button
                    color={active ? "primary" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      active
                        ? "bg-surface-brand-subtle text-content-brand hover:bg-surface-brand-muted"
                        : "text-content-secondary hover:bg-surface-secondary hover:text-content-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border-primary p-3">
        <div className="text-xs text-content-tertiary">
          {openTaskCount !== undefined ? (
            <span>{openTaskCount} open tasks</span>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
