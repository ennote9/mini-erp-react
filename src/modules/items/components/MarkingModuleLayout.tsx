import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MarkingSubnav } from "./MarkingSubnav";

export type MarkingModuleContentVariant = "full" | "wide" | "narrow";

type Props = {
  children: ReactNode;
  className?: string;
  contentVariant?: MarkingModuleContentVariant;
  contentClassName?: string;
};

const CONTENT_VARIANT_CLASS: Record<MarkingModuleContentVariant, string> = {
  full: "w-full min-w-0",
  wide: "mx-auto w-full min-w-0 max-w-[1600px]",
  narrow: "mx-auto w-full min-w-0 max-w-6xl",
};

/**
 * Shell for marking operational pages: sticky {@link MarkingSubnav} above content.
 * Subnav sticks within `.app-page-content` scroll (same pattern as {@link ItemsModuleLayout}).
 */
export function MarkingModuleLayout({ children, className, contentVariant, contentClassName }: Props) {
  const stickyChrome = (
    <div
      className={cn(
        "sticky top-0 z-20 min-w-0",
        "bg-[var(--app-shell-bg)]",
      )}
    >
      <MarkingSubnav />
    </div>
  );

  if (contentVariant == null) {
    return (
      <div className={cn("min-w-0", className)}>
        {stickyChrome}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {stickyChrome}
      <div className={cn(CONTENT_VARIANT_CLASS[contentVariant], contentClassName)}>{children}</div>
    </div>
  );
}
