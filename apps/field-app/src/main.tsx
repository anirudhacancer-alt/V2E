import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import React from "react";
import ReactDOM from "react-dom/client";
import { initColorScheme } from "./lib/color-scheme";
import { ProjectProvider } from "./lib/project-context";
import { routeTree } from "./routeTree.gen";
import "./index.css";

initColorScheme();

const queryClient = new QueryClient();

const router = createRouter({
	routeTree,
	context: {
		queryClient,
	},
	defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("root");
if (rootElement) {
	if (Capacitor.isNativePlatform()) {
		console.log("[bootstrap] mounting native app", {
			platform: Capacitor.getPlatform(),
		});
		window.addEventListener("error", (event) => {
			console.error("[bootstrap] window error", event.error ?? event.message);
		});
		window.addEventListener("unhandledrejection", (event) => {
			console.error("[bootstrap] unhandled rejection", event.reason);
		});
	}
	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>
			<QueryClientProvider client={queryClient}>
				<ProjectProvider>
					<RouterProvider router={router} />
				</ProjectProvider>
			</QueryClientProvider>
		</React.StrictMode>,
	);
}
