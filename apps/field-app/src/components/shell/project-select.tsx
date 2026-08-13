import { Skeleton } from "@enact-ui/react";
import { Building2, ChevronDown } from "lucide-react";
import {
  cx,
  supervisorControlRadiusClass,
  supervisorNativeSelectClass,
  supervisorNativeSelectMobileClass,
} from "../../lib/supervisor-layout";

export interface ShellProjectOption {
	id: string;
	code: string;
	name: string;
	siteName: string;
}

interface DesktopProjectSelectProps {
	projects: ShellProjectOption[];
	currentProjectId: string;
	onChange: (id: string) => void;
	isLoading: boolean;
	currentSiteName?: string;
	/** Merged onto the outer wrapper (e.g. embed inside a Card on Profile). */
	className?: string;
}

export function DesktopProjectSelect({
	projects,
	currentProjectId,
	onChange,
	isLoading,
	currentSiteName,
	className,
}: DesktopProjectSelectProps) {
	return (
		<div className={className ?? "border-b border-border-primary p-3"}>
			<label
				htmlFor="desktop-project-selector"
				className="mb-2 block text-xs font-medium text-content-tertiary uppercase tracking-wider"
			>
				Project
			</label>
			{isLoading ? (
				<Skeleton className={cx("h-10", supervisorControlRadiusClass)} />
			) : (
				<div className="relative">
					<select
						id="desktop-project-selector"
						title="Select project"
						value={currentProjectId}
						onChange={(e) => onChange(e.target.value)}
						className={supervisorNativeSelectClass}
					>
						{projects.map((project) => (
							<option key={project.id} value={project.id}>
								{project.code} - {project.name}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
				</div>
			)}
			{currentSiteName ? (
				<div className="mt-2 flex items-center gap-2 text-xs text-content-tertiary">
					<Building2 className="h-3 w-3" />
					<span>{currentSiteName}</span>
				</div>
			) : null}
		</div>
	);
}

interface MobileProjectSelectProps {
	projects: ShellProjectOption[];
	currentProjectId: string;
	onChange: (id: string) => void;
	isLoading: boolean;
}

export function MobileProjectSelect({
	projects,
	currentProjectId,
	onChange,
	isLoading,
}: MobileProjectSelectProps) {
	if (isLoading || projects.length <= 1) {
		return null;
	}

	return (
		<div className="relative shrink-0">
			<select
				title="Select active project"
				aria-label="Select active project"
				value={currentProjectId}
				onChange={(e) => onChange(e.target.value)}
				className={supervisorNativeSelectMobileClass}
			>
				{projects.map((project) => (
					<option key={project.id} value={project.id}>
						{project.code}
					</option>
				))}
			</select>
			<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
		</div>
	);
}
