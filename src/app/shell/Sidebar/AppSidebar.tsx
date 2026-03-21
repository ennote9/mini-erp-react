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
import { getEffectiveWorkspaceFeatureEnabled, WORKSPACE_MODE_OPTIONS } from "@/shared/workspace";

type NavLinkItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  feature?: "navBrandsCategories" | "navStockMovements";
};

const nav: ReadonlyArray<{ label: string; links: readonly NavLinkItem[] }> = [
  {
    label: "Master Data",
    links: [
      { label: "Items", to: "/items", icon: Package },
      { label: "Brands", to: "/brands", icon: Tag, feature: "navBrandsCategories" as const },
      { label: "Categories", to: "/categories", icon: FolderOpen, feature: "navBrandsCategories" as const },
      { label: "Suppliers", to: "/suppliers", icon: Truck },
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Warehouses", to: "/warehouses", icon: Warehouse },
    ],
  },
  {
    label: "Purchasing",
    links: [
      { label: "Purchase Orders", to: "/purchase-orders", icon: ShoppingCart },
      { label: "Receipts", to: "/receipts", icon: Receipt },
    ],
  },
  {
    label: "Sales",
    links: [
      { label: "Sales Orders", to: "/sales-orders", icon: ShoppingBag },
      { label: "Shipments", to: "/shipments", icon: PackageCheck },
    ],
  },
  {
    label: "Inventory",
    links: [
      { label: "Stock Balances", to: "/stock-balances", icon: Scale },
      { label: "Stock Movements", to: "/stock-movements", icon: ArrowLeftRight, feature: "navStockMovements" },
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
export function AppSidebar() {
  const { settings } = useSettings();
  const mode = settings.general.workspaceMode;
  const overrides = settings.general.profileOverrides;
  const modeLabel = WORKSPACE_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;

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
                <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">Mini ERP</span>
                <span className="truncate text-xs leading-tight text-sidebar-foreground/70" title="Current workspace complexity profile">
                  {modeLabel} workspace
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavLink to="/" label="Dashboard" end icon={LayoutDashboard} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {nav.filter((x) => "links" in x).map((group) => {
          const links = group.links.filter((link) => {
            if (link.feature === "navBrandsCategories")
              return getEffectiveWorkspaceFeatureEnabled(mode, overrides, "navBrandsCategories");
            if (link.feature === "navStockMovements")
              return getEffectiveWorkspaceFeatureEnabled(mode, overrides, "navStockMovements");
            return true;
          });
          if (links.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarNavLink to={link.to} label={link.label} icon={link.icon} />
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
                <span className="truncate text-sm font-medium leading-tight text-sidebar-foreground">Account</span>
                <span className="truncate text-xs leading-tight text-sidebar-foreground/60">Signed in</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
