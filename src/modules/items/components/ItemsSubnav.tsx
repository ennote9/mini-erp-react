import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";
import { useSettings } from "@/shared/settings";
import { getEffectiveWorkspaceFeatureEnabled } from "@/shared/workspace";

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

function isReferencesSectionActive(pathname: string): boolean {
  return (
    pathname === "/barcodes" ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/categories")
  );
}

/**
 * Two-level in-section navigation for Items list, item references, and label data.
 */
export function ItemsSubnav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const brandsCategoriesNavEnabled = getEffectiveWorkspaceFeatureEnabled(
    settings.general.workspaceMode,
    settings.general.profileOverrides,
    "navBrandsCategories",
  );

  const isReferencesSection = isReferencesSectionActive(pathname);

  return (
    <div className="space-y-1.5 border-b border-border/80 pb-2">
      <nav className="flex flex-wrap gap-1" aria-label={t("shell.nav.items")}>
        <NavLink to="/items" end className={TOP_LINK_CLASS}>
          {t("routes.items")}
        </NavLink>
        <NavLink
          to="/barcodes"
          className={({ isActive }) =>
            TOP_LINK_CLASS({
              isActive: isActive || isReferencesSectionActive(pathname),
            })
          }
        >
          {t("items.subnav.itemReferences")}
        </NavLink>
        <NavLink to="/items/label-data" end className={TOP_LINK_CLASS}>
          {t("master.itemsLabelData.navLink")}
        </NavLink>
      </nav>

      {isReferencesSection ? (
        <nav
          className="flex flex-wrap gap-1 border-t border-border/50 pt-1.5"
          aria-label={t("items.subnav.itemReferences")}
        >
          <NavLink to="/barcodes" end className={CHILD_LINK_CLASS}>
            {t("items.subnav.barcodesShort")}
          </NavLink>
          {brandsCategoriesNavEnabled ? (
            <>
              <NavLink to="/brands" className={CHILD_LINK_CLASS}>
                {t("items.subnav.brandsShort")}
              </NavLink>
              <NavLink to="/categories" className={CHILD_LINK_CLASS}>
                {t("items.subnav.categoriesShort")}
              </NavLink>
            </>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
