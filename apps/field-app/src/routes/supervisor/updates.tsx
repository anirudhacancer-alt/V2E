import { Badge, Skeleton } from "@enact-ui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	ClipboardList,
	Link2,
	MapPin,
	Mic,
	Paperclip,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	SupervisorChipRow,
	SupervisorCompactListHeader,
	SupervisorCtaButton,
	SupervisorEmptyCard,
	SupervisorEntityCard,
	SupervisorListPaginationFooter,
	SupervisorPageErrorState,
	SupervisorSearchHeader,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { brandMicFabButtonClass } from "../../lib/brand-gradient";
import { useProject } from "../../lib/project-context";
import { severityToBadgeColor } from "../../lib/supervisor-badges";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/updates")({
	component: SupervisorUpdatesComponent,
});

type NoteFilter = "Review" | "Linked" | "Escalated";

const UPDATE_FILTERS = [
	{ value: "Review" as const, label: "Review", icon: ClipboardList },
	{ value: "Linked" as const, label: "Linked", icon: Link2 },
	{ value: "Escalated" as const, label: "Escalated", icon: AlertTriangle },
];

/** All-queue list: last 2 months through next 2 months on `updatedAt` (server-enforced when params sent). */
function getUpdatesActivityWindowIso(): {
	updatedAfter: string;
	updatedBefore: string;
} {
	const now = new Date();
	const start = new Date(now);
	start.setMonth(start.getMonth() - 2);
	const end = new Date(now);
	end.setMonth(end.getMonth() + 2);
	return {
		updatedAfter: start.toISOString(),
		updatedBefore: end.toISOString(),
	};
}

function SupervisorUpdatesComponent() {
	const { currentProjectId, isLoading: projectLoading } = useProject();
	const navigate = useNavigate();
	const [noteFilter, setNoteFilter] = useState<NoteFilter | null>("Review");
	const [searchQuery, setSearchQuery] = useState("");

	const { data, isLoading, error } = useQuery({
		queryKey: ["updates", currentProjectId, noteFilter],
		queryFn: () => {
			const projectId = currentProjectId;
			if (!projectId) {
				throw new Error("Project is required to load updates");
			}
			if (noteFilter === null) {
				const { updatedAfter, updatedBefore } = getUpdatesActivityWindowIso();
				return api.getUpdates(projectId, {
					pageSize: 50,
					updatedAfter,
					updatedBefore,
				});
			}
			return api.getUpdates(projectId, {
				noteState: noteFilter,
				pageSize: 50,
			});
		},
		enabled: !!currentProjectId,
	});

	// Filter and sort updates client-side
	const filteredUpdates = useMemo(() => {
		let updates = data?.items ?? [];

		// Filter by search query (transcript, location, recorded by)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			updates = updates.filter(
				(update) =>
					update.transcript.toLowerCase().includes(query) ||
					update.recordedByName.toLowerCase().includes(query) ||
					update.locationList.toLowerCase().includes(query),
			);
		}

		// Sort by created date (newest first)
		return [...updates].sort((a, b) => {
			const dateA = new Date(a.createdAt).getTime();
			const dateB = new Date(b.createdAt).getTime();
			return dateB - dateA;
		});
	}, [data?.items, searchQuery]);

	if (projectLoading || isLoading) {
		return <UpdatesSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load updates"
				message={error.message}
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	return (
		<>
			<SupervisorSearchHeader
				placeholder="Search"
				searchValue={searchQuery}
				onSearchChange={setSearchQuery}
				showBackButton={false}
				width="wide"
			/>

			<SupervisorCompactListHeader
				title="Updates"
				count={data?.pagination.total ?? 0}
				filters={UPDATE_FILTERS}
				activeFilter={noteFilter}
				onFilterChange={setNoteFilter}
				width="wide"
				hideTitleRow
				stickyTop="60px"
			/>

			{/* Updates List */}
			<div
				className={cx(
					supervisorPageClass,
					supervisorContainerClass("wide"),
					"pt-[136px]", // 60px search header + 68px compact header + 8px gap
				)}
			>
				{filteredUpdates.length === 0 ? (
					<SupervisorEmptyCard
						title={searchQuery ? "No matching updates" : "No updates yet"}
						description={
							searchQuery
								? "Try a different search term or adjust your filters"
								: "Voice recordings and site updates will appear here once submitted"
						}
						featured={
							!searchQuery && (
								<div className="relative mx-auto flex h-16 w-16 items-center justify-center">
									<div
										className={cx(
											"flex h-16 w-16 items-center justify-center rounded-full",
											brandMicFabButtonClass,
										)}
									>
										<Mic className="h-8 w-8 text-content-on-brand" />
									</div>
								</div>
							)
						}
						action={
							!searchQuery && (
								<SupervisorCtaButton
									brandStyle="prominent"
									wrapperClassName="mt-6"
									onClick={() => navigate({ to: "/supervisor/record" })}
								>
									<Mic className="mr-2 h-4 w-4" />
									Record Update
								</SupervisorCtaButton>
							)
						}
					/>
				) : (
					<div className="space-y-2.5">
						{filteredUpdates.map((update) => (
							<UpdateCard key={update.id} update={update} />
						))}
					</div>
				)}

				{/* Pagination Info */}
				{data?.pagination &&
					data.pagination.totalPages > 1 &&
					!searchQuery && (
						<SupervisorListPaginationFooter
							showing={filteredUpdates.length}
							total={data.pagination.total}
							noun="updates"
						/>
					)}
			</div>
		</>
	);
}

