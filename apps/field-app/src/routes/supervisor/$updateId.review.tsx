import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowRight,
	Camera,
	Check,
	Edit3,
	Images,
	Loader2,
	Pause,
	Play,
	RefreshCw,
	Settings,
	Volume2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	SupervisorCtaButton,
	SupervisorInlineAlert,
	SupervisorPageErrorState,
	SupervisorPageMessageState,
	SupervisorSearchHeader,
	SupervisorSecondaryButton,
	SupervisorSectionCard,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import {
	brandMicIconButtonClass,
	brandProgressFillClass,
} from "../../lib/brand-gradient";
import { recommendEscalationFromAi } from "../../lib/escalation-rules";
import { resolveMediaUrl, resolveNativeMediaObjectUrl } from "../../lib/media-url";
import {
	mobileCaptureService,
	type MobilePermissionState,
} from "../../lib/mobile";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderOffsetClass,
	supervisorHeaderClass,
	supervisorHeaderInnerClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";
import { isPendingAudioTranscript } from "../../lib/update-transcript";

export const Route = createFileRoute("/supervisor/$updateId/review")({
	component: ReviewUpdateComponent,
});

const cleanCardClass = "border-border-muted shadow-sm";
const compactCardClass = "p-3";
const compactHeaderClass = "mb-2.5";
const sectionIconClass = "h-4 w-4 text-content-secondary";

interface PermissionHelpState {
	kind: "camera";
	message: string;
}

