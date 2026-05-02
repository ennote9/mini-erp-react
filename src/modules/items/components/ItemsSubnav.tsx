import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";

const MARKING_PREFIX = "/items/marking-";

const TOP_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

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
 * Two-level in-section navigation for Items list, label data, and marking operational pages.
 */
export function ItemsSubnav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isMarkingSection = pathname.startsWith(MARKING_PREFIX);

  return (
    <div className="space-y-1.5 border-b border-border/80 pb-2">
      <nav className="flex flex-wrap gap-1" aria-label={t("shell.nav.items")}>
        <NavLink to="/items" end className={TOP_LINK_CLASS}>
          {t("routes.items")}
        </NavLink>
        <NavLink to="/items/label-data" end className={TOP_LINK_CLASS}>
          {t("master.itemsLabelData.navLink")}
        </NavLink>
        <NavLink
          to="/items/marking-import"
          className={({ isActive }) =>
            TOP_LINK_CLASS({
              isActive: isActive || pathname.startsWith(MARKING_PREFIX),
            })
          }
        >
          {t("items.subnav.marking")}
        </NavLink>
      </nav>

      {isMarkingSection ? (
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
      ) : null}
    </div>
  );
}
