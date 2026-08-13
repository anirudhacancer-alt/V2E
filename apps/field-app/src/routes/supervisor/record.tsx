import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Camera,
	ImagePlus,
	Images,
	Keyboard,
	Mic,
	Pause,
	Play,
	RotateCcw,
	Settings,
	Square,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	SupervisorCtaButton,
	SupervisorInlineAlert,
	SupervisorSearchHeader,
	SupervisorSecondaryButton,
	SupervisorSplitActionBar,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { brandMicFabButtonClass } from "../../lib/brand-gradient";
import {
	mobileCaptureService,
	subscribeMobileLifecycle,
	type MobilePermissionState,
} from "../../lib/mobile";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderOffsetClass,
	supervisorHeaderInnerClass,
	supervisorNativeSelectClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";
import { AUDIO_TRANSCRIPT_PENDING_PLACEHOLDER } from "../../lib/update-transcript";

export const Route = createFileRoute("/supervisor/record")({
	component: RecordUpdateComponent,
});

type RecordingState = "idle" | "recording" | "recorded" | "uploading";

interface WaveformBar {
	id: number;
	height: number;
}

interface PermissionHelpState {
	kind: "camera" | "microphone";
	message: string;
}

const PHOTO_ONLY_TRANSCRIPT = "Photo evidence attached.";
const EMPTY_WAVEFORM = Array.from({ length: 20 }, (_, id) => ({ id, height: 10 }));

