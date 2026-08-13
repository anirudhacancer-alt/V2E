import { App, type RestoredListenerEvent } from "@capacitor/app";
import {
	Camera,
	CameraResultType,
	CameraSource,
	type CameraPermissionState,
	type GalleryPhoto,
	type Photo,
} from "@capacitor/camera";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
	Microphone,
	type AudioRecording,
	type MicrophonePermissionState,
} from "@mozartec/capacitor-microphone";
import {
	AndroidSettings,
	IOSSettings,
	NativeSettings,
} from "capacitor-native-settings";

export type MobilePermissionState =
	| "prompt"
	| "prompt-with-rationale"
	| "granted"
	| "denied"
	| "limited";

export interface MobileCameraPermissions {
	camera: MobilePermissionState;
	photos: MobilePermissionState;
}

export interface MobileRecordingStart {
	analyser: AnalyserNode | null;
}

export interface MobileRecordingResult {
	file: File;
	durationSeconds: number;
	previewUrl: string;
	mimeType: string;
}

export interface MobilePhotoResult {
	files: File[];
	source: "camera" | "photos";
}

export interface RestoredCaptureResult extends MobilePhotoResult {
	pluginId: string;
	methodName: string;
	success: boolean;
	errorMessage?: string;
}

export interface MobileCaptureService {
	isNativeShell(): boolean;
	checkMicrophonePermission(): Promise<MobilePermissionState>;
	requestMicrophonePermission(): Promise<MobilePermissionState>;
	checkCameraPermissions(): Promise<MobileCameraPermissions>;
	requestCameraPermissions(): Promise<MobileCameraPermissions>;
	startRecording(): Promise<MobileRecordingStart>;
	stopRecording(): Promise<MobileRecordingResult>;
	cancelRecording(): Promise<void>;
	takePhoto(): Promise<MobilePhotoResult>;
	pickPhotos(maxCount?: number): Promise<MobilePhotoResult>;
	restorePendingPluginResult(): Promise<RestoredCaptureResult | null>;
	openAppSettings(): Promise<boolean>;
}

interface WebRecordingSession {
	audioContext: AudioContext;
	analyser: AnalyserNode;
	chunks: Blob[];
	mediaRecorder: MediaRecorder;
	stream: MediaStream;
}

let restoredListenerHandle: PluginListenerHandle | null = null;
let restoredQueue: RestoredCaptureResult[] = [];
let webRecordingSession: WebRecordingSession | null = null;

function isNativeShell() {
	return Capacitor.isNativePlatform();
}

function canUseBrowserMicrophoneRecorder() {
	return (
		typeof window !== "undefined" &&
		Boolean(navigator.mediaDevices?.getUserMedia) &&
		typeof MediaRecorder !== "undefined"
	);
}

function usesNativeMicrophonePlugin() {
	return (
		isNativeShell() &&
		Capacitor.getPlatform() === "android" &&
		!canUseBrowserMicrophoneRecorder()
	);
}

async function ensureRestoredListener() {
	if (
		!isNativeShell() ||
		Capacitor.getPlatform() !== "android" ||
		restoredListenerHandle
	) {
		return;
	}
	restoredListenerHandle = await App.addListener(
		"appRestoredResult",
		async (event) => {
			const restored = await normalizeRestoredResult(event);
			if (restored) {
				restoredQueue.push(restored);
			}
		},
	);
}

function base64ToBlob(base64: string, mimeType: string) {
	const bytes = atob(base64);
	const buffer = new Uint8Array(bytes.length);
	for (let index = 0; index < bytes.length; index += 1) {
		buffer[index] = bytes.charCodeAt(index);
	}
	return new Blob([buffer], { type: mimeType });
}

function sanitizeExtension(extension: string | undefined, fallback: string) {
	if (!extension?.trim()) return fallback;
	return extension.replace(/^\./, "").toLowerCase();
}