interface Update {
	id: string;
	transcript: string;
	category: string | null;
	location: string | null;
	severity: string | null;
	status: string;
	noteState: NoteFilter;
	recordedByName: string;
	recordedByRole: string;
	hasAudio: boolean;
	hasAttachments: boolean;
	attachmentCount: number;
	createdAt: string;
	updatedAt: string;
	isUnread: boolean;
	blockerSubtype: string | null;
	locationHierarchy?: string;
	locationList: string;
	linkedTaskId: string | null;
	linkedTaskTitle: string | null;
	linkedTaskStatus: string | null;
	reviewPrompt: string | null;
	reviewReasons: string[];
	nextActionHint: string;
}

function UpdateCard({ update }: { update: Update }) {
	const navigate = useNavigate();

	// Keep title copy short enough to preserve compact card height.
	const transcriptPreview =
		update.transcript.length > 96
			? `${update.transcript.slice(0, 96)}...`
			: update.transcript;

	const goToReview = () =>
		navigate({
			to: "/supervisor/$updateId/review",
			params: { updateId: update.id },
		});

	return (
		<SupervisorEntityCard onClick={goToReview}>
			<div className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-start gap-1.5">
						{update.isUnread ? (
							<span
								className="mt-2 h-2 w-2 shrink-0 rounded-full bg-surface-brand"
								role="presentation"
							/>
						) : null}
						<p className="line-clamp-2 text-base font-medium leading-snug text-content-primary">
							{transcriptPreview || (
								<span className="italic text-content-tertiary">
									No transcript available
								</span>
							)}
						</p>
					</div>
					<span className="shrink-0 text-sm text-content-tertiary">
						{formatDeltaDate(update.createdAt)}
					</span>
				</div>

				{update.category || update.severity ? (
					<SupervisorChipRow className="mb-0 gap-1.5">
						{update.category ? (
							<Badge color="gray" variant="subtle" size="sm">
								{update.category === "Blocker" && update.blockerSubtype
									? `Blocker · ${update.blockerSubtype}`
									: update.category}
							</Badge>
						) : null}
						{update.severity ? (
							<Badge
								color={severityToBadgeColor(update.severity)}
								variant="subtle"
								size="sm"
							>
								{update.severity}
							</Badge>
						) : null}
					</SupervisorChipRow>
				) : null}

				<div className="text-sm text-content-secondary">
					<span className="font-medium text-content-primary">
						{update.recordedByName}
					</span>
					<span className="text-content-tertiary"> · </span>
					<span>{formatRoleLabel(update.recordedByRole)}</span>
					{update.hasAttachments ? (
						<>
							<span className="text-content-tertiary"> · </span>
							<span className="inline-flex items-center gap-1">
								<Paperclip className="h-3.5 w-3.5 text-content-tertiary" />
								{update.attachmentCount}
							</span>
						</>
					) : null}
				</div>

				<div className="flex items-center gap-1.5 text-sm text-content-secondary">
					<MapPin className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
					<span className="truncate">{update.locationList}</span>
				</div>

				<div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-content-secondary">
					{update.noteState === "Escalated" ? (
						<span
							className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
							title="Escalated — needs supervisor follow-up"
						>
							<AlertTriangle
								className="h-4 w-4 shrink-0 text-content-tertiary"
								strokeWidth={2}
								aria-hidden
							/>
							<span className="font-medium text-content-primary">
								Needs supervisor follow-up
							</span>
							<span className="sr-only">
								Escalated — needs supervisor follow-up
							</span>
						</span>
					) : update.noteState === "Linked" && update.linkedTaskId ? (
						<>
							<span
								className="inline-flex shrink-0"
								title="Linked to open task"
							>
								<Link2 className="h-4 w-4 text-content-tertiary" aria-hidden />
							</span>
							<span className="sr-only">Linked to open task</span>
							<span className="min-w-0 font-medium text-content-primary">
								{update.linkedTaskTitle ?? "Task"}
							</span>
							{update.linkedTaskStatus ? (
								<span className="text-content-tertiary">
									· {update.linkedTaskStatus}
								</span>
							) : null}
						</>
					) : update.linkedTaskId ? (
						<>
							<span className="inline-flex shrink-0" title="Task from note">
								<ClipboardList
									className="h-4 w-4 text-content-tertiary"
									aria-hidden
								/>
							</span>
							<span className="sr-only">Task from note</span>
							<span className="min-w-0 font-medium text-content-primary">
								{update.linkedTaskTitle ?? "Task"}
							</span>
							{update.linkedTaskStatus ? (
								<span className="text-content-tertiary">
									· {update.linkedTaskStatus}
								</span>
							) : null}
							{update.reviewPrompt ? (
								<span className="min-w-0 text-content-tertiary">
									· {update.reviewPrompt}
								</span>
							) : null}
						</>
					) : (
						<span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-content-tertiary">
							<span className="inline-flex shrink-0" title="Review">
								<ClipboardList
									className="h-4 w-4 text-content-tertiary"
									aria-hidden
								/>
							</span>
							<span className="sr-only">Review: </span>
							<span className="min-w-0">
								{update.reviewPrompt ?? "Confirm: AI extraction"}
							</span>
						</span>
					)}
				</div>
			</div>
		</SupervisorEntityCard>
	);
}