function RecordUpdateComponent() {
	const navigate = useNavigate();
	const { currentProjectId, isLoading: projectLoading } = useProject();
	const isNativeShell = mobileCaptureService.isNativeShell();

	const { data: teamRes } = useQuery({
		queryKey: ["members", currentProjectId],
		queryFn: () => api.getMembers(currentProjectId!),
		enabled: !!currentProjectId,
	});
	const defaultRecorderId = teamRes?.items[0]?.id;

	const { data: locRes, isLoading: locLoading } = useQuery({
		queryKey: ["project-locations", currentProjectId],
		queryFn: () => api.getProjectLocations(currentProjectId!),
		enabled: !!currentProjectId,
	});
	const projectLocations = locRes?.items ?? [];
	const [selectedLocationId, setSelectedLocationId] = useState("");

	const [photoFiles, setPhotoFiles] = useState<File[]>([]);
	const [recordingState, setRecordingState] = useState<RecordingState>("idle");
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [showTextNote, setShowTextNote] = useState(false);
	const [manualText, setManualText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [permissionHelp, setPermissionHelp] =
		useState<PermissionHelpState | null>(null);
	const [waveformBars, setWaveformBars] = useState<WaveformBar[]>(EMPTY_WAVEFORM);

	const timerIntervalRef = useRef<number | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);

	const createUpdateMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.createUpdate(currentProjectId, formData);
		},
		onSuccess: (data) => {
			setPhotoFiles([]);
			navigate({
				to: "/supervisor/$updateId/review",
				params: { updateId: data.id },
			});
		},
		onError: (mutationError) => {
			setError(mutationError.message);
			setRecordingState(audioFile ? "recorded" : "idle");
		},
	});

	useEffect(() => {
		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			void mobileCaptureService.cancelRecording();
		};
	}, [audioUrl]);

	useEffect(() => {
		if (!selectedLocationId && projectLocations.length > 0) {
			setSelectedLocationId(projectLocations[0].id);
		}
	}, [projectLocations, selectedLocationId]);

	useEffect(() => {
		if (!isNativeShell) return;
		let cancelled = false;
		void mobileCaptureService
			.restorePendingPluginResult()
			.then((restored) => {
				if (cancelled || !restored) return;
				if (!restored.success) {
					setError(restored.errorMessage || "Failed to restore camera result");
					return;
				}
				setPhotoFiles((prev) => mergePhotoFiles(prev, restored.files));
			})
			.catch((restoreError) => {
				if (!cancelled) {
					setError(
						restoreError instanceof Error
							? restoreError.message
							: "Failed to restore camera result",
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [isNativeShell]);

	useEffect(() => {
		if (!isNativeShell) return;
		const unsubscribe = subscribeMobileLifecycle((event) => {
			if (recordingState !== "recording") return;
			if (
				event.type === "pause" ||
				(event.type === "appStateChange" && !event.isActive)
			) {
				setError(
					"Recording may have been interrupted while the app was in the background. Stop and review it, or re-record if needed.",
				);
			}
		});
		return () => {
			unsubscribe();
		};
	}, [isNativeShell, recordingState]);

	const appendRecordedBy = (formData: FormData) => {
		if (!defaultRecorderId) {
			throw new Error(
				"No team member found for this project. Run: pnpm --filter @v2e/database db:seed",
			);
		}
		formData.append("recordedBy", defaultRecorderId);
	};

	const appendLocationId = (formData: FormData) => {
		if (!selectedLocationId) {
			throw new Error("Select a location for this update");
		}
		formData.append("locationId", selectedLocationId);
	};

	const appendPhotos = (formData: FormData) => {
		for (const file of photoFiles) {
			formData.append("images", file);
		}
	};

	const previewUrls = useMemo(
		() => photoFiles.map((file) => URL.createObjectURL(file)),
		[photoFiles],
	);

	useEffect(() => {
		return () => {
			for (const previewUrl of previewUrls) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [previewUrls]);

	const updateWaveform = useCallback(() => {
		if (recordingState !== "recording") return;

		if (analyserRef.current) {
			const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
			analyserRef.current.getByteFrequencyData(dataArray);

			const bars: WaveformBar[] = [];
			const step = Math.max(1, Math.floor(dataArray.length / 20));
			for (let i = 0; i < 20; i += 1) {
				const value = dataArray[i * step] ?? 0;
				bars.push({
					id: i,
					height: Math.max(10, Math.min(100, (value / 255) * 100)),
				});
			}
			setWaveformBars(bars);
		} else {
			setWaveformBars((prev) =>
				prev.map((bar) => ({
					id: bar.id,
					height: 18 + Math.round(Math.random() * 72),
				})),
			);
		}

		animationFrameRef.current = requestAnimationFrame(updateWaveform);
	}, [recordingState]);

	const resetRecordingUi = () => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		analyserRef.current = null;
		setWaveformBars(EMPTY_WAVEFORM);
	};

	const showPermissionHelp = useCallback(
		(permissionState: MobilePermissionState, kind: PermissionHelpState["kind"]) => {
			const message = buildPermissionHelp(kind, permissionState);
			setPermissionHelp({ kind, message });
			setError(message);
		},
		[],
	);

	const startRecording = async () => {
		try {
			setError(null);
			setPermissionHelp(null);

			const permission = await mobileCaptureService.requestMicrophonePermission();
			if (permission !== "granted") {
				showPermissionHelp(permission, "microphone");
				setShowTextNote(true);
				return;
			}

			const recordingStart = await mobileCaptureService.startRecording();
			analyserRef.current = recordingStart.analyser;
			setRecordingDuration(0);
			setRecordingState("recording");

			timerIntervalRef.current = window.setInterval(() => {
				setRecordingDuration((previous) => previous + 1);
			}, 1000);
			animationFrameRef.current = requestAnimationFrame(updateWaveform);
		} catch (recordingError) {
			console.error("Failed to start recording:", recordingError);
			setPermissionHelp({
				kind: "microphone",
				message: "Failed to access the microphone. Check permissions and try again.",
			});
			setError("Failed to access microphone. Please check permissions.");
			setShowTextNote(true);
			resetRecordingUi();
		}
	};

	const stopRecording = async () => {
		if (recordingState !== "recording") return;

		resetRecordingUi();

		try {
			const result = await mobileCaptureService.stopRecording();
			setAudioFile(result.file);
			setAudioUrl((previousUrl) => {
				if (previousUrl) {
					URL.revokeObjectURL(previousUrl);
				}
				return result.previewUrl;
			});
			setRecordingDuration(result.durationSeconds || recordingDuration || 1);
			setRecordingState("recorded");
		} catch (recordingError) {
			setRecordingState("idle");
			setError(
				recordingError instanceof Error
					? recordingError.message
					: "Failed to finish recording",
			);
		}
	};

	const reRecord = () => {
		if (audioUrl) {
			URL.revokeObjectURL(audioUrl);
		}
		setAudioFile(null);
		setAudioUrl(null);
		setRecordingDuration(0);
		setRecordingState("idle");
		setIsPlaying(false);
		setError(null);
		setPermissionHelp(null);
	};

	const togglePlayback = () => {
		if (!audioRef.current || !audioUrl) return;

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
			return;
		}

		void audioRef.current.play();
		setIsPlaying(true);
	};

	const handleAudioEnded = () => {
		setIsPlaying(false);
	};

	const addPhotoFiles = useCallback((files: File[]) => {
		if (!files.length) return;
		setPhotoFiles((prev) => mergePhotoFiles(prev, files));
	}, []);

	const handleTakePhoto = async () => {
		if (photoFiles.length >= 10 || createUpdateMutation.isPending) return;
		try {
			setError(null);
			setPermissionHelp(null);
			const permissions = await mobileCaptureService.requestCameraPermissions();
			if (
				permissions.camera === "denied" ||
				permissions.photos === "denied"
			) {
				showPermissionHelp("denied", "camera");
				return;
			}
			const result = await mobileCaptureService.takePhoto();
			addPhotoFiles(result.files);
		} catch (cameraError) {
			setError(
				cameraError instanceof Error
					? cameraError.message
					: "Failed to capture photo",
			);
			if (isNativeShell) {
				setPermissionHelp({
					kind: "camera",
					message:
						"Camera access is required to capture photo evidence from the native app.",
				});
			}
		}
	};

	const handlePickPhotos = async () => {
		if (photoFiles.length >= 10 || createUpdateMutation.isPending) return;
		try {
			setError(null);
			setPermissionHelp(null);
			const result = await mobileCaptureService.pickPhotos(10 - photoFiles.length);
			addPhotoFiles(result.files);
		} catch (pickerError) {
			setError(
				pickerError instanceof Error
					? pickerError.message
					: "Failed to select photos",
			);
			if (isNativeShell) {
				setPermissionHelp({
					kind: "camera",
					message:
						"Photo library access is required to attach existing site photos.",
				});
			}
		}
	};

	const handleSubmit = async () => {
		if (!currentProjectId) {
			setError("Please select a project");
			return;
		}

		try {
			setError(null);
			setRecordingState("uploading");
			const formData = new FormData();

			if (audioFile) {
				formData.append("audio", audioFile);
				formData.append("audioDuration", String(recordingDuration || 1));
				formData.append("transcript", AUDIO_TRANSCRIPT_PENDING_PLACEHOLDER);
			} else if (manualText.trim()) {
				formData.append("transcript", manualText.trim());
			} else {
				setError("Please record audio or enter text");
				setRecordingState("recorded");
				return;
			}

			appendRecordedBy(formData);
			appendLocationId(formData);
			appendPhotos(formData);
			createUpdateMutation.mutate(formData);
		} catch (submitError) {
			setError((submitError as Error).message);
			setRecordingState(audioFile ? "recorded" : "idle");
		}
	};

	const handleTextSubmit = async () => {
		if (!currentProjectId) {
			setError("Please select a project");
			return;
		}

		if (!manualText.trim() && photoFiles.length === 0) {
			setError("Please enter an update or add a photo");
			return;
		}

		try {
			setError(null);
			setRecordingState("uploading");
			const formData = new FormData();
			formData.append("transcript", manualText.trim() || PHOTO_ONLY_TRANSCRIPT);
			appendRecordedBy(formData);
			appendLocationId(formData);
			appendPhotos(formData);
			createUpdateMutation.mutate(formData);
		} catch (submitError) {
			setError((submitError as Error).message);
			setRecordingState("idle");
		}
	};

	const handlePhotosOnlySubmit = () => {
		if (!currentProjectId) {
			setError("Please select a project");
			return;
		}
		if (photoFiles.length === 0) return;
		try {
			setError(null);
			setRecordingState("uploading");
			const formData = new FormData();
			formData.append("transcript", PHOTO_ONLY_TRANSCRIPT);
			appendRecordedBy(formData);
			appendLocationId(formData);
			appendPhotos(formData);
			createUpdateMutation.mutate(formData);
		} catch (submitError) {
			setError((submitError as Error).message);
			setRecordingState("idle");
		}
	};

	const handleRetryPermission = async () => {
		if (!permissionHelp) return;
		if (permissionHelp.kind === "microphone") {
			const permission = await mobileCaptureService.requestMicrophonePermission();
			if (permission === "granted") {
				setPermissionHelp(null);
				setError(null);
			} else {
				showPermissionHelp(permission, "microphone");
			}
			return;
		}

		const permissions = await mobileCaptureService.requestCameraPermissions();
		if (
			permissions.camera === "granted" &&
			(permissions.photos === "granted" || permissions.photos === "limited")
		) {
			setPermissionHelp(null);
			setError(null);
		} else {
			showPermissionHelp(
				permissions.camera === "denied" ? "denied" : permissions.photos,
				"camera",
			);
		}
	};

	const handleOpenSettings = async () => {
		const opened = await mobileCaptureService.openAppSettings();
		if (!opened) {
			setError(
				"Open the V2E app settings manually and enable microphone or camera access.",
			);
		}
	};

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (projectLoading || locLoading) {
		return <RecordSkeleton />;
	}

	if (currentProjectId && projectLocations.length === 0) {
		return (
			<div className={cx(supervisorPageClass, "flex flex-col")}>
				<SupervisorSearchHeader showBackButton={true} width="flow" />
				<div
					className={cx(
						supervisorContainerClass("flow"),
						supervisorFixedHeaderOffsetClass,
						"flex flex-1 flex-col items-center justify-center py-6",
					)}
				>
					<div className="mb-4">
						<h1 className="text-xl font-bold text-content-primary">
							Record Update
						</h1>
					</div>
					<SupervisorInlineAlert
						message="No locations found for this project. Seed the demo database (pnpm --filter @v2e/database db:seed)."
						className="max-w-md"
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={cx(supervisorPageClass, "flex flex-col")}>
			<SupervisorSearchHeader showBackButton={true} width="flow" />

			<div
				className={cx(
					supervisorContainerClass("flow"),
					supervisorFixedHeaderOffsetClass,
					"flex flex-1 flex-col items-center justify-center py-6",
				)}
			>
				{error && (
					<div className="mb-6 w-full max-w-md">
						<SupervisorInlineAlert message={error} />
					</div>
				)}

				{permissionHelp && (
					<div
						className={cx(
							"mb-6 w-full max-w-md border border-border-primary bg-surface-primary p-4",
							supervisorCardRadiusClass,
						)}
					>
						<p className="text-sm text-content-primary">{permissionHelp.message}</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<SupervisorSecondaryButton onClick={handleRetryPermission}>
								<RotateCcw className="h-4 w-4" />
								Retry
							</SupervisorSecondaryButton>
							{isNativeShell ? (
								<SupervisorSecondaryButton onClick={handleOpenSettings}>
									<Settings className="h-4 w-4" />
									Open Settings
								</SupervisorSecondaryButton>
							) : null}
						</div>
					</div>
				)}

				<div className="mb-6 w-full max-w-md space-y-2">
					<label
						htmlFor="record-location"
						className="text-sm font-medium text-content-primary"
					>
						Location
					</label>
					<select
						id="record-location"
						value={selectedLocationId}
						onChange={(event) => setSelectedLocationId(event.target.value)}
						className={supervisorNativeSelectClass}
					>
						{projectLocations.map((location) => (
							<option key={location.id} value={location.id}>
								{location.listLabel || location.displayLabel}
							</option>
						))}
					</select>
				</div>

				<div className="mb-6 w-full max-w-md">
					{photoFiles.length > 0 ? (
						<div className="mb-3 flex flex-wrap gap-2">
							{photoFiles.map((file, index) => (
								<div
									key={`${file.name}-${index}`}
									className={cx(
										"relative h-20 w-20 overflow-hidden border border-border-secondary bg-surface-secondary",
										supervisorControlRadiusClass,
									)}
								>
									<img
										src={previewUrls[index]}
										alt=""
										className="h-full w-full object-cover"
									/>
									<SupervisorSecondaryButton
										type="button"
										title="Remove photo"
										aria-label="Remove photo"
										onClick={() =>
											setPhotoFiles((previous) =>
												previous.filter((_, itemIndex) => itemIndex !== index),
											)
										}
										className="absolute right-1 top-1 min-h-7! w-7! px-0! py-0! rounded-full border border-border-muted bg-surface-primary/85 text-content-primary backdrop-blur-sm transition-colors hover:bg-surface-primary"
									>
										<X className="h-4 w-4" />
									</SupervisorSecondaryButton>
								</div>
							))}
						</div>
					) : null}

					<div className="flex flex-wrap gap-2">
						<SupervisorSecondaryButton
							disabled={
								photoFiles.length >= 10 || createUpdateMutation.isPending
							}
							onClick={handleTakePhoto}
						>
							<Camera className="h-4 w-4" />
							{isNativeShell ? "Take photo" : "Camera"}
						</SupervisorSecondaryButton>
						<SupervisorSecondaryButton
							disabled={
								photoFiles.length >= 10 || createUpdateMutation.isPending
							}
							onClick={handlePickPhotos}
						>
							<Images className="h-4 w-4" />
							{isNativeShell ? "Pick photos" : "Add photos"}
						</SupervisorSecondaryButton>
						{recordingState === "idle" &&
						!showTextNote &&
						photoFiles.length > 0 &&
						!audioFile ? (
							<SupervisorCtaButton
								wrapperClassName="w-auto!"
								className="w-auto!"
								disabled={
									createUpdateMutation.isPending ||
									!defaultRecorderId ||
									!selectedLocationId
								}
								onClick={handlePhotosOnlySubmit}
							>
								<ImagePlus className="h-4 w-4" />
								{createUpdateMutation.isPending
									? "Uploading…"
									: "Submit photos only"}
							</SupervisorCtaButton>
						) : null}
					</div>
					<p className="mt-2 text-xs text-content-tertiary">
						Up to 10 photos. Native builds use Capacitor camera and gallery flows.
					</p>
				</div>

				{!showTextNote ? (
					<>
						<div className="flex flex-col items-center">
							{recordingState === "recording" && (
								<div className="mb-6 flex h-16 items-end justify-center gap-1">
									{waveformBars.map((bar) => (
										<div
											key={bar.id}
											className="w-2 rounded-full bg-surface-brand transition-all duration-100"
											style={{ height: `${bar.height}%` }}
										/>
									))}
								</div>
							)}

							<div className="mb-8 text-4xl font-semibold tracking-tight tabular-nums text-content-primary">
								{formatDuration(recordingDuration)}
							</div>

							{recordingState === "idle" && (
								<SupervisorCtaButton
									type="button"
									title="Start recording"
									aria-label="Start recording"
									onClick={startRecording}
									wrapperClassName="w-auto!"
									className={cx(
										"supervisor-material-mic-idle h-32! w-32! px-0! py-0! rounded-full transition-all active:scale-95",
										brandMicFabButtonClass,
									)}
								>
									<Mic className="h-12 w-12" />
								</SupervisorCtaButton>
							)}

							{recordingState === "recording" && (
								<SupervisorCtaButton
									type="button"
									title="Stop recording"
									aria-label="Stop recording"
									onClick={stopRecording}
									wrapperClassName="w-auto!"
									className={cx(
										"supervisor-material-mic-recording h-32! w-32! px-0! py-0! rounded-full transition-transform active:scale-95",
										brandMicFabButtonClass,
									)}
								>
									<Square className="h-10 w-10 text-content-on-brand" />
								</SupervisorCtaButton>
							)}

							{recordingState === "recorded" && audioUrl && (
								<div className="w-full max-w-md">
									<audio
										ref={audioRef}
										src={audioUrl}
										onEnded={handleAudioEnded}
									>
										<track kind="captions" />
									</audio>

									<div
										className={cx(
											"mb-6 border border-border-primary bg-surface-primary p-6",
											supervisorCardRadiusClass,
										)}
									>
										<div className="flex items-center justify-center gap-6">
											<SupervisorCtaButton
												type="button"
												aria-label={isPlaying ? "Pause playback" : "Play recording"}
												onClick={togglePlayback}
												wrapperClassName="w-auto!"
												className={cx(
													"supervisor-material-mic-idle h-16! w-16! px-0! py-0! rounded-full transition-all active:scale-95",
													brandMicFabButtonClass,
												)}
											>
												{isPlaying ? (
													<Pause className="h-8 w-8" />
												) : (
													<Play className="ml-1 h-8 w-8" />
												)}
											</SupervisorCtaButton>
										</div>
										<p className="mt-4 text-center text-sm text-content-secondary">
											Duration: {formatDuration(recordingDuration)}
										</p>
									</div>

									<SupervisorSplitActionBar
										start={
											<SupervisorSecondaryButton fullWidth onClick={reRecord}>
												<RotateCcw className="h-5 w-5" />
												Re-record
											</SupervisorSecondaryButton>
										}
										end={
											<SupervisorCtaButton
												disabled={
													createUpdateMutation.isPending || !selectedLocationId
												}
												onClick={handleSubmit}
											>
												{createUpdateMutation.isPending ? (
													<>
														<div className="h-5 w-5 animate-spin rounded-full border-2 border-content-on-brand/30 border-t-content-on-brand" />
														Uploading...
													</>
												) : (
													<>
														Use Recording
														<ArrowRight className="h-5 w-5" />
													</>
												)}
											</SupervisorCtaButton>
										}
									/>
								</div>
							)}

							{recordingState === "uploading" && (
								<div className="flex flex-col items-center">
									<div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-ring-brand/30 border-t-ring-brand" />
									<p className="text-content-secondary">Uploading...</p>
								</div>
							)}

							{recordingState === "idle" && (
								<p className="mt-6 max-w-xs text-center text-sm text-content-secondary">
									Tap the microphone to start recording your site update
								</p>
							)}
							{recordingState === "recording" && (
								<p className="mt-6 text-center text-sm text-content-secondary">
									Tap the square to stop recording
								</p>
							)}
						</div>

						{recordingState === "idle" && (
							<SupervisorSecondaryButton
								type="button"
								onClick={() => setShowTextNote(true)}
								className="mt-8 min-h-[44px] bg-transparent px-3 text-sm text-content-tertiary transition-colors hover:text-content-secondary"
							>
								<Keyboard className="h-4 w-4" />
								Type instead
							</SupervisorSecondaryButton>
						)}
					</>
				) : (
					<div className="w-full max-w-md">
						<div
							className={cx(
								"border border-border-primary bg-surface-primary p-6",
								supervisorCardRadiusClass,
							)}
						>
							<h2 className="mb-4 text-lg font-semibold text-content-primary">
								Enter Update
							</h2>
							<textarea
								value={manualText}
								onChange={(event) => setManualText(event.target.value)}
								placeholder="Describe what you observed on site..."
								rows={6}
								className={cx(
									"supervisor-material-pill w-full resize-none bg-surface-secondary/88 px-4 py-3 text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-ring-brand/25",
									supervisorControlRadiusClass,
								)}
							/>
							<SupervisorSplitActionBar
								className="mt-4"
								start={
									<SupervisorSecondaryButton
										fullWidth
										onClick={() => setShowTextNote(false)}
									>
										<Mic className="h-5 w-5" />
										Record Audio
									</SupervisorSecondaryButton>
								}
								end={
									<SupervisorCtaButton
										disabled={
											(!manualText.trim() && photoFiles.length === 0) ||
											createUpdateMutation.isPending ||
											!defaultRecorderId ||
											!selectedLocationId
										}
										onClick={handleTextSubmit}
									>
										{createUpdateMutation.isPending ? (
											<>
												<div className="h-5 w-5 animate-spin rounded-full border-2 border-content-on-brand/30 border-t-content-on-brand" />
												Submitting...
											</>
										) : (
											<>
												Submit
												<ArrowRight className="h-5 w-5" />
											</>
										)}
									</SupervisorCtaButton>
								}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function mergePhotoFiles(existingFiles: File[], newFiles: File[]) {
	const nextFiles = [...existingFiles];
	for (const file of newFiles) {
		if (file.type.startsWith("image/") && nextFiles.length < 10) {
			nextFiles.push(file);
		}
	}
	return nextFiles;
}

function buildPermissionHelp(
	kind: PermissionHelpState["kind"],
	permissionState: MobilePermissionState,
) {
	if (kind === "microphone") {
		if (permissionState === "denied") {
			return "Microphone access is denied. Enable microphone permission in the V2E app settings to record native voice updates.";
		}
		return "Microphone permission is required to record native voice updates.";
	}
	if (permissionState === "denied") {
		return "Camera or photo library access is denied. Enable access in the V2E app settings to attach photos from the native app.";
	}
	return "Camera or photo library permission is required to attach photos.";
}

function RecordSkeleton() {
	return (
		<div className={cx(supervisorPageClass, "flex flex-col")}>
			<div className="border-b border-border-primary bg-surface-primary">
				<div
					className={cx(
						supervisorContainerClass("flow"),
						supervisorHeaderInnerClass,
					)}
				>
					<div className="mx-auto mb-4 h-7 w-40 rounded bg-surface-secondary" />
					<div className="mx-auto w-full max-w-md">
						<div className="mb-1 h-4 w-16 rounded bg-surface-secondary" />
						<div
							className={cx(
								"h-11 bg-surface-secondary",
								supervisorControlRadiusClass,
							)}
						/>
					</div>
				</div>
			</div>
			<div
				className={cx(
					supervisorContainerClass("flow"),
					"flex flex-1 flex-col items-center justify-center py-6",
				)}
			>
				<div className="mb-8 h-12 w-24 rounded bg-surface-secondary" />
				<div className="h-32 w-32 rounded-full bg-surface-secondary" />
				<div className="mt-6 h-4 w-48 rounded bg-surface-secondary" />
			</div>
		</div>
	);
}