function mimeTypeToExtension(mimeType: string | undefined, fallback: string) {
	if (!mimeType?.trim()) return fallback;
	const [, subtype] = mimeType.split("/");
	return sanitizeExtension(subtype, fallback);
}

function createObjectUrl(file: File) {
	return URL.createObjectURL(file);
}

async function fetchAsFile(
	sourceUrl: string,
	fileName: string,
	fallbackMimeType: string,
) {
	const response = await fetch(sourceUrl);
	if (!response.ok) {
		throw new Error("Failed to read captured media");
	}
	const blob = await response.blob();
	return new File([blob], fileName, {
		type: blob.type || fallbackMimeType,
	});
}

async function photoToFile(
	photo: Pick<Photo, "format" | "path" | "webPath">,
	prefix: string,
) {
	const extension = sanitizeExtension(photo.format, "jpeg");
	const sourceUrl = photo.webPath
		? photo.webPath
		: photo.path
			? Capacitor.convertFileSrc(photo.path)
			: null;
	if (!sourceUrl) {
		throw new Error("Camera did not return a readable image");
	}
	return fetchAsFile(
		sourceUrl,
		`${prefix}-${Date.now()}.${extension}`,
		`image/${extension}`,
	);
}

async function galleryPhotoToFile(photo: GalleryPhoto, prefix: string) {
	const extension = sanitizeExtension(photo.format, "jpeg");
	const sourceUrl = photo.webPath
		? photo.webPath
		: photo.path
			? Capacitor.convertFileSrc(photo.path)
			: null;
	if (!sourceUrl) {
		throw new Error("Photo library did not return a readable image");
	}
	return fetchAsFile(
		sourceUrl,
		`${prefix}-${Date.now()}.${extension}`,
		`image/${extension}`,
	);
}

function recordingToFile(recording: AudioRecording): File {
	const mimeType = recording.mimeType || "audio/aac";
	if (recording.dataUrl) {
		const [header, body] = recording.dataUrl.split(",", 2);
		const headerMime =
			header.match(/^data:([^;]+);base64$/)?.[1] ||
			mimeType ||
			"audio/aac";
		const blob = base64ToBlob(body ?? "", headerMime);
		const extension = sanitizeExtension(
			recording.format,
			mimeTypeToExtension(headerMime, "m4a"),
		);
		return new File([blob], `recording-${Date.now()}.${extension}`, {
			type: headerMime,
		});
	}
	if (recording.base64String) {
		const blob = base64ToBlob(recording.base64String, mimeType);
		const extension = sanitizeExtension(
			recording.format,
			mimeTypeToExtension(mimeType, "m4a"),
		);
		return new File([blob], `recording-${Date.now()}.${extension}`, {
			type: mimeType,
		});
	}
	throw new Error("Microphone plugin did not return audio data");
}

function normalizeCameraPermissionState(
	state: CameraPermissionState,
): MobilePermissionState {
	return state;
}

function normalizeMicrophonePermissionState(
	state: MicrophonePermissionState,
): MobilePermissionState {
	return state;
}

function normalizeBrowserPermissionState(state: PermissionState | null) {
	if (state === "granted") return "granted";
	if (state === "denied") return "denied";
	return "prompt";
}

function browserPermissionErrorToState(error: unknown): MobilePermissionState {
	if (
		error instanceof DOMException &&
		(error.name === "NotAllowedError" || error.name === "SecurityError")
	) {
		return "denied";
	}
	return "prompt";
}

async function checkBrowserPermission(
	name: "camera" | "microphone",
): Promise<MobilePermissionState> {
	if (!("permissions" in navigator) || !navigator.permissions?.query) {
		return "prompt";
	}
	try {
		const result = await navigator.permissions.query({
			name,
		} as PermissionDescriptor);
		return normalizeBrowserPermissionState(result.state);
	} catch {
		return "prompt";
	}
}

