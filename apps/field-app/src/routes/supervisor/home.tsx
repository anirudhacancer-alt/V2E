import {
	Card,
	CardHeader,
	CardTitle,
	EmptyState,
	Skeleton,
} from "@enact-ui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Activity,
	Calendar,
	ChevronDown,
	ClipboardList,
	MapPin,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import {
	SupervisorCtaButton,
	SupervisorEmptyCard,
	SupervisorPageErrorState,
	SupervisorQuickActionPillCard,
	SupervisorSecondaryButton,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorPageClass,
	supervisorNativeSelectChromeClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/home")({
	component: SupervisorHomeComponent,
});

function SupervisorHomeComponent() {
	const {
		currentProjectId,
		setCurrentProjectId,
		projects,
		currentProject,
		isLoading: projectLoading,
	} = useProject();

	const {
		data: dashboard,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["dashboard", currentProjectId],
		queryFn: () => {
			const projectId = currentProjectId;
			if (!projectId) throw new Error("Project is required to load dashboard");
			return api.getDashboard(projectId);
		},
		enabled: Boolean(currentProjectId),
	});

	// Fetch recent updates for activity feed
	const { data: recentUpdates } = useQuery({
		queryKey: ["updates", currentProjectId, "recent"],
		queryFn: () => {
			const projectId = currentProjectId;
			if (!projectId)
				throw new Error("Project is required to load recent updates");
			return api.getUpdates(projectId, { pageSize: 100 });
		},
		enabled: Boolean(currentProjectId),
	});

	if (projectLoading || isLoading) {
		return <DashboardSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load dashboard"
				message={error.message}
				width="content"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (!dashboard) {
		return (
			<div className={cx(supervisorPageClass, "pt-6")}>
				<div className={supervisorContainerClass("content")}>
					<SupervisorEmptyCard
						title="No project selected"
						description="Select a project to view dashboard"
						icon={ClipboardList}
					/>
				</div>
			</div>
		);
	}

	const supervisor = {
		name: currentProject?.siteSupervisorName ?? "Supervisor",
	};
	const todayAttention = summarizeTodayAttention(
		recentUpdates?.items ?? [],
		dashboard.tasksBlockedToday ?? 0,
	);

	return (
		<>
			<div className={cx(supervisorPageClass)}>
				{/* Greeting Header - Mobile optimized */}
				<div
				className={cx(
					supervisorContainerClass("content"),
					"px-5 pt-6 pb-4 sm:pt-8",
				)}
			>
				<GreetingHeader
					supervisorName={supervisor.name}
					projects={projects}
					currentProjectId={currentProjectId ?? ""}
					isProjectLoading={projectLoading}
					onProjectChange={setCurrentProjectId}
				/>
			</div>

			<div
				className={cx(supervisorContainerClass("content"), "space-y-6 pb-8")}
			>
				<TodayAttentionCard
					totalCount={todayAttention.total}
					blockerCount={todayAttention.blockers}
					delayCount={todayAttention.delays}
					escalationCount={todayAttention.escalations}
					reviewQueueCount={dashboard.reviewQueueCount ?? 0}
				/>

				{/* Quick Actions */}
				<div className="flex flex-col">
					<h2 className="mb-4 text-base font-semibold uppercase tracking-wider text-content-tertiary">
						Quick Actions
					</h2>
					<div className="mt-2 grid grid-cols-2 gap-4">
						<Link to="/supervisor/tasks/new">
							<SupervisorQuickActionPillCard
								icon={
									<ClipboardList className="h-6 w-6 text-content-secondary" />
								}
								title="New Task"
							/>
						</Link>

						<Link to="/supervisor/standup">
							<SupervisorQuickActionPillCard
								icon={<Users className="h-6 w-6 text-content-secondary" />}
								title="Standup"
							/>
						</Link>
					</div>
				</div>

				{/* Recent Notes Feed */}
				<Card
					className={cx(
						"supervisor-material-card overflow-hidden p-0",
						supervisorCardRadiusClass,
					)}
				>
					<CardHeader className="border-b border-border-default/75 px-4 py-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div
									className={cx(
										"bg-surface-sunken p-2",
										supervisorControlRadiusClass,
									)}
								>
									<Activity className="h-5 w-5 text-content-secondary" />
								</div>
								<CardTitle className="text-base font-semibold text-content-primary">
									Recent Notes
								</CardTitle>
							</div>
							<Link to="/supervisor/updates" className="shrink-0">
								<SupervisorSecondaryButton
									className={cx(
										supervisorControlRadiusClass,
										"min-h-[44px] px-4 font-medium",
									)}
								>
									View all
								</SupervisorSecondaryButton>
							</Link>
						</div>
					</CardHeader>
					<div className="p-0">
						{recentUpdates?.items && recentUpdates.items.length > 0 ? (
							<div className="divide-y divide-border-default">
								{recentUpdates.items.slice(0, 4).map((update, index) => (
									<ActivityItem key={update.id} update={update} index={index} />
								))}
							</div>
						) : (
							<div className="px-5 py-12">
								<EmptyState size="sm">
									<EmptyState.Content>
										<EmptyState.Title>No recent notes</EmptyState.Title>
										<EmptyState.Description>
											Record a voice note to get started
										</EmptyState.Description>
									</EmptyState.Content>
								</EmptyState>
							</div>
						)}
					</div>
				</Card>

				{/* Last Updated Footer */}
				<div className="flex items-center justify-center gap-2 text-xs text-content-tertiary py-4">
					<Zap className="h-4 w-4 text-content-tertiary" />
					<span>Updated {formatRelativeTime(dashboard.lastUpdatedAt)}</span>
				</div>
			</div>
		</div>
		</>
	);
}

