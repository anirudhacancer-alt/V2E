import type { ReactNode } from "react";
import {
  cx,
  supervisorContainerClass,
  supervisorHeaderClass,
  supervisorFixedHeaderHeightClass,
  type SupervisorContainerWidth,
} from "../../lib/supervisor-layout";

interface SupervisorPageHeaderProps {
  title: string;
  width?: SupervisorContainerWidth;
  sticky?: boolean;
  surface?: "primary" | "secondary" | "base";
  align?: "left" | "center";
  actions?: ReactNode;
  children?: ReactNode;
}

export function SupervisorPageHeader({
  title,
  width = "wide",
  sticky = false,
  surface = "primary",
  align = "left",
  actions,
  children,
}: SupervisorPageHeaderProps) {
  const centered = align === "center";

  return (
    <div className={supervisorHeaderClass({ sticky, surface })}>
      <div className={cx(
        supervisorContainerClass(width),
        supervisorFixedHeaderHeightClass,
        "flex items-center"
      )}>
        <div className={cx(centered ? "text-center w-full" : "flex items-center justify-between gap-4 w-full")}>
          <div className={cx("min-w-0", !centered && "flex-1")}>
            <h1 className="text-lg font-semibold text-content-primary">{title}</h1>
          </div>
          {!centered && actions ? <div className="shrink-0">{actions}</div> : null}
        </div>

        {centered && actions ? (
          <div className="mt-4 flex justify-center">{actions}</div>
        ) : null}

        {children ? (
          <div className={cx("mt-4", centered && "mx-auto w-full")}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}