async function pickFilesFromBrowser(options: {
	capture?: boolean;
	multiple?: boolean;
}) {
	return new Promise<File[]>((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = Boolean(options.multiple);
		if (options.capture) {
			input.setAttribute("capture", "environment");
		}
		input.style.position = "fixed";
		input.style.pointerEvents = "none";
		input.style.opacity = "0";
		const cleanup = () => {
			input.remove();
		};
		input.addEventListener(
			"change",
			() => {
				const files = Array.from(input.files ?? []).filter((file) =>
					file.type.startsWith("image/"),
				);
				cleanup();
				resolve(files);
			},
			{ once: true },
		);
		document.body.appendChild(input);
		input.click();
		setTimeout(() => {
			if (!input.files?.length) {
				cleanup();
				resolve([]);
			}
		}, 0);
	});
}

async function normalizeRestoredResult(
	event: RestoredListenerEvent,
): Promise<RestoredCaptureResult | null> {
	if (event.pluginId !== "Camera") return null;
	if (!event.success) {
		return {
			pluginId: event.pluginId,
			methodName: event.methodName,
			success: false,
			source: event.methodName === "pickImages" ? "photos" : "camera",
			files: [],
			errorMessage: event.error?.message || "Camera result was not restored",
		};
	}
	try {
		if (event.methodName === "pickImages" && event.data?.photos) {
			const files = await Promise.all(
				(event.data.photos as GalleryPhoto[]).map((photo, index) =>
					galleryPhotoToFile(photo, `restored-photo-${index + 1}`),
				),
			);
			return {
				pluginId: event.pluginId,
				methodName: event.methodName,
				success: true,
				source: "photos",
				files,
			};
		}
		if (event.data) {
			const file = await photoToFile(
				event.data as Photo,
				`restored-${event.methodName}`,
			);
			return {
				pluginId: event.pluginId,
				methodName: event.methodName,
				success: true,
				source: "camera",
				files: [file],
			};
		}
	} catch (error) {
		return {
			pluginId: event.pluginId,
			methodName: event.methodName,
			success: false,
			source: event.methodName === "pickImages" ? "photos" : "camera",
			files: [],
			errorMessage:
				error instanceof Error ? error.message : "Failed to restore camera data",
		};
	}
	return null;
}