// Greeting Header with time-based message
function GreetingHeader({
	supervisorName,
	projects,
	currentProjectId,
	isProjectLoading,
	onProjectChange,
}: {
	supervisorName: string;
	projects: Array<{ id: string; name: string }>;
	currentProjectId: string;
	isProjectLoading: boolean;
	onProjectChange: (id: string) => void;
}) {
	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good morning";
		if (hour < 17) return "Good afternoon";
		return "Good evening";
	};

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="min-w-0 flex-1">
				<p className="mb-1 text-sm font-semibold text-content-secondary">
					{getGreeting()}
				</p>
				<h1 className="truncate text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
					{supervisorName}
				</h1>
			</div>

			<div className="min-w-[144px] max-w-[172px] shrink-0">
				{isProjectLoading ? (
					<Skeleton className={cx("h-12", supervisorControlRadiusClass)} />
				) : (
					<div className="relative">
						<select
							title="Select active project"
							aria-label="Select active project"
							value={currentProjectId}
							onChange={(e) => onProjectChange(e.target.value)}
							className={cx(
								supervisorNativeSelectChromeClass,
								supervisorControlRadiusClass,
								"supervisor-material-pill h-12 w-full cursor-pointer appearance-none bg-surface-primary/88 px-3 py-2.5 pr-9 text-left text-sm font-medium text-content-primary",
							)}
						>
							{projects.map((project) => (
								<option key={project.id} value={project.id}>
									{project.name}
								</option>
							))}
						</select>
						<ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
					</div>
				)}
			</div>
		</div>
	);
}

function TodayAttentionCard({
	totalCount,
	blockerCount,
	delayCount,
	escalationCount,
	reviewQueueCount,
}: {
	totalCount: number;
	blockerCount: number;
	delayCount: number;
	escalationCount: number;
	reviewQueueCount: number;
}) {
	const navigate = useNavigate();

	return (
		<Card
			className={cx(
				"supervisor-material-card overflow-hidden p-0",
				supervisorCardRadiusClass,
			)}
		>
			<div
				className={cx(
					"bg-linear-to-br from-surface-brand-subtle/35 via-surface-primary to-surface-primary dark:from-surface-brand-subtle/20 dark:via-surface-secondary dark:to-surface-base",
					"px-5 py-5 sm:px-6",
				)}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-content-brand">
							Today
						</p>
						<h2 className="mt-2 text-[1.8rem] font-bold leading-tight tracking-tight text-content-primary sm:text-[2rem]">
							{totalCount} items need attention today
						</h2>
					</div>
				</div>

				<div
					className={cx(
						"supervisor-material-card-quiet mt-4 bg-surface-sunken/86 px-4 py-3 text-sm font-medium text-content-secondary",
						supervisorControlRadiusClass,
					)}
				>
					{reviewQueueCount} in review queue
					<span className="px-2 text-content-tertiary">·</span>
					{blockerCount} blockers
					<span className="px-2 text-content-tertiary">·</span>
					{delayCount} delays
					<span className="px-2 text-content-tertiary">·</span>
					{escalationCount} escalations
				</div>

				<SupervisorCtaButton
					brandStyle="prominent"
					wrapperClassName="mt-5"
					onClick={() => navigate({ to: "/supervisor/updates" })}
				>
					Review now
				</SupervisorCtaButton>
			</div>
		</Card>
	);
}

// Activity Item for recent feed
interface ActivityUpdate {
	id: string;
	transcript: string;
	category: string | null;
	status: string;
	noteState?: "Review" | "Linked" | "Escalated";
	recordedByName: string;
	hasAudio: boolean;
	createdAt: string;
	updatedAt: string;
	location: string | null;
	locationHierarchy?: string;
	locationList: string;
}

