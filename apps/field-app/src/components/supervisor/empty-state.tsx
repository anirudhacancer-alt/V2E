import { Card, CardContent, EmptyState } from "@enact-ui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	brandShellGradientClass,
	brandShellShadowMdClass,
} from "../../lib/brand-gradient";
import { cx, supervisorCardRadiusClass } from "../../lib/supervisor-layout";

interface SupervisorEmptyCardProps {
	title: string;
	description: string;
	icon?: LucideIcon;
	/** Use teal gradient shell for the header icon (supervisor brand profile). */
	brandAccent?: boolean;
	featured?: ReactNode;
	action?: ReactNode;
}

function BrandGradientFeaturedIcon({ icon: Icon }: { icon: LucideIcon }) {
	return (
		<div
			className={cx(
				"mx-auto flex h-16 w-16 items-center justify-center",
				supervisorCardRadiusClass,
				brandShellGradientClass,
				brandShellShadowMdClass,
			)}
		>
			<Icon
				className="h-8 w-8 text-content-on-brand"
				aria-hidden
				strokeWidth={2}
			/>
		</div>
	);
}

export function SupervisorEmptyCard({
	title,
	description,
	icon,
	brandAccent = false,
	featured,
	action,
}: SupervisorEmptyCardProps) {
	const headerVisual =
		featured ??
		(icon ? (
			brandAccent ? (
				<BrandGradientFeaturedIcon icon={icon} />
			) : (
				<EmptyState.FeaturedIcon icon={icon} color="gray" />
			)
		) : null);

	return (
		<Card className={cx("p-4", supervisorCardRadiusClass)}>
			<CardContent className="py-16">
				<EmptyState>
					<EmptyState.Header>{headerVisual}</EmptyState.Header>
					<EmptyState.Content>
						<EmptyState.Title>{title}</EmptyState.Title>
						<EmptyState.Description>{description}</EmptyState.Description>
					</EmptyState.Content>
					{action ? <EmptyState.Footer>{action}</EmptyState.Footer> : null}
				</EmptyState>
			</CardContent>
		</Card>
	);
}