export const mobileCaptureService: MobileCaptureService = {
	isNativeShell,

	async checkMicrophonePermission() {
		if (!usesNativeMicrophonePlugin()) {
			return checkBrowserPermission("microphone");
		}
		const status = await Microphone.checkPermissions();
		return normalizeMicrophonePermissionState(status.microphone);
	},

	async requestMicrophonePermission() {
		if (!usesNativeMicrophonePlugin()) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				stream.getTracks().forEach((track) => track.stop());
				return "granted";
			} catch (error) {
				return browserPermissionErrorToState(error);
			}
		}
		const status = await Microphone.requestPermissions();
		return normalizeMicrophonePermissionState(status.microphone);
	},

	async checkCameraPermissions() {
		if (isNativeShell()) {
			const status = await Camera.checkPermissions();
			return {
				camera: normalizeCameraPermissionState(status.camera),
				photos: normalizeCameraPermissionState(status.photos),
			};
		}
		const camera = await checkBrowserPermission("camera");
		return { camera, photos: camera };
	},

	async requestCameraPermissions() {
		if (isNativeShell()) {
			const status = await Camera.requestPermissions({
				permissions: ["camera", "photos"],
			});
			return {
				camera: normalizeCameraPermissionState(status.camera),
				photos: normalizeCameraPermissionState(status.photos),
			};
		}
		return this.checkCameraPermissions();
	},

	async startRecording() {
		if (usesNativeMicrophonePlugin()) {
			await ensureRestoredListener();
			await Microphone.startRecording();
			return { analyser: null };
		}
		if (
			typeof window === "undefined" ||
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === "undefined"
		) {
			throw new Error("This browser cannot record audio");
		}
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const audioContext = new AudioContext();
		const source = audioContext.createMediaStreamSource(stream);
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;
		source.connect(analyser);

		const mediaRecorder = new MediaRecorder(stream);
		const chunks: Blob[] = [];
		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		};

		webRecordingSession = {
			audioContext,
			analyser,
			chunks,
			mediaRecorder,
			stream,
		};
		mediaRecorder.start();
		return { analyser };
	},

	async stopRecording() {
		if (!webRecordingSession && usesNativeMicrophonePlugin()) {
			const recording = await Microphone.stopRecording();
			const file = recordingToFile(recording);
			return {
				file,
				durationSeconds: Math.max(1, Math.round(recording.duration / 1000)),
				previewUrl: createObjectUrl(file),
				mimeType: recording.mimeType || file.type,
			};
		}
		const session = webRecordingSession;
		if (!session) {
			throw new Error("No recording is currently in progress");
		}
		return new Promise<MobileRecordingResult>((resolve, reject) => {
			session.mediaRecorder.onerror = () => {
				reject(new Error("Recording failed"));
			};
			session.mediaRecorder.onstop = () => {
				const blobType =
					session.chunks[0]?.type ||
					session.mediaRecorder.mimeType ||
					"audio/webm";
				const blob = new Blob(session.chunks, { type: blobType });
				const file = new File(
					[blob],
					`recording-${Date.now()}.${mimeTypeToExtension(blobType, "webm")}`,
					{ type: blobType },
				);
				const previewUrl = createObjectUrl(file);
				const durationSeconds = Math.max(
					1,
					Math.round(blob.size > 0 ? session.audioContext.currentTime : 0),
				);
				session.stream.getTracks().forEach((track) => track.stop());
				void session.audioContext.close();
				webRecordingSession = null;
				resolve({
					file,
					durationSeconds,
					previewUrl,
					mimeType: blobType,
				});
			};
			session.mediaRecorder.stop();
		});
	},

	async cancelRecording() {
		if (!webRecordingSession && usesNativeMicrophonePlugin()) {
			try {
				await Microphone.stopRecording();
			} catch {
				// Ignore cancel cleanup failures.
			}
			return;
		}
		const session = webRecordingSession;
		if (!session) return;
		if (session.mediaRecorder.state !== "inactive") {
			session.mediaRecorder.stop();
		}
		session.stream.getTracks().forEach((track) => track.stop());
		await session.audioContext.close().catch(() => undefined);
		webRecordingSession = null;
	},

	async takePhoto() {
		if (isNativeShell()) {
			await ensureRestoredListener();
			const photo = await Camera.getPhoto({
				allowEditing: false,
				correctOrientation: true,
				presentationStyle: "fullscreen",
				quality: 85,
				resultType: CameraResultType.Uri,
				saveToGallery: false,
				source: CameraSource.Camera,
			});
			return {
				files: [await photoToFile(photo, "capture-photo")],
				source: "camera",
			};
		}
		return {
			files: await pickFilesFromBrowser({ capture: true, multiple: false }),
			source: "camera",
		};
	},

	async pickPhotos(maxCount = 10) {
		if (isNativeShell()) {
			await ensureRestoredListener();
			const photos = await Camera.pickImages({
				limit: Math.max(1, maxCount),
				quality: 85,
			});
			return {
				files: await Promise.all(
					photos.photos.map((photo, index) =>
						galleryPhotoToFile(photo, `library-photo-${index + 1}`),
					),
				),
				source: "photos",
			};
		}
		return {
			files: await pickFilesFromBrowser({ multiple: true }),
			source: "photos",
		};
	},

	async restorePendingPluginResult() {
		await ensureRestoredListener();
		return restoredQueue.shift() ?? null;
	},

	async openAppSettings() {
		if (!isNativeShell()) return false;
		const result = await NativeSettings.open({
			optionAndroid: AndroidSettings.ApplicationDetails,
			optionIOS: IOSSettings.App,
		});
		return result.status;
	},
};
