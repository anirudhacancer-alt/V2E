import { Badge, Skeleton } from "@enact-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Calendar, MapPin, User } from "lucide-react";
import {
	SupervisorCtaButton,
	SupervisorPageErrorState,
	SupervisorSearchHeader,
	SupervisorSecondaryButton,
	SupervisorSectionCard,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorFixedHeaderOffsetClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/tasks/$taskId")({
	component: TaskDetailComponent,
});

type TaskStatus = "In-progress" | "Blocked" | "Done";

function TaskDetailComponent() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();
	const { currentProjectId, isLoading: projectLoading } = useProject();

	const {
		data: task,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["task", taskId],
		queryFn: () => api.getTask(taskId),
		enabled: !!taskId,
	});

	const statusMutation = useMutation({
		mutationFn: (status: TaskStatus) =>
			api.updateTaskStatus(taskId, status),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["task", taskId],
			});
			queryClient.invalidateQueries({ queryKey: ["tasks", currentProjectId] });
		},
	});

	if (projectLoading || isLoading) {
		return <TaskDetailSkeleton />;
	}

	if (error) {
		return (
			<SupervisorPageErrorState
				title="Failed to load task"
				message={(error as Error).message}
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (!task) {
		return (
			<SupervisorPageErrorState
				title="Task not found"
				message="This task may have been removed or the link is invalid."
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	const statusColor: Record<string, "brand" | "warning" | "success" | "gray"> =
		{
			"In-progress": "brand",
			Blocked: "warning",
			Done: "success",
		};

	return (
		<>
			<SupervisorSearchHeader
				showSearch={false}
				showBackButton={true}
				width="wide"
			/>

			<div
				className={cx(
					supervisorPageClass,
					supervisorContainerClass("wide"),
					supervisorFixedHeaderOffsetClass,
					"space-y-4",
				)}
			>
				<div>
					<h1 className="text-xl font-bold text-content-primary">
						{task.title}
					</h1>
					<p className="text-sm text-content-secondary">
						Update status and review details
					</p>
				</div>
				<SupervisorSectionCard contentClassName="p-4" className="shadow-sm">
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge
								color="gray"
								className="border border-border-secondary bg-transparent text-content-secondary"
							>
								{task.severity}
							</Badge>
							<Badge color={statusColor[task.status] ?? "gray"}>
								{task.status}
							</Badge>
							{task.departmentCode ? (
								<Badge
									color="gray"
									className="border border-border-secondary bg-transparent text-content-secondary"
								>
									{task.departmentCode}
								</Badge>
							) : null}
							{task.isOverdue && task.status !== "Done" ? (
								<Badge color="error">Overdue</Badge>
							) : null}
						</div>

						<p className="whitespace-pre-wrap text-sm text-content-secondary">
							{task.description}
						</p>

						<div className="grid gap-3 text-sm sm:grid-cols-2">
							<div className="flex items-start gap-2">
								<User className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-tertiary" />
								<div>
									<div className="text-content-tertiary">Owner</div>
									<div className="font-medium text-content-primary">
										{task.owner}
									</div>
									<div className="text-content-tertiary">
										{task.assigneeRoleName}
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-tertiary" />
								<div>
									<div className="text-content-tertiary">Location</div>
									<div className="font-medium text-content-primary">
										{task.location}
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-tertiary" />
								<div>
									<div className="text-content-tertiary">Due</div>
									<div className="font-medium text-content-primary">
										{task.dueDate}
									</div>
								</div>
							</div>
						</div>

						<div className="border-t border-border-muted pt-4">
							<p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-tertiary">
								Status
							</p>
							<div className="flex w-full gap-2">
								{(["In-progress", "Blocked", "Done"] as const).map((s) => (
									task.status === s ? (
										<SupervisorCtaButton
											key={s}
											wrapperClassName="min-w-0 flex-1 basis-0"
											className="min-w-0 flex-1 basis-0"
											disabled
										>
											{s}
										</SupervisorCtaButton>
									) : (
										<SupervisorSecondaryButton
											key={s}
											className="min-w-0 flex-1 basis-0"
											disabled={statusMutation.isPending}
											onClick={() => statusMutation.mutate(s)}
										>
											{s}
										</SupervisorSecondaryButton>
									)
								))}
							</div>
							{statusMutation.isError ? (
								<p className="mt-2 text-sm text-content-error">
									{(statusMutation.error as Error).message}
								</p>
							) : null}
						</div>

						{task.sourceUpdateId ? (
							<div className="text-xs text-content-tertiary">
								Linked update:{" "}
								<Link
									to="/supervisor/$updateId/review"
									params={{ updateId: task.sourceUpdateId }}
									className="text-content-brand underline"
								>
									Open review
								</Link>
							</div>
						) : null}
					</div>
				</SupervisorSectionCard>
			</div>
		</>
	);
}

function TaskDetailSkeleton() {
	return (
		<div className={supervisorPageClass}>
			<div className="border-b border-border-primary bg-surface-primary">
				<div className={cx(supervisorContainerClass("wide"), "py-4")}>
					<Skeleton className="mb-2 h-6 w-48 rounded-lg" />
					<Skeleton className="h-4 w-64 rounded-lg" />
				</div>
			</div>
			<div className={cx(supervisorContainerClass("wide"), "py-4")}>
				<Skeleton className={cx("h-64", supervisorCardRadiusClass)} />
			</div>
		</div>
	);
}
