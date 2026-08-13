import { Avatar, Skeleton } from "@enact-ui/react";
import {
	type UseMutationResult,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	ClipboardList,
	MessageSquare,
	Square,
	Target,
	Users,
	Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SeverityBadge } from "../../components/StatusBadge";
import {
	SupervisorCollapsibleSection,
	SupervisorCtaButton,
	SupervisorEmptyCard,
	SupervisorPageErrorState,
	SupervisorSearchHeader,
	SupervisorSectionCard,
	SupervisorSecondaryButton,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderHeightClass,
	supervisorFixedHeaderOffsetClass,
	supervisorHeaderClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/standup")({
	component: SupervisorStandupComponent,
});

type StandupPrepSnapshot = Awaited<ReturnType<typeof api.getStandupPrep>>;

/** Strip Markdown-ish headings and line breaks for `SpeechSynthesisUtterance`. */
function standupSummaryToSpeakableText(raw: string): string {
	return raw
		.replace(/\r\n/g, "\n")
		.replace(/^##\s+(.+)$/gm, "$1. ")
		.replace(/\n{2,}/g, " ")
		.replace(/\n/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function StandupSummaryReadAloudButton({
	markdownText,
}: {
	markdownText: string;
}) {
	const [isSpeaking, setIsSpeaking] = useState(false);

	const speakable = standupSummaryToSpeakableText(markdownText);

	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	if (typeof window === "undefined" || !window.speechSynthesis) {
		return null;
	}

	if (!speakable) {
		return null;
	}

	const toggle = () => {
		const syn = window.speechSynthesis;
		if (isSpeaking) {
			syn.cancel();
			setIsSpeaking(false);
			return;
		}
		syn.getVoices();
		syn.cancel();
		const u = new SpeechSynthesisUtterance(speakable);
		u.rate = 1;
		u.onend = () => setIsSpeaking(false);
		u.onerror = () => setIsSpeaking(false);
		setIsSpeaking(true);
		syn.speak(u);
	};

	return (
		<SupervisorSecondaryButton
			type="button"
			onClick={toggle}
			aria-label={isSpeaking ? "Stop reading summary" : "Read summary aloud"}
			aria-pressed={isSpeaking}
			className={cx(
				"flex shrink-0 min-h-11 min-w-11 items-center justify-center gap-1.5 border px-2.5 text-xs font-medium sm:min-h-0 sm:min-w-0",
				supervisorControlRadiusClass,
			)}
		>
			{isSpeaking ? (
				<Square className="h-3.5 w-3.5 fill-current" aria-hidden />
			) : (
				<Volume2 className="h-4 w-4" aria-hidden />
			)}
			<span className="hidden sm:inline">{isSpeaking ? "Stop" : "Listen"}</span>
		</SupervisorSecondaryButton>
	);
}

function RenderStandupSummaryMarkdown({ text }: { text: string }) {
	const trimmed = text.trim();
	if (!trimmed.startsWith("##")) {
		return (
			<p className="whitespace-pre-wrap text-sm text-content-secondary">
				{text}
			</p>
		);
	}
	const chunks = trimmed.split(/\n(?=## )/);
	return (
		<div className="space-y-5 text-sm text-content-secondary">
			{chunks.map((chunk) => {
				const lines = chunk.trim().split("\n");
				const headingLine = (lines[0] ?? "").replace(/^##\s+/, "");
				const body = lines.slice(1).join("\n").trim();
				const paras = body
					.split(/\n{2,}/)
					.map((p) => p.trim())
					.filter(Boolean);
				return (
					<section key={headingLine}>
						<h3 className="text-sm font-semibold text-content-primary">
							{headingLine}
						</h3>
						<div className="mt-2 space-y-3">
							{paras.map((para) => (
								<p key={`${headingLine}-${para.slice(0, 96)}`}>{para}</p>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

interface TodaysBriefCardProps {
	standup: StandupPrepSnapshot;
	summaryMutation: UseMutationResult<
		Awaited<ReturnType<typeof api.generateStandupSummary>>,
		Error,
		void,
		unknown
	>;
}

function TodaysBriefCard({ standup, summaryMutation }: TodaysBriefCardProps) {
	const criticalCount = standup.activeBlockers.filter(
		(b) => b.severity.toLowerCase() === "critical",
	).length;
	const completedYesterday = standup.yesterdayCompleted.length;
	const plannedToday = standup.plannedItems.length;
	const overdueOpen = standup.stats.overdueCount;

	const summaryFromMutation = summaryMutation.data?.summaryText?.trim();
	const summaryText = summaryFromMutation || "";

	const hasAiSummary = Boolean(summaryText);
	const ctaLabel = summaryMutation.isPending
		? hasAiSummary
			? "Regenerating…"
			: "Generating…"
		: hasAiSummary
			? "Regenerate summary"
			: "Generate AI summary";

	return (
		<SupervisorSectionCard className="mb-6" contentClassName="space-y-4">
			<h2 className="text-base font-semibold text-content-primary">
				Today&apos;s brief
			</h2>
			<ul className="space-y-2 text-sm text-content-secondary list-none">
				<li>
					{criticalCount === 0 ? (
						"No critical blockers need discussion"
					) : (
						<>
							<strong className="font-bold text-content-primary">
								{criticalCount}
							</strong>{" "}
							critical {criticalCount === 1 ? "blocker" : "blockers"} need
							discussion
						</>
					)}
				</li>
				<li>
					{completedYesterday === 0 ? (
						"No tasks completed yesterday"
					) : (
						<>
							<strong className="font-bold text-content-primary">
								{completedYesterday}
							</strong>{" "}
							{completedYesterday === 1 ? "task" : "tasks"} completed yesterday
						</>
					)}
				</li>
				<li>
					{plannedToday === 0 ? (
						"Nothing planned for today yet"
					) : (
						<>
							<strong className="font-bold text-content-primary">
								{plannedToday}
							</strong>{" "}
							planned for today
						</>
					)}
				</li>
				<li>
					{overdueOpen === 0 ? (
						"No overdue items still open"
					) : (
						<>
							<strong className="font-bold text-content-primary">
								{overdueOpen}
							</strong>{" "}
							overdue {overdueOpen === 1 ? "item" : "items"} still open
						</>
					)}
				</li>
			</ul>
			<div className="flex flex-col gap-2">
				<SupervisorCtaButton
					type="button"
					onClick={() => summaryMutation.mutate()}
					disabled={summaryMutation.isPending}
				>
					{ctaLabel}
				</SupervisorCtaButton>
				<p className="text-xs text-content-tertiary">
					Uses today&apos;s task-derived standup prep. The summary is generated on
					demand and is not stored; leaving the page clears it until you generate
					again.
				</p>
			</div>
			{hasAiSummary ? (
				<div
					className={cx(
						"border border-border-muted bg-surface-secondary/30 p-4",
						supervisorCardRadiusClass,
					)}
				>
					<div className="mb-2 flex items-start justify-between gap-2">
						<p className="min-w-0 flex-1 text-xs font-medium text-content-tertiary">
							Standup summary
						</p>
						<StandupSummaryReadAloudButton
							key={summaryText}
							markdownText={summaryText}
						/>
					</div>
					<RenderStandupSummaryMarkdown text={summaryText} />
				</div>
			) : null}
			{summaryMutation.isError && (
				<p className="text-sm text-content-error">
					{(summaryMutation.error as Error).message}
				</p>
			)}
		</SupervisorSectionCard>
	);
}

function SupervisorStandupComponent() {
	const { currentProjectId, isLoading: projectLoading } = useProject();
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(),
	);

	const {
		data: standup,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["standup-prep", currentProjectId],
		queryFn: () => {
			const projectId = currentProjectId;
			if (!projectId) throw new Error("No project");
			return api.getStandupPrep(projectId);
		},
		enabled: Boolean(currentProjectId),
	});

	const summaryMutation = useMutation({
		mutationFn: async () => {
			if (!currentProjectId) throw new Error("No project");
			return api.generateStandupSummary(currentProjectId);
		},
	});

	const resetSummary = summaryMutation.reset;
	const previousProjectIdForSummaryRef = useRef<string | undefined>(
		currentProjectId,
	);
	useEffect(() => {
		if (previousProjectIdForSummaryRef.current === currentProjectId) return;
		previousProjectIdForSummaryRef.current = currentProjectId;
		resetSummary();
	}, [currentProjectId, resetSummary]);

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	if (projectLoading || isLoading) {
		return <StandupSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load standup prep"
				message={error.message}
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (!standup) {
		return (
			<div className={cx(supervisorPageClass, "pt-6")}>
				<div className={supervisorContainerClass("wide")}>
					<SupervisorEmptyCard
						title="No project selected"
						description="Select a project to view standup prep"
						icon={ClipboardList}
					/>
				</div>
			</div>
		);
	}

	return (
		<>
			<SupervisorSearchHeader
				showBackButton={true}
				width="wide"
			/>

			<div
				className={cx(
					supervisorPageClass,
					supervisorContainerClass("wide"),
					supervisorFixedHeaderOffsetClass,
					"space-y-6",
				)}
			>
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-bold text-content-primary">
						Standup Prep
					</h1>
					<p className="text-sm font-medium text-content-secondary">
						{formatDate(standup.date)}
					</p>
				</div>

				<TodaysBriefCard standup={standup} summaryMutation={summaryMutation} />

				{/* Collapsible Sections — risk-first order (standup flow) */}
				<div className="space-y-1.5">
					<SupervisorCollapsibleSection
						title="Needs discussion"
						icon={<MessageSquare className="h-5 w-5 text-content-secondary" />}
						count={
							standup.activeBlockers.length +
							standup.carryForwardDueYesterday.length
						}
						emptyMessage="Nothing flagged for discussion right now"
						expanded={expandedSections.has("needs-discussion")}
						onToggle={() => toggleSection("needs-discussion")}
					>
						<NeedsDiscussionBody
							activeBlockers={standup.activeBlockers}
							carryForwardItems={standup.carryForwardDueYesterday}
						/>
					</SupervisorCollapsibleSection>

					<SupervisorCollapsibleSection
						title="Planned for today"
						icon={<Target className="h-5 w-5 text-content-secondary" />}
						count={standup.plannedItems.length}
						emptyMessage="No planned items"
						expanded={expandedSections.has("planned")}
						onToggle={() => toggleSection("planned")}
					>
						<div className="space-y-2">
							{standup.plannedItems.map((item) => (
								<ChecklistItem key={item.id} item={item} />
							))}
						</div>
					</SupervisorCollapsibleSection>

					<SupervisorCollapsibleSection
						title="Completed yesterday"
						icon={<CheckCircle2 className="h-5 w-5 text-content-secondary" />}
						count={standup.yesterdayCompleted.length}
						emptyMessage="No items completed yesterday"
						expanded={expandedSections.has("completed")}
						onToggle={() => toggleSection("completed")}
					>
						<div className="space-y-2">
							{standup.yesterdayCompleted.map((item) => (
								<ChecklistItem key={item.id} item={item} />
							))}
						</div>
					</SupervisorCollapsibleSection>

					<SupervisorCollapsibleSection
						title="Attendees"
						icon={<Users className="h-5 w-5 text-content-secondary" />}
						count={standup.expectedAttendees.length}
						emptyMessage="No expected attendees for this site"
						expanded={expandedSections.has("attendees")}
						onToggle={() => toggleSection("attendees")}
					>
						<div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 scrollbar-hide">
							<div className="flex gap-3 min-w-min">
								{standup.expectedAttendees.map((attendee) => (
									<AttendeeAvatar
										key={attendee.teamMemberId}
										attendee={attendee}
									/>
								))}
							</div>
						</div>
					</SupervisorCollapsibleSection>
				</div>
			</div>
		</>
	);
}

function formatDate(dateStr: string) {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

const META_PLACEHOLDER = "—";

/** Critical first, then High, Medium, Low; unknown severities last */
const SEVERITY_SORT_ORDER: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

function severitySortKey(severity: string): number {
	return SEVERITY_SORT_ORDER[severity.toLowerCase()] ?? 99;
}

function DiscussionRow({
	severity,
	title,
	reason,
	location,
	owner,
}: {
	severity: string;
	title: string;
	reason: string;
	location: string | null;
	owner: string;
}) {
	const r = reason.trim() || META_PLACEHOLDER;
	const l = location?.trim() ? location : META_PLACEHOLDER;
	const o = owner.trim() || META_PLACEHOLDER;

	return (
		<SupervisorSectionCard className="shadow-sm" contentClassName="p-4">
			<p className="text-sm font-medium text-content-primary">{title}</p>
			<div className="mt-2 space-y-1.5">
				<p className="text-xs text-content-tertiary wrap-break-word">{r}</p>
				<p className="text-xs text-content-tertiary wrap-break-word">{l}</p>
				<div className="flex min-w-0 items-start justify-between gap-2">
					<p className="min-w-0 flex-1 text-xs text-content-tertiary wrap-break-word">
						{o}
					</p>
					<SeverityBadge severity={severity} />
				</div>
			</div>
		</SupervisorSectionCard>
	);
}

function NeedsDiscussionBody({
	activeBlockers,
	carryForwardItems,
}: {
	activeBlockers: StandupPrepSnapshot["activeBlockers"];
	carryForwardItems: StandupPrepSnapshot["carryForwardDueYesterday"];
}) {
	const sortedDiscussion = [
		...activeBlockers.map((b) => ({
			key: `active:${b.taskId}`,
			severity: b.severity,
			title: b.taskTitle,
			reason: b.reason,
			location: b.location,
			owner: b.ownerName,
		})),
		...carryForwardItems.map((item) => ({
			key: `carry:${item.id}`,
			severity: item.severity,
			title: item.taskTitle,
			reason: item.description,
			location: item.location ?? null,
			owner: item.ownerName,
		})),
	].sort((a, b) => {
		const bySev = severitySortKey(a.severity) - severitySortKey(b.severity);
		if (bySev !== 0) return bySev;
		return a.title.localeCompare(b.title);
	});

	return (
		<div className="space-y-2">
			{sortedDiscussion.length === 0 ? (
				<p className="text-sm italic text-content-tertiary">None</p>
			) : (
				sortedDiscussion.map((row) => (
					<DiscussionRow
						key={row.key}
						severity={row.severity}
						title={row.title}
						reason={row.reason}
						location={row.location}
						owner={row.owner}
					/>
				))
			)}
		</div>
	);
}

interface AttendeeAvatarProps {
	attendee: {
		teamMemberId: string;
		name: string;
		orgRoleCode: string;
		roleTypeName: string;
	};
}

function AttendeeAvatar({ attendee }: AttendeeAvatarProps) {
	return (
		<div className="flex flex-col items-center gap-1.5 min-w-[72px]">
			<Avatar
				initials={attendee.name.charAt(0).toUpperCase()}
				className="h-12 w-12 bg-surface-sunken text-content-primary"
			/>
			<div className="text-center">
				<p className="text-sm font-medium text-content-primary truncate max-w-[72px]">
					{attendee.name.split(" ")[0]}
				</p>
				<p className="text-xs text-content-tertiary truncate max-w-[72px]">
					{attendee.roleTypeName}
				</p>
			</div>
		</div>
	);
}

/** Some datasets prefix the line with "Planned:" / "Completed:"; the section header already states the kind. */
function stripStandupListDescriptionPrefix(description: string): string {
	return description.replace(/^(Planned|Completed):\s*/i, "").trim();
}

interface ChecklistItemProps {
	item: {
		id: string;
		description: string;
		location: string | null;
		department?: string | null;
		linkedTaskId?: string | null;
		ownerName: string;
	};
}

function ChecklistItem({ item }: ChecklistItemProps) {
	const line = stripStandupListDescriptionPrefix(item.description);
	const linked = Boolean(item.linkedTaskId);
	const card = (
		<SupervisorSectionCard
			className={cx(linked && "transition-colors hover:bg-surface-secondary/40")}
			contentClassName="p-4"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="text-sm text-content-primary">{line}</p>
					<div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
						{item.location && (
							<p className="text-xs text-content-tertiary">{item.location}</p>
						)}
						{item.department && (
							<p className="text-xs text-content-tertiary">{item.department}</p>
						)}
					</div>
					<p className="mt-1.5 text-xs text-content-tertiary">
						Owner · {item.ownerName}
					</p>
				</div>
			</div>
		</SupervisorSectionCard>
	);

	if (item.linkedTaskId) {
		return (
			<Link
				to="/supervisor/tasks/$taskId"
				params={{ taskId: item.linkedTaskId }}
				className={cx(
					"block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-control",
					supervisorCardRadiusClass,
				)}
			>
				{card}
			</Link>
		);
	}

	return card;
}

function StandupSkeleton() {
	return (
		<>
			<div
				className={supervisorHeaderClass({
					sticky: true,
					surface: "secondary",
				})}
			>
				<div
					className={cx(
						supervisorContainerClass("wide"),
						supervisorFixedHeaderHeightClass,
						"flex items-center justify-between",
					)}
				>
					<Skeleton className={cx("h-7 w-40", supervisorControlRadiusClass)} />
					<Skeleton className={cx("h-10 w-10", supervisorControlRadiusClass)} />
				</div>
			</div>
			<div
				className={cx(
					supervisorPageClass,
					supervisorContainerClass("wide"),
					supervisorFixedHeaderOffsetClass,
					"space-y-6",
				)}
			>
				<div
					className={cx(
						"border border-border-muted bg-surface-primary p-4 space-y-3",
						supervisorCardRadiusClass,
					)}
				>
					<Skeleton className={cx("h-6 w-36", supervisorControlRadiusClass)} />
					<div className="space-y-2">
						<Skeleton className="h-4 w-full max-w-md rounded" />
						<Skeleton className="h-4 w-full max-w-sm rounded" />
						<Skeleton className="h-4 w-full max-w-lg rounded" />
						<Skeleton className="h-4 w-full max-w-xs rounded" />
					</div>
					<Skeleton
						className={cx(
							"h-10 w-full max-w-[200px]",
							supervisorControlRadiusClass,
						)}
					/>
				</div>

				<div className="space-y-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton
							key={i}
							className={cx("h-48", supervisorCardRadiusClass)}
						/>
					))}
				</div>
			</div>
		</>
	);
}
