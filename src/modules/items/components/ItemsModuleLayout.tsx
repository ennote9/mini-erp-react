import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ItemsSubnav } from "./ItemsSubnav";

export type ItemsModuleContentVariant = "full" | "wide" | "narrow";

type Props = {
  children: ReactNode;
  /** Classes on the outer root (e.g. `doc-page`, flex, height). Legacy: may include `mx-auto` / `max-w-*` for the whole module. */
  className?: string;
  /**
   * When set, `children` are wrapped in a variant width container; sticky nav uses the full width of the outer root only.
   * Omit to keep legacy behavior (single outer box for nav + children).
   */
  contentVariant?: ItemsModuleContentVariant;
  /** Extra classes on the content wrapper (e.g. `space-y-*`, `p-*`). */
  contentClassName?: string;
};

const CONTENT_VARIANT_CLASS: Record<ItemsModuleContentVariant, string> = {
  full: "w-full min-w-0",
  wide: "mx-auto w-full min-w-0 max-w-[1600px]",
  narrow: "mx-auto w-full min-w-0 max-w-6xl",
};

/**
 * Shared shell for Items list and label data pages.
 * Owns placement of {@link ItemsSubnav} above page content; subnav sticks within `.app-page-content` scroll.
 */
export function ItemsModuleLayout({ children, className, contentVariant, contentClassName }: Props) {
  const stickyChrome = (
    <div
      className={cn(
        "sticky top-0 z-20 min-w-0",
        "bg-[var(--app-shell-bg)]",
      )}
    >
      <ItemsSubnav />
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
