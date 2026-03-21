import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  FolderOpen,
  LayoutDashboard,
  Package,
  PackageCheck,
  Receipt,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Users,
  Warehouse,
  Settings,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSettings } from "@/shared/settings";
import { useTranslation } from "@/shared/i18n";
import { getEffectiveWorkspaceFeatureEnabled } from "@/shared/workspace";
import type { WorkspaceModeId } from "@/shared/settings";

type NavLinkItem = {
  labelKey: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  feature?: "navBrandsCategories" | "navStockMovements";
};

const nav: ReadonlyArray<{ groupKey: string; links: readonly NavLinkItem[] }> = [
  {
    groupKey: "shell.masterData",
    links: [
      { labelKey: "shell.nav.items", to: "/items", icon: Package },
      { labelKey: "shell.nav.brands", to: "/brands", icon: Tag, feature: "navBrandsCategories" as const },
      { labelKey: "shell.nav.categories", to: "/categories", icon: FolderOpen, feature: "navBrandsCategories" as const },
      { labelKey: "shell.nav.suppliers", to: "/suppliers", icon: Truck },
      { labelKey: "shell.nav.customers", to: "/customers", icon: Users },
      { labelKey: "shell.nav.warehouses", to: "/warehouses", icon: Warehouse },
    ],
  },
  {
    groupKey: "shell.purchasing",
    links: [
      { labelKey: "shell.nav.purchaseOrders", to: "/purchase-orders", icon: ShoppingCart },
      { labelKey: "shell.nav.receipts", to: "/receipts", icon: Receipt },
    ],
  },
  {
    groupKey: "shell.sales",
    links: [
      { labelKey: "shell.nav.salesOrders", to: "/sales-orders", icon: ShoppingBag },
      { labelKey: "shell.nav.shipments", to: "/shipments", icon: PackageCheck },
    ],
  },
  {
    groupKey: "shell.inventory",
    links: [
      { labelKey: "shell.nav.stockBalances", to: "/stock-balances", icon: Scale },
      { labelKey: "shell.nav.stockMovements", to: "/stock-movements", icon: ArrowLeftRight, feature: "navStockMovements" },
    ],
  },
];

function SidebarNavLink({
  to,
  label,
  end,
  icon: Icon,
}: {
  to: string;
  label: string;
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  const location = useLocation();
  const isActive =
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <NavLink to={to} end={end ?? to === "/"}>
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </NavLink>
    </SidebarMenuButton>
  );
}

/**
 * App sidebar using shadcn Sidebar primitives. Refined to match official docs:
 * workspace-style header, nav with icons, footer block, inset-ready shell.
 */
function workspaceModeLabel(t: (k: string) => string, mode: WorkspaceModeId): string {
  return t(`workspace.mode.${mode}.label`);
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const mode = settings.general.workspaceMode;
  const overrides = settings.general.profileOverrides;
  const modeLabel = workspaceModeLabel(t, mode);

  return (
    <Sidebar collapsible="none" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="rounded-lg hover:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm ring-1 ring-sidebar-border/50">
                <LayoutDashboard className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 gap-0.5 text-left">
                <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                  {t("app.name")}
                </span>
                <span
                  className="truncate text-xs leading-tight text-sidebar-foreground/70"
                  title={t("workspace.mode.advanced.hint")}
                >
                  {modeLabel} {t("shell.workspaceSuffix")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("shell.dashboard")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavLink to="/" label={t("shell.dashboard")} end icon={LayoutDashboard} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {nav.map((group) => {
          const links = group.links.filter((link) => {
            if (link.feature === "navBrandsCategories")
              return getEffectiveWorkspaceFeatureEnabled(mode, overrides, "navBrandsCategories");
            if (link.feature === "navStockMovements")
              return getEffectiveWorkspaceFeatureEnabled(mode, overrides, "navStockMovements");
            return true;
          });
          if (links.length === 0) return null;
          return (
            <SidebarGroup key={group.groupKey}>
              <SidebarGroupLabel>{t(group.groupKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarNavLink to={link.to} label={t(link.labelKey)} icon={link.icon} />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarNavLink to="/settings" label="Settings" icon={Settings} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 hover:bg-sidebar-accent/70 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar/80 text-sidebar-foreground">
                <User className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 gap-0.5 text-left">
                <span className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
                  {t("shell.account")}
                </span>
                <span className="truncate text-xs leading-tight text-sidebar-foreground/60">
                  {t("shell.signedIn")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
