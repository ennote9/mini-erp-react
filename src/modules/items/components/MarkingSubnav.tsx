import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";

const CHILD_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
    isActive ? "bg-muted/80 text-foreground" : "hover:bg-muted/50 hover:text-foreground",
  );

const MARKING_CHILDREN = [
  { to: "/items/marking-import", labelKey: "items.subnav.markingImportShort" as const },
  { to: "/items/marking-reconciliation", labelKey: "items.subnav.markingConfirmationShort" as const },
  { to: "/items/marking-traceability", labelKey: "items.subnav.markingTraceabilityShort" as const },
  { to: "/items/marking-sync", labelKey: "items.subnav.markingSyncShort" as const },
] as const;

/**
 * Second-row marking links (import, confirmation, traceability, sync).
 * Shown from {@link ItemsSubnav} when the route is under `/items/marking-`.
 */
export function MarkingSubnav() {
  const { t } = useTranslation();

  return (
    <nav
      className="flex flex-wrap gap-1 border-t border-border/50 pt-1.5"
      aria-label={t("items.subnav.marking")}
    >
      {MARKING_CHILDREN.map((item) => (
        <NavLink key={item.to} to={item.to} end className={CHILD_LINK_CLASS}>
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
