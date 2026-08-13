import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	ExternalLink,
	FileText,
	Loader2,
	RefreshCw,
	Shield,
	Target,
	Zap,
} from "lucide-react";
import { useState } from "react";
import {
	SupervisorCollapsibleSection,
	SupervisorCtaButton,
	SupervisorInlineAlert,
	SupervisorPageErrorState,
	SupervisorPageMessageState,
	SupervisorSearchHeader,
	SupervisorSecondaryButton,
	SupervisorSectionCard,
	SupervisorSplitActionBar,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import {
	brandProgressFillClass,
	brandShellGradientClass,
	brandShellShadowMdClass,
} from "../../lib/brand-gradient";
import { recommendEscalationFromAi } from "../../lib/escalation-rules";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderOffsetClass,
	supervisorHeaderClass,
	supervisorHeaderInnerClass,
	supervisorNativeSelectClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/$updateId/extraction")({
	component: ExtractionReviewComponent,
});

const HIGH_CONFIDENCE_BAND = 0.85;

const cleanCardClass = "border-border-muted/70";
const compactCardClass = "p-3.5";
const compactHeaderClass = "mb-2.5";
const sectionIconClass = "h-4 w-4 text-content-secondary";

function ExtractionReviewComponent() {
	const { updateId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { currentProjectId } = useProject();

	const [showRiskSection, setShowRiskSection] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		data: update,
		isLoading,
		error: fetchError,
	} = useQuery({
		queryKey: ["update", updateId, currentProjectId],
		queryFn: () => {
			const pid = currentProjectId;
			if (!pid) throw new Error("No project selected");
			return api.getUpdate(updateId, pid);
		},
		enabled: !!currentProjectId,
	});

	const { data: projectLocations } = useQuery({
		queryKey: ["project-locations", currentProjectId],
		queryFn: () => {
			const pid = currentProjectId;
			if (!pid) throw new Error("No project selected");
			return api.getProjectLocations(pid);
		},
		enabled: !!currentProjectId,
	});

	const extractMutation = useMutation({
		mutationFn: () => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.extractUpdate(updateId, currentProjectId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["update", updateId] });
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
		},
	});

	const confirmReviewMutation = useMutation({
		mutationFn: () => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.confirmUpdateReview(updateId, currentProjectId);
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

	const patchLocationMutation = useMutation({
		mutationFn: async (locationId: string) => {
			if (!currentProjectId) throw new Error("No project selected");
			return api.patchUpdateLocation(updateId, currentProjectId, locationId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["update", updateId] });
		},
		onError: (err) => {
			setError((err as Error).message);
		},
	});

	/** High tier uses the same teal gradient as primary CTAs / brand progress elsewhere. */
	const getConfidenceBarFillClass = (confidence: number) => {
		if (confidence >= HIGH_CONFIDENCE_BAND) return brandProgressFillClass;
		if (confidence >= (update?.aiOutput?.lowConfidenceThreshold ?? 0.65))
			return "bg-[var(--color-content-warning)]";
		return "bg-[var(--color-content-error)]";
	};

	const getConfidenceLabel = (confidence: number) => {
		if (confidence >= HIGH_CONFIDENCE_BAND) return "High";
		if (confidence >= (update?.aiOutput?.lowConfidenceThreshold ?? 0.65))
			return "Medium";
		return "Low";
	};

	if (isLoading) {
		return <ExtractionSkeleton />;
	}

	if (fetchError) {
		return (
			<SupervisorPageErrorState
				title="Failed to load update"
				message={(fetchError as Error).message}
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

	const hasAiOutput = !!update.aiOutput;
	const confidence = update.aiOutput?.confidence ?? 0;
	const needsHumanReview =
		!!update.aiOutput?.reviewRequirement?.required &&
		!update.aiOutput?.reviewedAt;
	const sourceTaskId = update.sourceTaskId ?? null;
	const locItems = projectLocations?.items ?? [];

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
							AI Extraction
						</h1>
						<p className="text-sm text-content-secondary">
							Review the AI assessment. Tasks may be created automatically when
							confidence is high enough. Use{" "}
							<span className="font-medium text-content-primary">
								New task (board)
							</span>{" "}
							if you need a different outcome.
						</p>
					</div>

					{error && <SupervisorInlineAlert message={error} />}

					{hasAiOutput && needsHumanReview && (
						<SupervisorInlineAlert
							message={
								update.aiOutput?.reviewRequirement?.prompt ||
								"Confirm the AI review request for this update."
							}
						/>
					)}

					{sourceTaskId && (
						<SupervisorInlineAlert
							message={
								needsHumanReview
									? "A task was created from this extraction. Confirm the review when the proposal looks right, or open the task to edit execution details."
									: "A task was created from this extraction."
							}
						/>
					)}

					{update.status !== "Escalated" && (
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
									Escalate for PM visibility instead of routing work through a
									task from this note.
								</p>
							)}
							<SupervisorSecondaryButton
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
					)}

					{!hasAiOutput && (
						<SupervisorSectionCard contentClassName="p-6 text-center">
							<div
								className={cx(
									"mx-auto mb-4 flex h-16 w-16 items-center justify-center",
									supervisorCardRadiusClass,
									brandShellGradientClass,
									brandShellShadowMdClass,
								)}
							>
								<Zap className="h-8 w-8 text-content-on-brand" />
							</div>
							<h2 className="text-xl font-semibold text-content-primary mb-2">
								AI analysis required
							</h2>
							<p className="text-content-secondary mb-4 max-w-sm mx-auto text-sm">
								Run AI analysis to extract category, severity, and assignment
								from the transcript.
							</p>
							<SupervisorCtaButton
								onClick={() => extractMutation.mutate()}
								disabled={extractMutation.isPending}
							>
								{extractMutation.isPending ? (
									<>
										<Loader2 className="w-5 h-5 animate-spin" />
										Analyzing...
									</>
								) : (
									<>
										<Zap className="w-5 h-5" />
										Run AI analysis
									</>
								)}
							</SupervisorCtaButton>
							{extractMutation.isError && (
								<p className="mt-4 text-sm text-content-error">
									{(extractMutation.error as Error).message}
								</p>
							)}
						</SupervisorSectionCard>
					)}

					{hasAiOutput && (
						<>
							<SupervisorSectionCard
								title="AI confidence"
								icon={<Target className={sectionIconClass} />}
								className={cleanCardClass}
								actions={
									<span
										className={`supervisor-material-pill rounded-full px-3 py-1 text-xs font-medium ${
											confidence >= HIGH_CONFIDENCE_BAND
												? "bg-surface-brand-subtle text-content-brand"
												: confidence >=
														(update.aiOutput?.lowConfidenceThreshold ?? 0.65)
													? "bg-surface-warning text-content-warning"
													: "bg-surface-error text-content-error"
										}`}
									>
										{getConfidenceLabel(confidence)}
									</span>
								}
								contentClassName={compactCardClass}
								headerClassName={compactHeaderClass}
							>
								<div className="h-3 rounded-full overflow-hidden bg-surface-sunken/70">
									<div
										className={cx(
											"h-full transition-all duration-500",
											getConfidenceBarFillClass(confidence),
										)}
										style={{ width: `${confidence * 100}%` }}
									/>
								</div>
								<p className="text-xs text-content-tertiary mt-2">
									{Math.round(confidence * 100)}% — auto task band:{" "}
									{confidence <
									(update.aiOutput?.lowConfidenceThreshold ?? 0.65)
										? "manual follow-up"
										: confidence < HIGH_CONFIDENCE_BAND
											? "task + confirm review"
											: "task + auto-clear review"}
								</p>
							</SupervisorSectionCard>

							<SupervisorSectionCard
								title="AI assessment"
								icon={<FileText className={sectionIconClass} />}
								className={cleanCardClass}
								contentClassName={compactCardClass}
								headerClassName={compactHeaderClass}
							>
								<dl className="grid gap-3 sm:grid-cols-2">
									<div>
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Category
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.category ?? "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Severity
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.severity ?? "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Department
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.departmentCode ?? "—"}
										</dd>
									</div>
									<div className="space-y-1.5">
										<label
											htmlFor="extraction-location-id"
											className="text-xs font-medium uppercase tracking-wide text-content-tertiary"
										>
											Location
										</label>
										<select
											id="extraction-location-id"
											value={update.locationId}
											disabled={patchLocationMutation.isPending}
											onChange={(e) => {
												const next = e.target.value;
												if (next && next !== update.locationId) {
													patchLocationMutation.mutate(next);
												}
											}}
											className={supervisorNativeSelectClass}
										>
											{locItems.map((loc) => (
												<option key={loc.id} value={loc.id}>
													{loc.listLabel || loc.displayLabel}
												</option>
											))}
										</select>
										<p className="text-xs text-content-tertiary">
											Correct the site location if the AI picked the wrong zone.
										</p>
									</div>
									<div className="sm:col-span-2">
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Vendor
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.vendor?.trim()
												? update.aiOutput.vendor
												: "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Assignee role
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.assigneeRoleName ?? "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Due date
										</dt>
										<dd className="mt-1 text-sm text-content-primary">
											{update.aiOutput?.dueDate ?? "—"}
										</dd>
									</div>
									<div className="sm:col-span-2">
										<dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
											Task description (draft)
										</dt>
										<dd
											className={cx(
												"supervisor-material-card-quiet mt-1 whitespace-pre-wrap p-3 text-sm leading-6 text-content-primary",
												supervisorControlRadiusClass,
											)}
										>
											{update.aiOutput?.generatedTaskDescription ?? "—"}
										</dd>
									</div>
								</dl>
							</SupervisorSectionCard>

							{update.aiOutput && (
								<SupervisorCollapsibleSection
									title="Risk assessment"
									icon={<Shield className={sectionIconClass} />}
									expanded={showRiskSection}
									onToggle={() => setShowRiskSection(!showRiskSection)}
								>
									<div className="space-y-3">
										<div>
											<p className="text-xs font-medium uppercase tracking-wider text-content-tertiary">
												Impact
											</p>
											<p className="mt-1 text-content-primary">
												{update.aiOutput.riskImpact || "Not assessed"}
											</p>
										</div>
										<div>
											<p className="text-xs font-medium uppercase tracking-wider text-content-tertiary">
												Schedule risk
											</p>
											<p className="mt-1 text-content-primary">
												{update.aiOutput.scheduleRisk || "Not assessed"}
											</p>
										</div>
										{update.aiOutput.downstreamEffects &&
											update.aiOutput.downstreamEffects.length > 0 && (
												<div>
													<p className="text-xs font-medium uppercase tracking-wider text-content-tertiary">
														Downstream effects
													</p>
													<ul className="mt-2 space-y-1">
														{update.aiOutput.downstreamEffects.map((effect) => (
															<li
																key={effect}
																className="flex items-start gap-2 text-sm text-content-primary"
															>
																<span className="mt-1 text-content-tertiary">
																	•
																</span>
																{effect}
															</li>
														))}
													</ul>
												</div>
											)}
										{update.aiOutput.recommendedActions &&
											update.aiOutput.recommendedActions.length > 0 && (
												<div>
													<p className="text-xs font-medium uppercase tracking-wider text-content-tertiary">
														Recommended actions
													</p>
													<ul className="mt-2 space-y-1">
														{update.aiOutput.recommendedActions.map(
															(action) => (
																<li
																	key={action}
																	className="flex items-start gap-2 text-sm text-content-primary"
																>
																	<Check
																		className="mt-0.5 h-4 w-4 shrink-0 text-content-success"
																		aria-hidden
																	/>
																	{action}
																</li>
															),
														)}
													</ul>
												</div>
											)}
									</div>
								</SupervisorCollapsibleSection>
							)}

							<div className="flex flex-col gap-3">
								{sourceTaskId && currentProjectId && (
									<SupervisorCtaButton
										type="button"
										onClick={() =>
											navigate({
												to: "/supervisor/tasks/$taskId",
												params: { taskId: sourceTaskId },
											})
										}
									>
										<ExternalLink className="h-4 w-4" aria-hidden />
										Open task
									</SupervisorCtaButton>
								)}
								{needsHumanReview && (
									<SupervisorSecondaryButton
										fullWidth
										disabled={confirmReviewMutation.isPending}
										onClick={() => confirmReviewMutation.mutate()}
									>
										{confirmReviewMutation.isPending ? (
											<Loader2 className="w-5 h-5 animate-spin" />
										) : (
											<Check className="w-5 h-5" />
										)}
										{update.aiOutput?.reviewRequirement?.prompt ??
											"Confirm review"}
									</SupervisorSecondaryButton>
								)}
								<SupervisorSplitActionBar
									className="gap-2.5"
									start={
										<SupervisorSecondaryButton
											fullWidth
											disabled={extractMutation.isPending}
											onClick={() => extractMutation.mutate()}
										>
											{extractMutation.isPending ? (
												<Loader2 className="w-5 h-5 animate-spin" />
											) : (
												<RefreshCw className="w-5 h-5" />
											)}
											Re-analyze
										</SupervisorSecondaryButton>
									}
									end={
										<SupervisorSecondaryButton
											fullWidth
											onClick={() =>
												navigate({
													to: "/supervisor/tasks/new",
												})
											}
										>
											New task (board)
										</SupervisorSecondaryButton>
									}
								/>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	);
}

