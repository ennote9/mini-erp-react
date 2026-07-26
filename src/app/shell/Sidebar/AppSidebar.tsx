import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  Package,
  PackageCheck,
  Receipt,
  Scale,
  ScanBarcode,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Route,
  UserCog,
  Users,
  Warehouse,
  Settings,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
  /** Extra path prefixes that should highlight this link (exact match or `prefix/`). */
  activePathPrefixes?: readonly string[];
};

const nav: ReadonlyArray<{ groupKey: string; links: readonly NavLinkItem[] }> = [
  {
    groupKey: "shell.masterData",
    links: [
      {
        labelKey: "shell.nav.items",
        to: "/items",
        icon: Package,
        activePathPrefixes: ["/barcodes", "/brands", "/categories"] as const,
      },
      { labelKey: "shell.nav.suppliers", to: "/suppliers", icon: Truck },
      { labelKey: "shell.nav.customers", to: "/customers", icon: Users },
      { labelKey: "shell.nav.warehouses", to: "/warehouses", icon: Warehouse },
      { labelKey: "shell.nav.carriers", to: "/carriers", icon: Route },
      { labelKey: "shell.nav.employees", to: "/employees", icon: UserCog },
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
      { labelKey: "shell.nav.markdownJournal", to: "/markdown-journal", icon: ScanBarcode },
    ],
  },
  {
    groupKey: "shell.application",
    links: [{ labelKey: "shell.settings", to: "/settings", icon: Settings }],
  },
];

function SidebarNavLink({
  to,
  label,
  end,
  icon: Icon,
  activePathPrefixes,
}: {
  to: string;
  label: string;
  end?: boolean;
  icon: ComponentType<{ className?: string }>;
  activePathPrefixes?: readonly string[];
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const defaultActiveBase =
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  const prefixActive =
    activePathPrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;
  const isActive = defaultActiveBase || prefixActive;

  return (
    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
      <NavLink to={to} end={end ?? to === "/"}>
        <Icon className="size-4 shrink-0" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
      </NavLink>
    </SidebarMenuButton>
  );
}

/**
 * App sidebar using shadcn Sidebar primitives: workspace-style header, nav groups, inset-ready shell.
 */
function workspaceModeLabel(t: (k: string) => string, mode: WorkspaceModeId): string {
  return t(`workspace.mode.${mode}.label`);
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { open, toggleSidebar } = useSidebar();
  const mode = settings.general.workspaceMode;
  const overrides = settings.general.profileOverrides;
  const modeLabel = workspaceModeLabel(t, mode);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu className="flex-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              size="lg"
              tooltip={open ? t("app.name") : t("shell.a11y.toggleSidebar")}
              aria-label={open ? t("shell.a11y.toggleSidebar") : t("shell.a11y.toggleSidebar")}
              onClick={toggleSidebar}
              className="cursor-pointer rounded-lg border border-transparent bg-sidebar-accent/20 hover:border-sidebar-border/70 hover:bg-sidebar-accent/65 focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent/85 active:scale-[0.99] data-[state=open]:bg-sidebar-accent/70 data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
            >
              <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm ring-1 ring-sidebar-border/45 transition-transform duration-200 group-hover/menu-button:scale-[1.02] group-active/menu-button:scale-[0.99] group-data-[state=collapsed]:size-8">
                <LayoutDashboard className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 gap-px text-left group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[0.8125rem] font-semibold leading-tight text-sidebar-foreground">
                  {t("app.name")}
                </span>
                <span
                  className="truncate text-[0.6875rem] leading-tight text-sidebar-foreground/70"
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
                      <SidebarNavLink
                        to={link.to}
                        label={t(link.labelKey)}
                        icon={link.icon}
                        activePathPrefixes={link.activePathPrefixes}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
