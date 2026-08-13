import { Skeleton } from "@enact-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DEPARTMENT_CODES } from "@v2e/contracts";
import { useEffect, useMemo, useState } from "react";
import {
	SupervisorPageErrorState,
	SupervisorSearchHeader,
	SupervisorCtaButton,
	SupervisorSecondaryButton,
	SupervisorSectionCard,
} from "../../components/supervisor-ui";
import { api } from "../../lib/api";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorCardRadiusClass,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderOffsetClass,
	supervisorNativeSelectClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/tasks/new")({
	component: NewTaskComponent,
});

type TaskSeverity = "Low" | "Medium" | "High" | "Critical";

const formInputClass = cx(
	"supervisor-material-pill h-11 w-full bg-surface-primary/88 px-3 text-content-primary outline-none transition-colors",
	"placeholder:text-content-tertiary focus:ring-2 focus:ring-ring-brand/25",
	supervisorControlRadiusClass,
);

const formTextareaClass = cx(
	"supervisor-material-pill w-full bg-surface-primary/88 px-3 py-2.5 text-content-primary outline-none transition-colors",
	"placeholder:text-content-tertiary focus:ring-2 focus:ring-ring-brand/25",
	supervisorControlRadiusClass,
);

interface NewTaskFormData {
	title: string;
	description: string;
	severity: TaskSeverity;
	departmentCode: string;
	locationId: string;
	ownerId: string;
	dueDate: string;
}

function NewTaskComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { currentProjectId, isLoading: projectLoading } = useProject();
	const [formData, setFormData] = useState<NewTaskFormData>({
		title: "",
		description: "",
		severity: "Medium",
		departmentCode: "",
		locationId: "",
		ownerId: "",
		dueDate: "",
	});

	const {
		data: locRes,
		isLoading: locLoading,
		error: locError,
	} = useQuery({
		queryKey: ["project-locations", currentProjectId],
		queryFn: () => {
			if (!currentProjectId) {
				throw new Error("Project is required to load locations");
			}
			return api.getProjectLocations(currentProjectId);
		},
		enabled: !!currentProjectId,
	});
	const projectLocations = locRes?.items ?? [];

	const {
		data: teamRes,
		isLoading: teamLoading,
		error: teamError,
	} = useQuery({
		queryKey: ["members", currentProjectId],
		queryFn: () => {
			if (!currentProjectId) {
				throw new Error("Project is required to load team members");
			}
			return api.getMembers(currentProjectId);
		},
		enabled: !!currentProjectId,
	});

	const teamMembers = teamRes?.items ?? [];
	const selectedOwner = useMemo(
		() => teamMembers.find((member) => member.id === formData.ownerId),
		[teamMembers, formData.ownerId],
	);

	useEffect(() => {
		if (!formData.ownerId && teamMembers.length > 0) {
			setFormData((prev) => ({ ...prev, ownerId: teamMembers[0]?.id ?? "" }));
		}
	}, [teamMembers, formData.ownerId]);

	useEffect(() => {
		if (!formData.locationId && projectLocations.length > 0) {
			setFormData((prev) => ({ ...prev, locationId: projectLocations[0].id }));
		}
	}, [projectLocations, formData.locationId]);

	useEffect(() => {
		if (!formData.departmentCode && DEPARTMENT_CODES.length > 0) {
			setFormData((prev) => ({
				...prev,
				departmentCode: DEPARTMENT_CODES[0] ?? "",
			}));
		}
	}, [formData.departmentCode]);

	const createTaskMutation = useMutation({
		mutationFn: async () => {
			if (!currentProjectId) {
				throw new Error("Project is required to create a task");
			}
			if (!selectedOwner?.id) {
				throw new Error("Owner is required");
			}
			return api.createTask(currentProjectId, {
				title: formData.title.trim(),
				description: formData.description.trim(),
				severity: formData.severity,
				departmentCode: formData.departmentCode,
				locationId: formData.locationId,
				ownerId: selectedOwner.id,
				assigneeRoleCode: selectedOwner.orgRoleCode,
				dueDate: formData.dueDate,
			});
		},
		onSuccess: (createdTask) => {
			queryClient.invalidateQueries({ queryKey: ["tasks", currentProjectId] });
			navigate({
				to: "/supervisor/tasks/$taskId",
				params: { taskId: createdTask.id },
			});
		},
	});

	const canSubmit =
		!!currentProjectId &&
		!!formData.title.trim() &&
		!!formData.description.trim() &&
		!!formData.departmentCode &&
		!!formData.locationId &&
		!!formData.ownerId &&
		!!formData.dueDate;

	if (projectLoading || teamLoading || locLoading) {
		return <NewTaskSkeleton />;
	}

	if (locError) {
		return (
			<SupervisorPageErrorState
				title="Failed to load locations"
				message={(locError as Error).message}
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (teamError) {
		return (
			<SupervisorPageErrorState
				title="Failed to load team members"
				message={(teamError as Error).message}
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (!currentProjectId) {
		return (
			<SupervisorPageErrorState
				title="No active project"
				message="Select a project first to create a new task."
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	if (projectLocations.length === 0) {
		return (
			<SupervisorPageErrorState
				title="No locations"
				message="This project has no locations. Run: pnpm --filter @v2e/database db:seed"
				width="wide"
				pageClassName={supervisorPageClass}
			/>
		);
	}

	return (
		<div className={supervisorPageClass}>
			<SupervisorSearchHeader
				showBackButton={true}
				width="wide"
			/>

			<div
				className={cx(
					supervisorContainerClass("wide"),
					supervisorFixedHeaderOffsetClass,
					"space-y-4",
				)}
			>
				<div>
					<h1 className="text-xl font-bold text-content-primary">
						New Task
					</h1>
					<p className="text-sm text-content-secondary">
						Create and assign a task for the team
					</p>
				</div>
				<SupervisorSectionCard
					className="shadow-sm"
					contentClassName="space-y-4 p-4"
				>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (canSubmit && !createTaskMutation.isPending) {
								createTaskMutation.mutate();
							}
						}}
					>
						<div className="space-y-2">
							<label
								htmlFor="task-title"
								className="text-sm font-medium text-content-primary"
							>
								Title
							</label>
							<input
								id="task-title"
								type="text"
								value={formData.title}
								onChange={(event) =>
									setFormData((prev) => ({
										...prev,
										title: event.target.value,
									}))
								}
								placeholder="e.g. Fix water leak near Block B"
								className={formInputClass}
							/>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="task-description"
								className="text-sm font-medium text-content-primary"
							>
								Description
							</label>
							<textarea
								id="task-description"
								value={formData.description}
								onChange={(event) =>
									setFormData((prev) => ({
										...prev,
										description: event.target.value,
									}))
								}
								rows={4}
								placeholder="Add details so the assignee knows exactly what to do"
								className={formTextareaClass}
							/>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<label
									htmlFor="task-severity"
									className="text-sm font-medium text-content-primary"
								>
									Severity
								</label>
								<select
									id="task-severity"
									value={formData.severity}
									onChange={(event) =>
										setFormData((prev) => ({
											...prev,
											severity: event.target.value as TaskSeverity,
										}))
									}
									className={supervisorNativeSelectClass}
								>
									<option value="Low">Low</option>
									<option value="Medium">Medium</option>
									<option value="High">High</option>
									<option value="Critical">Critical</option>
								</select>
							</div>

							<div className="space-y-2">
								<label
									htmlFor="task-department"
									className="text-sm font-medium text-content-primary"
								>
									Department
								</label>
								<select
									id="task-department"
									value={formData.departmentCode}
									onChange={(event) =>
										setFormData((prev) => ({
											...prev,
											departmentCode: event.target.value,
										}))
									}
									className={supervisorNativeSelectClass}
								>
									{DEPARTMENT_CODES.map((code) => (
										<option key={code} value={code}>
											{code}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<label
									htmlFor="task-owner"
									className="text-sm font-medium text-content-primary"
								>
									Owner
								</label>
								<select
									id="task-owner"
									value={formData.ownerId}
									onChange={(event) =>
										setFormData((prev) => ({
											...prev,
											ownerId: event.target.value,
										}))
									}
									className={supervisorNativeSelectClass}
								>
									<option value="">Select owner</option>
									{teamMembers.map((member) => (
										<option key={member.id} value={member.id}>
											{member.name} — {member.roleTypeName}
										</option>
									))}
								</select>
							</div>

							<div className="space-y-2">
								<label
									htmlFor="task-due-date"
									className="text-sm font-medium text-content-primary"
								>
									Due date
								</label>
								<input
									id="task-due-date"
									type="date"
									value={formData.dueDate}
									onChange={(event) =>
										setFormData((prev) => ({
											...prev,
											dueDate: event.target.value,
										}))
									}
									className={formInputClass}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="task-location"
								className="text-sm font-medium text-content-primary"
							>
								Location
							</label>
							<select
								id="task-location"
								value={formData.locationId}
								onChange={(event) =>
									setFormData((prev) => ({
										...prev,
										locationId: event.target.value,
									}))
								}
								className={supervisorNativeSelectClass}
							>
								{projectLocations.map((loc) => (
									<option key={loc.id} value={loc.id}>
										{loc.listLabel}
									</option>
								))}
							</select>
						</div>

						{createTaskMutation.isError ? (
							<p className="text-sm text-content-error">
								{(createTaskMutation.error as Error).message}
							</p>
						) : null}

						<div className="flex items-center justify-end gap-2 pt-4">
							<SupervisorSecondaryButton
								type="button"
								onClick={() => navigate({ to: "/supervisor/tasks" })}
							>
								Cancel
							</SupervisorSecondaryButton>
							<SupervisorCtaButton
								type="submit"
								fullWidth={false}
								disabled={!canSubmit || createTaskMutation.isPending}
							>
								{createTaskMutation.isPending ? "Creating..." : "Create Task"}
							</SupervisorCtaButton>
						</div>
					</form>
				</SupervisorSectionCard>
			</div>
		</div>
	);
}

function NewTaskSkeleton() {
	return (
		<div className={supervisorPageClass}>
			<div className="border-b border-border-primary bg-surface-primary">
				<div className={cx(supervisorContainerClass("wide"), "py-4")}>
					<Skeleton
						className={cx("mb-2 h-6 w-48", supervisorControlRadiusClass)}
					/>
					<Skeleton className={cx("h-4 w-64", supervisorControlRadiusClass)} />
				</div>
			</div>
			<div className={cx(supervisorContainerClass("wide"), "py-4")}>
				<Skeleton className={cx("h-[560px]", supervisorCardRadiusClass)} />
			</div>
		</div>
	);
}