function ActivityItem({
	update,
	index,
}: {
	update: ActivityUpdate;
	index: number;
}) {
	const [isVisible, setIsVisible] = useState(false);
	const itemRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					setTimeout(() => setIsVisible(true), index * 50);
				}
			},
			{ threshold: 0.1 },
		);

		if (itemRef.current) {
			observer.observe(itemRef.current);
		}

		return () => observer.disconnect();
	}, [index]);

	const navigate = useNavigate();

	const transcriptPreview =
		update.transcript.length > 96
			? `${update.transcript.slice(0, 96)}...`
			: update.transcript;

	const locationLabel = update.locationList;

	return (
		<button
			type="button"
			ref={itemRef}
			onClick={() =>
				navigate({
					to: "/supervisor/$updateId/review",
					params: { updateId: update.id },
				})
			}
			className={`supervisor-material-interactive flex w-full items-start gap-4 px-4 py-3 text-left transition-[transform,opacity,background-color] duration-300 hover:bg-surface-secondary/50 sm:px-6 sm:py-5 ${
				isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
			}`}
		>
			{/* Content: title (transcript) → compact location → meta row */}
			<div className="flex-1 min-w-0 space-y-2">
				<p className="line-clamp-2 text-sm font-medium leading-[1.28] text-content-primary sm:text-base">
					{transcriptPreview || (
						<span className="font-normal italic text-content-tertiary">
							No transcript available
						</span>
					)}
				</p>
				<div className="flex items-center gap-1.5 text-sm text-content-secondary">
					<MapPin
						className="h-3.5 w-3.5 shrink-0 text-content-tertiary"
						aria-hidden
					/>
					<span className="truncate">{locationLabel ?? "No location"}</span>
				</div>
				<div className="flex items-center justify-between gap-2 flex-wrap pt-1">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-xs sm:text-sm text-content-secondary font-medium">
							{update.recordedByName}
						</span>
						<span className="w-1 h-1 rounded-full bg-content-tertiary" />
						<div className="flex items-center gap-1.5 text-xs sm:text-sm text-content-tertiary">
							<Calendar className="w-3.5 h-3.5" />
							{formatRelativeTime(update.updatedAt)}
						</div>
					</div>
					<StatusBadge status={update.noteState ?? update.status} />
				</div>
			</div>
		</button>
	);
}

// Utility functions
function formatRelativeTime(dateStr: string) {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return "yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function summarizeTodayAttention(
	updates: Array<{
		category?: string | null;
		blockerSubtype?: string | null;
		status?: string;
		noteState?: "Review" | "Linked" | "Escalated";
		createdAt: string;
		updatedAt?: string;
	}>,
	taskBlockersToday = 0,
) {
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
		today.getDate(),
	).padStart(2, "0")}`;

	let blockers = 0;
	let delays = 0;
	let escalations = 0;

	updates.forEach((update) => {
		const updateDate = new Date(update.updatedAt ?? update.createdAt);
		const updateKey = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, "0")}-${String(
			updateDate.getDate(),
		).padStart(2, "0")}`;

		if (updateKey !== todayKey) return;

		const subtype = (update.blockerSubtype ?? "").toLowerCase();
		if (update.noteState === "Escalated" || update.status === "Escalated") {
			escalations += 1;
			return;
		}
		if (update.category === "MaterialDelay" || subtype.includes("delay")) {
			delays += 1;
			return;
		}
		if (update.category === "Blocker") {
			blockers += 1;
		}
	});

	return {
		blockers: blockers + Math.max(0, taskBlockersToday),
		delays,
		escalations,
		total: blockers + Math.max(0, taskBlockersToday) + delays + escalations,
	};
}

// Loading Skeleton with shimmer effect
function DashboardSkeleton() {
	return (
		<div className={supervisorPageClass}>
			{/* Header Skeleton */}
			<div
				className={cx(
					supervisorContainerClass("content"),
					"px-5 pt-6 pb-4 sm:pt-8",
				)}
			>
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<Skeleton className="mb-2 h-4 w-24 rounded-full" />
						<Skeleton
							className={cx("h-8 w-52", supervisorControlRadiusClass)}
						/>
						<Skeleton className="mt-2 h-4 w-40 rounded-full" />
					</div>
					<Skeleton className={cx("h-14 w-40", supervisorControlRadiusClass)} />
				</div>
			</div>

			<div
				className={cx(supervisorContainerClass("content"), "space-y-6 pb-8")}
			>
				<Skeleton className={cx("h-[220px]", supervisorCardRadiusClass)} />

				{/* Quick Actions Skeleton */}
				<div className="space-y-4">
					<Skeleton className="h-4 w-28 rounded-full" />
					<Skeleton className={cx("h-20", supervisorCardRadiusClass)} />
					<div className="grid grid-cols-2 gap-4">
						<Skeleton className={cx("h-28", supervisorCardRadiusClass)} />
						<Skeleton className={cx("h-28", supervisorCardRadiusClass)} />
					</div>
				</div>

				{/* Activity Skeleton */}
				<Skeleton className={cx("h-80", supervisorCardRadiusClass)} />
			</div>
		</div>
	);
}
