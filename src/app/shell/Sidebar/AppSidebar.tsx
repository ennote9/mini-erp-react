import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const nav = [
  { label: "Dashboard", to: "/" },
  {
    label: "Master Data",
    links: [
      { label: "Items", to: "/items" },
      { label: "Suppliers", to: "/suppliers" },
      { label: "Customers", to: "/customers" },
      { label: "Warehouses", to: "/warehouses" },
    ],
  },
  {
    label: "Purchasing",
    links: [
      { label: "Purchase Orders", to: "/purchase-orders" },
      { label: "Receipts", to: "/receipts" },
    ],
  },
  {
    label: "Sales",
    links: [
      { label: "Sales Orders", to: "/sales-orders" },
      { label: "Shipments", to: "/shipments" },
    ],
  },
  {
    label: "Inventory",
    links: [
      { label: "Stock Balances", to: "/stock-balances" },
      { label: "Stock Movements", to: "/stock-movements" },
    ],
  },
] as const;

function SidebarNavLink({
  to,
  label,
  end,
}: {
  to: string;
  label: string;
  end?: boolean;
}) {
  const location = useLocation();
  const isActive =
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <NavLink to={to} end={end ?? to === "/"}>
        {label}
      </NavLink>
    </SidebarMenuButton>
  );
}

/**
 * App sidebar using shadcn Sidebar primitives. Same nav structure and routes as before.
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="none" variant="sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavLink to="/" label="Dashboard" end />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {nav.filter((x) => "links" in x).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.links.map((link) => (
                  <SidebarMenuItem key={link.to}>
                    <SidebarNavLink to={link.to} label={link.label} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
