import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  // Redirect to supervisor home as the default landing page
  return <Navigate to="/supervisor/home" />;
}
