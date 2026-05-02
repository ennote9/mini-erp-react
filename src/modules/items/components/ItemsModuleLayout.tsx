import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ItemsSubnav } from "./ItemsSubnav";

type Props = {
  children: ReactNode;
  /** Page-level layout classes (e.g. doc-page, max-width, padding, vertical rhythm). */
  className?: string;
};

/**
 * Shared shell for Items list, label data, and marking operational pages.
 * Owns placement of {@link ItemsSubnav} above page content; subnav sticks within `.app-page-content` scroll.
 */
export function ItemsModuleLayout({ children, className }: Props) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "sticky top-0 z-20 min-w-0",
          "bg-[var(--app-shell-bg)]",
        )}
      >
        <ItemsSubnav />
      </div>
      {children}
    </div>
  );
}
