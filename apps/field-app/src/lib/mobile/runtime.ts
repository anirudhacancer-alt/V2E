import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export type MobileLifecycleEvent =
	| { type: "pause" }
	| { type: "resume" }
	| { type: "appStateChange"; isActive: boolean };

type MobileLifecycleListener = (event: MobileLifecycleEvent) => void;

const lifecycleListeners = new Set<MobileLifecycleListener>();

export function subscribeMobileLifecycle(listener: MobileLifecycleListener) {
	lifecycleListeners.add(listener);
	return () => lifecycleListeners.delete(listener);
}

function emitLifecycle(event: MobileLifecycleEvent) {
	for (const listener of lifecycleListeners) {
		listener(event);
	}
}

export function isNativeShell() {
	return Capacitor.isNativePlatform();
}

export async function configureNativeShell() {
	if (!isNativeShell()) return;
	const tasks: Array<Promise<unknown>> = [
		StatusBar.setStyle({ style: Style.Dark }),
	];
	if (Capacitor.getPlatform() === "android") {
		tasks.push(StatusBar.setBackgroundColor({ color: "#0d2b45" }));
		tasks.push(StatusBar.setOverlaysWebView({ overlay: false }));
	}
	await Promise.allSettled(tasks);
}

export async function attachNativeLifecycleListeners() {
	if (!isNativeShell()) return [] as PluginListenerHandle[];
	const [appStateHandle, pauseHandle, resumeHandle] = await Promise.all([
		App.addListener("appStateChange", (state) => {
			emitLifecycle({ type: "appStateChange", isActive: state.isActive });
		}),
		App.addListener("pause", () => {
			emitLifecycle({ type: "pause" });
		}),
		App.addListener("resume", () => {
			emitLifecycle({ type: "resume" });
		}),
	]);
	return [appStateHandle, pauseHandle, resumeHandle];
}