function formatDeltaDate(dateStr: string) {
	const timestamp = new Date(dateStr).getTime();
	if (Number.isNaN(timestamp)) return "Now";

	const deltaMs = Date.now() - timestamp;
	if (deltaMs <= 0) return "Now";

	const hours = Math.floor(deltaMs / (1000 * 60 * 60));
	if (hours < 1) return "Now";
	if (hours < 24) return `${hours}h`;

	const days = Math.floor(hours / 24);
	return `${days}d`;
}

function formatRoleLabel(role: string): string {
	return role.replace(/([A-Z])/g, " $1").trim();
}

function UpdatesSkeleton() {
	return (
		<div className={supervisorPageClass}>
			<div className="border-b border-border-muted bg-surface-base">
				<div
					className={cx(supervisorContainerClass("wide"), "max-w-7xl w-full")}
				>
					<div className="flex w-full min-h-[48px] items-stretch gap-2 py-2 pt-1 sm:pt-2">
						{[1, 2, 3].map((i) => (
							<Skeleton
								key={i}
								className={cx(
									"h-12 min-h-[48px] min-w-0 flex-1 basis-0",
									supervisorControlRadiusClass,
								)}
							/>
						))}
					</div>
				</div>
			</div>

			<div
				className={cx(
					supervisorContainerClass("wide"),
					"pt-[136px] py-4", // Account for search header + compact header
				)}
			>
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<Skeleton
							key={i}
							className={cx("h-36", supervisorCardRadiusClass)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
