import { Avatar, Toggle } from "@enact-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Globe, KeyRound, Moon } from "lucide-react";
import { useState } from "react";
import {
	SupervisorCtaButton,
	SupervisorSearchHeader,
	SupervisorSecondaryButton,
	SupervisorSectionCard,
} from "../../components/supervisor-ui";
import { brandShellGradientClass } from "../../lib/brand-gradient";
import { applyColorScheme, getStoredColorScheme } from "../../lib/color-scheme";
import { useProject } from "../../lib/project-context";
import {
	cx,
	supervisorContainerClass,
	supervisorControlRadiusClass,
	supervisorFixedHeaderOffsetClass,
	supervisorNativeSelectClass,
	supervisorPageClass,
} from "../../lib/supervisor-layout";

export const Route = createFileRoute("/supervisor/profile")({
	component: SupervisorProfileComponent,
});

const fieldInputClass = cx(
	"supervisor-material-pill h-11 w-full bg-surface-primary/88 px-3 text-sm text-content-primary outline-none transition-colors focus:ring-2 focus:ring-ring-brand/25",
	supervisorControlRadiusClass,
);

function SupervisorProfileComponent() {
	const { currentProject } = useProject();
	const userName = currentProject?.siteSupervisorName ?? "Supervisor";
	const userEmail =
		currentProject?.siteSupervisorEmail ?? "supervisor@demo.local";
	const userRole = formatRoleLabel(
		currentProject?.siteSupervisorRole ?? "SiteSupervisor",
	);
	const userInitials =
		userName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "SU";

	const [language, setLanguage] = useState("en");
	const [darkMode, setDarkMode] = useState(
		() => getStoredColorScheme() === "dark",
	);

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
						"space-y-3 py-4 sm:py-5",
					)}
				>
					<div>
						<h1 className="text-xl font-bold text-content-primary">
							Profile
						</h1>
						<p className="text-sm text-content-secondary">
							Account and preferences for this device
						</p>
					</div>
					<SupervisorSectionCard>
						<div className="flex min-w-0 items-center gap-3">
							<Avatar
								initials={userInitials}
								contrastBorder={false}
								className={cx(
									"h-12 w-12 shrink-0 border-0 text-lg font-semibold text-white [&_span]:text-white!",
									brandShellGradientClass,
								)}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-content-primary">
									{userName}
								</p>
								<p className="truncate text-xs text-content-primary">
									{userEmail}
								</p>
								<p className="mt-0.5 text-xs text-content-primary">
									{userRole}
								</p>
							</div>
						</div>
					</SupervisorSectionCard>

					<SupervisorSectionCard
						title="Password & sign-in"
						icon={
							<div
								className={cx(
									"bg-surface-secondary p-2",
									supervisorControlRadiusClass,
								)}
							>
								<KeyRound className="h-4 w-4 text-content-secondary" />
							</div>
						}
						headerClassName="!mb-2"
					>
						<div className="space-y-3">
							<div className="space-y-1.5">
								<label
									htmlFor="profile-email"
									className="text-xs font-medium uppercase tracking-wide text-content-tertiary"
								>
									Email
								</label>
								<input
									id="profile-email"
									type="email"
									readOnly
									value={userEmail}
									className={cx(fieldInputClass, "text-content-secondary")}
									autoComplete="email"
								/>
							</div>
							<div className="space-y-1.5">
								<label
									htmlFor="profile-password-mask"
									className="text-xs font-medium uppercase tracking-wide text-content-tertiary"
								>
									Password
								</label>
								<input
									id="profile-password-mask"
									type="password"
									readOnly
									value="password"
									autoComplete="off"
									className={fieldInputClass}
									aria-label="Password (hidden)"
								/>
							</div>
							<SupervisorCtaButton
								type="button"
								onClick={() => {
									window.alert("Password reset is not available in this demo.");
								}}
							>
								Reset password
							</SupervisorCtaButton>
						</div>
					</SupervisorSectionCard>

					<SupervisorSectionCard
						title="Appearance"
						icon={
							<div
								className={cx(
									"bg-surface-secondary p-2",
									supervisorControlRadiusClass,
								)}
							>
								<Moon className="h-4 w-4 text-content-secondary" />
							</div>
						}
						headerClassName="!mb-2"
					>
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-content-secondary">
								Dark mode uses Enact UI theme tokens (saved on this device).
							</p>
							<Toggle
								id="profile-dark-mode"
								size="sm"
								isSelected={darkMode}
								onChange={(selected) => {
									setDarkMode(selected);
									applyColorScheme(selected ? "dark" : "light");
								}}
								label="Dark mode"
							/>
						</div>
					</SupervisorSectionCard>

					<SupervisorSectionCard
						title="Language & legal"
						icon={
							<div
								className={cx(
									"bg-surface-secondary p-2",
									supervisorControlRadiusClass,
								)}
							>
								<Globe className="h-4 w-4 text-content-secondary" />
							</div>
						}
						headerClassName="!mb-2"
					>
						<div className="space-y-3">
							<div className="space-y-1.5">
								<label
									htmlFor="profile-language"
									className="text-xs font-medium uppercase tracking-wide text-content-tertiary"
								>
									Language
								</label>
								<select
									id="profile-language"
									value={language}
									onChange={(e) => setLanguage(e.target.value)}
									className={supervisorNativeSelectClass}
								>
									<option value="en">English (US)</option>
									<option value="nl">Nederlands</option>
								</select>
							</div>
							<div className="border-t border-border-muted pt-3">
								<div className="mb-2 flex items-center gap-2 text-content-tertiary">
									<FileText className="h-4 w-4 shrink-0" aria-hidden />
									<span className="text-xs font-medium uppercase tracking-wide">
										Terms & privacy
									</span>
								</div>
								<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
									<SupervisorSecondaryButton
										type="button"
										className="h-auto min-h-0 border-0 bg-transparent p-0 font-inherit text-content-brand underline-offset-2 hover:underline"
										onClick={() => {
											window.alert("Terms of Service (demo placeholder).");
										}}
									>
										Terms of Service
									</SupervisorSecondaryButton>
									<SupervisorSecondaryButton
										type="button"
										className="h-auto min-h-0 border-0 bg-transparent p-0 font-inherit text-content-brand underline-offset-2 hover:underline"
										onClick={() => {
											window.alert("Privacy Policy (demo placeholder).");
										}}
									>
										Privacy Policy
									</SupervisorSecondaryButton>
								</div>
							</div>
						</div>
					</SupervisorSectionCard>

					<p className="pb-2 text-center text-xs text-content-tertiary">
						V2E · Voice to Execution · v0.1.0
					</p>
				</div>
			</div>
		</>
	);
}

function formatRoleLabel(role: string): string {
	return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}