function ReviewUpdateComponent() {
	const { updateId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { currentProjectId } = useProject();
	const isNativeShell = mobileCaptureService.isNativeShell();

	// Local state
	const [isEditing, setIsEditing] = useState(false);
	const [editedTranscript, setEditedTranscript] = useState("");
	const [isPlaying, setIsPlaying] = useState(false);
	const [audioProgress, setAudioProgress] = useState(0);
	const [audioDuration, setAudioDuration] = useState(0);
	const [permissionHelp, setPermissionHelp] =
		useState<PermissionHelpState | null>(null);

	// Refs
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const markReadAttemptedRef = useRef(false);
	const lastMarkReadUpdateIdRef = useRef<string | null>(null);

	// Fetch update data
	const {
		data: update,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["update", updateId, currentProjectId],
		queryFn: () => {
			const pid = currentProjectId;
			if (!pid) throw new Error("No project selected");
			return api.getUpdate(updateId, pid);
		},
		enabled: !!currentProjectId,
	});
	const resolvedAudioUrl = resolveMediaUrl(update?.audioUrl);
	const photoAttachments = (update?.attachments ?? [])
		.filter((attachment) => attachment.type === "Image")
		.map((attachment) => ({
			...attachment,
			src: resolveMediaUrl(attachment.url),
		}))
		.filter((attachment) => Boolean(attachment.src));
	const [nativeAudioUrl, setNativeAudioUrl] = useState<string | undefined>();
	const [nativePhotoUrls, setNativePhotoUrls] = useState<Record<string, string>>({});

	// Mark as read when supervisor opens review (one attempt per update id; survives StrictMode remount)
	useEffect(() => {
		if (!isNativeShell) {
			setNativeAudioUrl(undefined);
			setNativePhotoUrls({});
			return;
		}
		let cancelled = false;
		const objectUrls: string[] = [];

		void (async () => {
			try {
				const [audioUrl, photoEntries] = await Promise.all([
					resolveNativeMediaObjectUrl(update?.audioUrl),
					Promise.all(
						(update?.attachments ?? [])
							.filter((attachment) => attachment.type === "Image")
							.map(async (attachment) => ({
								id: attachment.id,
								src: await resolveNativeMediaObjectUrl(attachment.url),
							})),
					),
				]);
				if (cancelled) {
					for (const entry of photoEntries) {
						if (entry.src?.startsWith("blob:")) {
							URL.revokeObjectURL(entry.src);
						}
					}
					if (audioUrl?.startsWith("blob:")) {
						URL.revokeObjectURL(audioUrl);
					}
					return;
				}
				if (audioUrl?.startsWith("blob:")) objectUrls.push(audioUrl);
				for (const entry of photoEntries) {
					if (entry.src?.startsWith("blob:")) objectUrls.push(entry.src);
				}
				setNativeAudioUrl(audioUrl);
				setNativePhotoUrls(
					Object.fromEntries(
						photoEntries
							.filter((entry) => Boolean(entry.src))
							.map((entry) => [entry.id, entry.src as string]),
					),
				);
			} catch (mediaError) {
				console.error("[review] failed to resolve native media", mediaError);
			}
		})();

		return () => {
			cancelled = true;
			for (const url of objectUrls) {
				URL.revokeObjectURL(url);
			}
		};
	}, [isNativeShell, update?.audioUrl, update?.attachments]);

	useEffect(() => {
		if (lastMarkReadUpdateIdRef.current !== updateId) {
			lastMarkReadUpdateIdRef.current = updateId;
			markReadAttemptedRef.current = false;
		}
	}, [updateId]);

	useEffect(() => {
		if (
			!update ||
			!currentProjectId ||
			update.isRead ||
			markReadAttemptedRef.current
		) {
			return;
		}
		markReadAttemptedRef.current = true;
		void api.markUpdateRead(updateId, currentProjectId).then(() => {
			queryClient.invalidateQueries({ queryKey: ["updates"] });
			queryClient.invalidateQueries({
				queryKey: ["update", updateId, currentProjectId],
			});
		});
	}, [update, updateId, currentProjectId, queryClient]);

	// Transcription mutation
	const transcribeMutation = useMutation({
		mutationFn: () => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.triggerTranscription(updateId, currentProjectId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["update", updateId] });
		},
	});

	const escalateMutation = useMutation({
		mutationFn: () => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.escalateUpdate(updateId, currentProjectId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["update", updateId] });
			queryClient.invalidateQueries({ queryKey: ["updates"] });
		},
	});

	const uploadPhotoMutation = useMutation({
		mutationFn: (file: File) => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.uploadUpdateImage(currentProjectId, updateId, file);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["update", updateId, currentProjectId],
			});
		},
	});

	useEffect(() => {
		if (!isNativeShell) return;
		let cancelled = false;
		void mobileCaptureService
			.restorePendingPluginResult()
			.then(async (restored) => {
				if (cancelled || !restored) return;
				if (!restored.success) {
					setPermissionHelp({
						kind: "camera",
						message:
							restored.errorMessage || "Failed to restore the native camera result.",
					});
					return;
				}
				for (const file of restored.files.slice(0, 10)) {
					await uploadPhotoMutation.mutateAsync(file);
				}
			})
			.catch((restoreError) => {
				if (!cancelled) {
					setPermissionHelp({
						kind: "camera",
						message:
							restoreError instanceof Error
								? restoreError.message
								: "Failed to restore the native camera result.",
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [isNativeShell, uploadPhotoMutation]);

	// Update transcript mutation
	const updateTranscriptMutation = useMutation({
		mutationFn: (transcript: string) => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.updateTranscript(updateId, transcript, currentProjectId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["update", updateId] });
			setIsEditing(false);
		},
	});

	// Initialize edited transcript when data loads
	useEffect(() => {
		if (update?.transcript && !isPendingAudioTranscript(update.transcript)) {
			setEditedTranscript(update.transcript);
		}
	}, [update?.transcript]);

	// Audio time update handler
	const handleTimeUpdate = () => {
		if (audioRef.current) {
			setAudioProgress(audioRef.current.currentTime);
		}
	};

	// Audio loaded metadata handler
	const handleLoadedMetadata = () => {
		if (audioRef.current) {
			setAudioDuration(audioRef.current.duration);
		}
	};

	// Toggle playback
	const togglePlayback = () => {
		if (!audioRef.current) return;

		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
		} else {
			audioRef.current.play();
			setIsPlaying(true);
		}
	};

	// Handle audio ended
	const handleAudioEnded = () => {
		setIsPlaying(false);
		setAudioProgress(0);
		if (audioRef.current) {
			audioRef.current.currentTime = 0;
		}
	};

	// Seek audio
	const handleSeek = (e: React.MouseEvent<HTMLElement>) => {
		if (!audioRef.current || audioDuration === 0) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = x / rect.width;
		audioRef.current.currentTime = percentage * audioDuration;
		setAudioProgress(audioRef.current.currentTime);
	};

	// Save edited transcript
	const handleSaveTranscript = () => {
		if (editedTranscript.trim() !== update?.transcript) {
			updateTranscriptMutation.mutate(editedTranscript.trim());
		} else {
			setIsEditing(false);
		}
	};

	// Cancel editing
	const handleCancelEdit = () => {
		setEditedTranscript(update?.transcript || "");
		setIsEditing(false);
	};

	// Continue to AI analysis
	const handleContinue = () => {
		navigate({ to: "/supervisor/$updateId/extraction", params: { updateId } });
	};

	const showCameraPermissionHelp = (state: MobilePermissionState) => {
		const message =
			state === "denied"
				? "Camera or photo library access is denied. Enable access in the V2E app settings to add more site photos."
				: "Camera or photo library permission is required to add more site photos.";
		setPermissionHelp({ kind: "camera", message });
	};

	const uploadSelectedFiles = async (files: File[]) => {
		const remainingSlots = Math.max(0, 10 - (update?.attachmentCount ?? 0));
		for (const file of files.slice(0, remainingSlots)) {
			await uploadPhotoMutation.mutateAsync(file);
		}
	};

	const handleTakePhoto = async () => {
		try {
			setPermissionHelp(null);
			const permissions = await mobileCaptureService.requestCameraPermissions();
			if (
				permissions.camera === "denied" ||
				permissions.photos === "denied"
			) {
				showCameraPermissionHelp("denied");
				return;
			}
			const result = await mobileCaptureService.takePhoto();
			await uploadSelectedFiles(result.files);
		} catch (cameraError) {
			setPermissionHelp({
				kind: "camera",
				message:
					cameraError instanceof Error
						? cameraError.message
						: "Failed to capture a photo",
			});
		}
	};

	const handlePickPhotos = async () => {
		try {
			setPermissionHelp(null);
			const result = await mobileCaptureService.pickPhotos(
				Math.max(1, 10 - (update?.attachmentCount ?? 0)),
			);
			await uploadSelectedFiles(result.files);
		} catch (pickerError) {
			setPermissionHelp({
				kind: "camera",
				message:
					pickerError instanceof Error
						? pickerError.message
						: "Failed to select photos",
			});
		}
	};

	const handleRetryPermission = async () => {
		const permissions = await mobileCaptureService.requestCameraPermissions();
		if (
			permissions.camera === "granted" &&
			(permissions.photos === "granted" || permissions.photos === "limited")
		) {
			setPermissionHelp(null);
			return;
		}
		showCameraPermissionHelp(
			permissions.camera === "denied" ? "denied" : permissions.photos,
		);
	};

	const handleOpenSettings = async () => {
		const opened = await mobileCaptureService.openAppSettings();
		if (!opened) {
			setPermissionHelp({
				kind: "camera",
				message:
					"Open the V2E app settings manually and enable camera or photo library access.",
			});
		}
	};

	// Format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (isLoading) {
		return <ReviewSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load update"
				message={(error as Error).message}
				width="flow"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (!update) {
		return (
			<SupervisorPageMessageState
				message="Update not found"
				width="flow"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	const hasRealTranscript = Boolean(
		update.transcript?.trim() && !isPendingAudioTranscript(update.transcript),
	);
	const canTranscribe = update.hasAudio && !hasRealTranscript;

	return (
		<>
			<SupervisorSearchHeader
				showBackButton={true}
				width="flow"
			/>
			<div className={supervisorPageClass}>
				<div
					className={cx(
						supervisorContainerClass("flow"),
						supervisorFixedHeaderOffsetClass,
						"space-y-4 py-4 sm:py-5",
					)}
				>
					<div>
						<h1 className="text-xl font-bold text-content-primary">
							Review Transcript
						</h1>
						<p className="text-sm text-content-secondary">
							Review and edit the transcript before AI analysis
						</p>
					</div>
					{/* Audio Player */}
					{update.hasAudio && (isNativeShell ? nativeAudioUrl : resolvedAudioUrl) && (
						<SupervisorSectionCard
							title="Audio Recording"
							icon={<Volume2 className={sectionIconClass} />}
							className={cleanCardClass}
							contentClassName={compactCardClass}
							headerClassName={compactHeaderClass}
						>
							<audio
								ref={audioRef}
								src={isNativeShell ? nativeAudioUrl : resolvedAudioUrl}
								onTimeUpdate={handleTimeUpdate}
								onLoadedMetadata={handleLoadedMetadata}
								onEnded={handleAudioEnded}
							>
								<track kind="captions" />
							</audio>

							<div className="flex items-center gap-3">
								{/* Play/Pause Button */}
								<SupervisorCtaButton
									type="button"
									aria-label={isPlaying ? "Pause playback" : "Play recording"}
									onClick={togglePlayback}
									wrapperClassName="w-auto! shrink-0"
									className={cx(
										"h-11! w-11! min-h-11! px-0! py-0! shrink-0 rounded-full transition-all active:scale-95",
										brandMicIconButtonClass,
									)}
								>
									{isPlaying ? (
										<Pause className="w-5 h-5" />
									) : (
										<Play className="w-5 h-5 ml-0.5" />
									)}
								</SupervisorCtaButton>

								{/* Progress Bar */}
								<div className="flex-1">
									<button
										type="button"
										aria-label="Seek audio"
										className="h-2 w-full rounded-full bg-surface-secondary cursor-pointer"
										onClick={handleSeek}
									>
										<div
											className={cx(
												"h-full rounded-full transition-all",
												brandProgressFillClass,
											)}
											style={{
												width:
													audioDuration > 0
														? `${(audioProgress / audioDuration) * 100}%`
														: "0%",
											}}
										/>
									</button>
									<div className="flex justify-between mt-1 text-xs text-content-tertiary">
										<span>{formatTime(audioProgress)}</span>
										<span>{formatTime(audioDuration)}</span>
									</div>
								</div>
							</div>
						</SupervisorSectionCard>
					)}

					{/* Site photos */}
					<SupervisorSectionCard
						title="Photos"
						icon={<Camera className={sectionIconClass} />}
						className={cleanCardClass}
						contentClassName={compactCardClass}
						headerClassName={compactHeaderClass}
					>
						{(isNativeShell
							? photoAttachments.filter((attachment) => nativePhotoUrls[attachment.id])
							: photoAttachments
						).length > 0 ? (
							<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
								{(isNativeShell
									? photoAttachments.filter((attachment) => nativePhotoUrls[attachment.id])
									: photoAttachments
								).map((a) => {
									const imageSrc = isNativeShell ? nativePhotoUrls[a.id] : a.src;
									return (
										<a
											key={a.id}
											href={imageSrc}
											target="_blank"
											rel="noopener noreferrer"
											aria-label="Open photo"
											title="Open photo"
											className={cx(
												"block overflow-hidden border border-border-secondary bg-surface-secondary",
												supervisorControlRadiusClass,
											)}
										>
											<img
												src={imageSrc}
												alt=""
												className="h-24 w-full object-cover sm:h-28"
											/>
										</a>
									);
								})}
							</div>
						) : (
							<p className="text-sm text-content-tertiary">No photos yet.</p>
						)}
						{permissionHelp ? (
							<div
								className={cx(
									"mt-3 border border-border-primary bg-surface-primary p-3",
									supervisorCardRadiusClass,
								)}
							>
								<p className="text-sm text-content-primary">
									{permissionHelp.message}
								</p>
								<div className="mt-3 flex flex-wrap gap-2">
									<SupervisorSecondaryButton onClick={handleRetryPermission}>
										<RefreshCw className="mr-2 h-4 w-4" />
										Retry
									</SupervisorSecondaryButton>
									{isNativeShell ? (
										<SupervisorSecondaryButton onClick={handleOpenSettings}>
											<Settings className="mr-2 h-4 w-4" />
											Open Settings
										</SupervisorSecondaryButton>
									) : null}
								</div>
							</div>
						) : null}
						<div className="mt-3">
							<div className="flex flex-wrap gap-2">
								<SupervisorSecondaryButton
									disabled={
										uploadPhotoMutation.isPending ||
										(update.attachmentCount ?? 0) >= 10
									}
									onClick={handleTakePhoto}
								>
									{uploadPhotoMutation.isPending ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Uploading…
										</>
									) : (
										<>
											<Camera className="mr-2 h-4 w-4" />
											{isNativeShell ? "Take photo" : "Camera"}
										</>
									)}
								</SupervisorSecondaryButton>
								<SupervisorSecondaryButton
									disabled={
										uploadPhotoMutation.isPending ||
										(update.attachmentCount ?? 0) >= 10
									}
									onClick={handlePickPhotos}
								>
									<Images className="mr-2 h-4 w-4" />
									{isNativeShell ? "Pick photos" : "Library"}
								</SupervisorSecondaryButton>
							</div>
							{(update.attachmentCount ?? 0) >= 10 ? (
								<p className="mt-2 text-xs text-content-tertiary">
									Maximum 10 photos per update.
								</p>
							) : null}
							{uploadPhotoMutation.isError ? (
								<p className="mt-2 text-sm text-content-error">
									{(uploadPhotoMutation.error as Error).message}
								</p>
							) : null}
						</div>
					</SupervisorSectionCard>

					{/* Transcript Section */}
					<SupervisorSectionCard
						title="Transcript"
						icon={<Edit3 className={sectionIconClass} />}
						className={cleanCardClass}
						contentClassName={compactCardClass}
						headerClassName={compactHeaderClass}
						actions={
							hasRealTranscript && !isEditing ? (
								<SupervisorSecondaryButton
									onClick={() => setIsEditing(true)}
									className="min-h-9 px-3 py-1.5 text-sm"
								>
									<Edit3 className="h-4 w-4" />
									Edit
								</SupervisorSecondaryButton>
							) : null
						}
					>
						{/* Transcription Button (if no transcript but has audio) */}
						{canTranscribe && (
							<div className="py-2">
								<p className="mb-3 text-sm text-content-secondary">
									Audio recorded. Click to generate transcript.
								</p>
								<SupervisorCtaButton
									type="button"
									onClick={() => transcribeMutation.mutate()}
									disabled={transcribeMutation.isPending}
								>
									{transcribeMutation.isPending ? (
										<>
											<Loader2 className="w-5 h-5 animate-spin" />
											Transcribing...
										</>
									) : (
										<>
											<RefreshCw className="w-5 h-5" />
											Generate Transcript
										</>
									)}
								</SupervisorCtaButton>
								{transcribeMutation.isError && (
									<p className="mt-3 text-sm text-content-error">
										{(transcribeMutation.error as Error).message}
									</p>
								)}
							</div>
						)}

						{/* Transcript Content */}
						{hasRealTranscript &&
							(isEditing ? (
								<div className="space-y-3">
									<textarea
										value={editedTranscript}
										onChange={(e) => setEditedTranscript(e.target.value)}
										rows={6}
										className={cx(
											"supervisor-material-pill w-full bg-surface-primary/88 px-3 py-2.5 text-sm leading-6 text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-ring-brand/25 resize-none",
											supervisorControlRadiusClass,
										)}
										placeholder="Enter transcript..."
									/>
									<div className="flex gap-2.5">
										<SupervisorSecondaryButton
											fullWidth
											onClick={handleCancelEdit}
										>
											<X className="w-5 h-5" />
											Cancel
										</SupervisorSecondaryButton>
										<div className="min-w-0 flex-1">
											<SupervisorCtaButton
												type="button"
												onClick={handleSaveTranscript}
												disabled={updateTranscriptMutation.isPending}
											>
												{updateTranscriptMutation.isPending ? (
													<>
														<Loader2 className="w-5 h-5 animate-spin" />
														Saving...
													</>
												) : (
													<>
														<Check className="w-5 h-5" />
														Save Changes
													</>
												)}
											</SupervisorCtaButton>
										</div>
									</div>
								</div>
							) : (
								<div
									className={cx(
										"bg-surface-secondary p-3",
										supervisorControlRadiusClass,
									)}
								>
									<p className="whitespace-pre-wrap text-sm leading-6 text-content-primary">
										{update.transcript}
									</p>
								</div>
							))}

						{/* No Transcript, No Audio */}
						{!hasRealTranscript && !update.hasAudio && (
							<div
								className={cx(
									"bg-surface-secondary p-3",
									supervisorControlRadiusClass,
								)}
							>
								<p className="text-sm text-content-tertiary">
									No transcript or audio recording available yet.
								</p>
							</div>
						)}
					</SupervisorSectionCard>

					{/* Metadata */}
					<SupervisorSectionCard
						title="Details"
						className={cleanCardClass}
						contentClassName={compactCardClass}
						headerClassName={compactHeaderClass}
					>
						<div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
							<div>
								<span className="text-content-tertiary">Recorded by</span>
								<p className="text-content-primary font-medium mt-0.5">
									{update.recordedByName}
								</p>
							</div>
							<div>
								<span className="text-content-tertiary">Status</span>
								<p className="text-content-primary font-medium mt-0.5 capitalize">
									{update.status}
								</p>
							</div>
							<div>
								<span className="text-content-tertiary">Created</span>
								<p className="text-content-primary font-medium mt-0.5">
									{new Date(update.createdAt).toLocaleString()}
								</p>
							</div>
							{update.audioDuration && (
								<div>
									<span className="text-content-tertiary">Duration</span>
									<p className="text-content-primary font-medium mt-0.5">
										{formatTime(update.audioDuration)}
									</p>
								</div>
							)}
						</div>
					</SupervisorSectionCard>

					{/* Escalation */}
					{update.status !== "Escalated" ? (
						<SupervisorSectionCard
							title="Escalation"
							icon={<AlertTriangle className={sectionIconClass} />}
							className={cleanCardClass}
							contentClassName={compactCardClass}
							headerClassName={compactHeaderClass}
						>
							{recommendEscalationFromAi(update.aiOutput) ? (
								<div className="mb-3">
									<SupervisorInlineAlert message="AI recommends escalation: Critical severity or High/Critical schedule risk." />
								</div>
							) : (
								<p className="mb-3 text-sm text-content-secondary">
									Escalate if this issue needs PM or leadership visibility
									beyond the normal task flow.
								</p>
							)}
							<SupervisorSecondaryButton
								className="w-full sm:w-auto"
								disabled={escalateMutation.isPending}
								onClick={() => escalateMutation.mutate()}
							>
								{escalateMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Escalating…
									</>
								) : (
									"Escalate update"
								)}
							</SupervisorSecondaryButton>
							{escalateMutation.isError ? (
								<p className="mt-2 text-sm text-content-error">
									{(escalateMutation.error as Error).message}
								</p>
							) : null}
						</SupervisorSectionCard>
					) : null}

					{/* Continue Button */}
					<SupervisorCtaButton
						disabled={!hasRealTranscript}
						onClick={handleContinue}
					>
						<span>Continue to AI Analysis</span>
						<ArrowRight className="w-5 h-5" />
					</SupervisorCtaButton>

					{!hasRealTranscript && (
						<p className="text-center text-sm text-content-tertiary">
							A transcript is required before proceeding to AI analysis
						</p>
					)}
				</div>
			</div>
		</>
	);
}

function ReviewSkeleton() {
	return (
		<div className={supervisorPageClass}>
			<div className={supervisorHeaderClass({ surface: "primary" })}>
				<div
					className={cx(
						supervisorContainerClass("flow"),
						supervisorHeaderInnerClass,
						"animate-pulse",
					)}
				>
					<div className="h-4 w-24 bg-surface-secondary rounded mb-3" />
					<div className="h-7 w-48 bg-surface-secondary rounded mb-2" />
					<div className="h-4 w-64 bg-surface-secondary rounded" />
				</div>
			</div>

			<div
				className={cx(
					supervisorContainerClass("flow"),
					"space-y-6 py-5 sm:py-6 animate-pulse",
				)}
			>
				<div
					className={cx(
						"bg-surface-primary border border-border-primary p-5",
						supervisorCardRadiusClass,
					)}
				>
					<div className="h-5 w-32 bg-surface-secondary rounded mb-4" />
					<div
						className={cx(
							"h-16 bg-surface-secondary",
							supervisorControlRadiusClass,
						)}
					/>
				</div>

				<div
					className={cx(
						"bg-surface-primary border border-border-primary p-5",
						supervisorCardRadiusClass,
					)}
				>
					<div className="h-5 w-24 bg-surface-secondary rounded mb-4" />
					<div
						className={cx(
							"h-40 bg-surface-secondary",
							supervisorControlRadiusClass,
						)}
					/>
				</div>

				<div
					className={cx(
						"h-14 bg-surface-secondary",
						supervisorControlRadiusClass,
					)}
				/>
			</div>
		</div>
	);
}
