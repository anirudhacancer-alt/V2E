import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	attachNativeLifecycleListeners,
	configureNativeShell,
	isNativeShell,
} from "../../lib/mobile";

export function MobileRuntimeBridge() {
	const router = useRouter();

	useEffect(() => {
		if (!isNativeShell()) return;

		void configureNativeShell();

		const disposers: Array<() => void> = [];

		void attachNativeLifecycleListeners().then((handles) => {
			for (const handle of handles) {
				disposers.push(() => {
					void handle.remove();
				});
			}
		});

		if (Capacitor.getPlatform() === "android") {
			void App.addListener("backButton", ({ canGoBack }) => {
				if (canGoBack) {
					router.history.back();
					return;
				}
				void App.minimizeApp();
			}).then((handle) => {
				disposers.push(() => {
					void handle.remove();
				});
			});
		}

		return () => {
			for (const dispose of disposers) {
				dispose();
			}
		};
	}, [router]);

	return null;
}