function ExtractionSkeleton() {
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
					<div className="mb-3 h-4 w-24 rounded bg-surface-secondary" />
					<div className="mb-2 h-7 w-56 rounded bg-surface-secondary" />
					<div className="h-4 w-72 rounded bg-surface-secondary" />
				</div>
			</div>

			<div
				className={cx(
					supervisorContainerClass("flow"),
					"space-y-4 py-4 sm:py-5 animate-pulse",
				)}
			>
				<div
					className={cx(
						"border border-border-primary bg-surface-primary p-4",
						supervisorCardRadiusClass,
					)}
				>
					<div className="mb-4 h-5 w-32 rounded bg-surface-secondary" />
					<div className="mb-2 h-3 rounded-full bg-surface-secondary" />
					<div className="h-3 w-24 rounded bg-surface-secondary" />
				</div>

				<div
					className={cx(
						"border border-border-primary bg-surface-primary p-4",
						supervisorCardRadiusClass,
					)}
				>
					<div className="mb-4 h-5 w-40 rounded bg-surface-secondary" />
					<div className="grid gap-3 sm:grid-cols-2">
						{[1, 2, 3, 4].map((i) => (
							<div key={i}>
								<div className="mb-2 h-4 w-20 rounded bg-surface-secondary" />
								<div
									className={cx(
										"h-11 bg-surface-secondary",
										supervisorControlRadiusClass,
									)}
								/>
							</div>
						))}
					</div>
				</div>

				<div className="flex gap-3">
					<div
						className={cx(
							"h-11 flex-1 bg-surface-secondary",
							supervisorControlRadiusClass,
						)}
					/>
					<div
						className={cx(
							"h-11 flex-1 bg-surface-secondary",
							supervisorControlRadiusClass,
						)}
					/>
				</div>
			</div>
		</div>
	);
}
