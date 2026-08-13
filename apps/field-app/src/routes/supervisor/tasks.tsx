import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for `/supervisor/tasks` — child routes (`tasks.index`, `tasks.$taskId`) render in `<Outlet />`.
 */
export const Route = createFileRoute("/supervisor/tasks")({
  component: TasksLayout,
});

function TasksLayout() {
  return <Outlet />;
}
