import { createRootRoute } from "@tanstack/react-router";
import { SupervisorRootLayout } from "../components/shell";

export const Route = createRootRoute({
  component: SupervisorRootLayout,
});
