import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";

const NAV_ITEMS = [
  { to: "/labels", labelKey: "labels.nav.templates", end: true as const },
  { to: "/labels/workspace", labelKey: "labels.nav.workspace", end: false as const },
  { to: "/labels/station", labelKey: "labels.nav.station", end: false as const },
  { to: "/labels/batch", labelKey: "labels.nav.batch", end: false as const },
  { to: "/labels/operations", labelKey: "labels.nav.operations", end: false as const },
];

/**
 * In-section navigation for the labels module (templates / workspace / operations).
 */
export function LabelsSubnav() {
  const { t } = useTranslation();

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border/80 pb-2"
      aria-label={t("shell.nav.labels")}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
