import { Badge, Skeleton } from "@enact-ui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlarmClock,
	AlertCircle,
	Ban,
	Calendar,
	CircleDot,
	MapPin,
	Plus,
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
import { useProject } from "../../lib/project-context";
import { severityToBadgeColor } from "../../lib/supervisor-badges";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/tasks/")({
	component: SupervisorTasksComponent,
});

type TaskFilterKey = "in-progress" | "blocked" | "overdue";

const TASK_FILTERS = [
	{ value: "in-progress" as const, label: "In-progress", icon: CircleDot },
	{ value: "blocked" as const, label: "Blocked", icon: Ban },
	{ value: "overdue" as const, label: "Overdue", icon: AlarmClock },
];

function taskFilterToApiParams(filter: TaskFilterKey | null): {
	status?: string;
	overdueOnly?: boolean;
} {
	if (filter === null) {
		return {};
	}
	if (filter === "overdue") {
		return { overdueOnly: true };
	}
	const statusByKey: Record<Exclude<TaskFilterKey, "overdue">, string> = {
		"in-progress": "In-progress",
		blocked: "Blocked",
	};
	return { status: statusByKey[filter] };
}

function SupervisorTasksComponent() {
	const navigate = useNavigate();
	const { currentProjectId, isLoading: projectLoading } = useProject();
	const [statusFilter, setStatusFilter] = useState<TaskFilterKey | null>(
		"in-progress",
	);
	const [searchQuery, setSearchQuery] = useState("");

	const { data, isLoading, error } = useQuery({
		queryKey: ["tasks", currentProjectId, statusFilter],
		queryFn: () => {
			const projectId = currentProjectId;
			if (!projectId) {
				throw new Error("Project is required to load tasks");
			}
			return api.getTasks(projectId, {
				pageSize: 50,
				...taskFilterToApiParams(statusFilter),
			});
		},
		enabled: !!currentProjectId,
	});

	// Filter and sort tasks client-side
	const filteredTasks = useMemo(() => {
		let tasks = data?.items ?? [];

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			tasks = tasks.filter(
				(task) =>
					task.title.toLowerCase().includes(query) ||
					task.owner.toLowerCase().includes(query) ||
					task.locationList.toLowerCase().includes(query),
			);
		}

		// Sort by most recently updated (newest first)
		return [...tasks].sort((a, b) => {
			const dateA = new Date(a.updatedAt).getTime();
			const dateB = new Date(b.updatedAt).getTime();
			return dateB - dateA;
		});
	}, [data?.items, searchQuery]);

	if (projectLoading || isLoading) {
		return <TasksSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load tasks"
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
				title="Tasks"
				count={data?.pagination.total ?? 0}
				filters={TASK_FILTERS}
				activeFilter={statusFilter}
				onFilterChange={setStatusFilter}
				width="wide"
				hideTitleRow
				stickyTop="60px"
			/>

			{/* Task List */}
			<div
				className={cx(
					supervisorPageClass,
					supervisorContainerClass("wide"),
					"pt-[136px]", // 60px search header + 68px compact header + 8px gap
				)}
			>
				{filteredTasks.length === 0 ? (
					<SupervisorEmptyCard
						title={searchQuery ? "No matching tasks" : "No tasks found"}
						description={
							searchQuery
								? "Try a different search term or adjust your filters"
								: "Try adjusting your filters or add a new task"
						}
						icon={AlertCircle}
						brandAccent
						action={
							!searchQuery && (
								<SupervisorCtaButton
									wrapperClassName="mt-4"
									onClick={() => navigate({ to: "/supervisor/tasks/new" })}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Task
								</SupervisorCtaButton>
							)
						}
					/>
				) : (
					<div className="space-y-2.5">
						{filteredTasks.map((task) => (
							<TaskCard key={task.id} task={task} />
						))}
					</div>
				)}

				{/* Pagination Info */}
				{data?.pagination &&
					data.pagination.totalPages > 1 &&
					!searchQuery && (
						<SupervisorListPaginationFooter
							showing={filteredTasks.length}
							total={data.pagination.total}
							noun="tasks"
						/>
					)}
			</div>
		</>
	);
}

interface Task {
	id: string;
	title: string;
	severity: string;
	departmentCode?: string | null;
	owner: string;
	ownerId: string;
	assigneeRoleCode: string;
	assigneeRoleName: string;
	location: string;
	/** Compact list label from API (`locations.listLabel`) */
	locationList: string;
	dueDate: string;
	updatedAt: string;
	status: string;
	isOverdue: boolean;
	dueSummary: string;
	source?: string;
	sourceUpdateId?: string | null;
}

function TaskCard({ task }: { task: Task }) {
	const navigate = useNavigate();

	const goToTask = () =>
		navigate({ to: "/supervisor/tasks/$taskId", params: { taskId: task.id } });

	return (
		<SupervisorEntityCard onClick={goToTask}>
			<div className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<h3 className="line-clamp-2 min-w-0 flex-1 text-[17px] font-semibold leading-[1.28] text-content-primary">
						{task.title}
					</h3>
					<div className="flex shrink-0 items-center gap-1 text-sm text-content-secondary">
						<Calendar className="h-3.5 w-3.5 text-content-tertiary" />
						<span className="whitespace-nowrap">{task.dueSummary}</span>
					</div>
				</div>

				<SupervisorChipRow className="mb-0 gap-1.5">
					<Badge
						color={severityToBadgeColor(task.severity)}
						variant="subtle"
						size="sm"
					>
						{task.severity}
					</Badge>
					{task.departmentCode ? (
						<Badge color="gray" variant="subtle" size="sm">
							{task.departmentCode}
						</Badge>
					) : null}
				</SupervisorChipRow>

				<div className="flex items-center gap-1.5 text-sm text-content-secondary">
					<MapPin className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
					<span className="truncate">{task.locationList}</span>
				</div>

				<div className="text-sm text-content-secondary">
					<span className="font-medium text-content-primary">
						{task.owner}
						<span className="font-normal text-content-tertiary"> · </span>
						<span className="text-content-secondary">
							{formatRoleLabel(task.assigneeRoleName)}
						</span>
					</span>
				</div>
			</div>
		</SupervisorEntityCard>
	);
}

function formatRoleLabel(role: string): string {
	return role.replace(/([A-Z])/g, " $1").trim();
}

function TasksSkeleton() {
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
							className={cx("h-32", supervisorCardRadiusClass)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
