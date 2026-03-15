import { NavLink } from "react-router-dom";
import { SidebarGroup } from "./SidebarGroup";

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

function NavLinkItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "sidebar-link" + (isActive ? " sidebar-link--active" : "")
      }
      end={to === "/"}
    >
      {label}
    </NavLink>
  );
}

/**
 * Sidebar: module groups and links. Dark, vertical, desktop-first.
 */
export function Sidebar() {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <NavLinkItem to="/" label="Dashboard" />
        {nav.filter((x) => "links" in x).map((group) => (
          <SidebarGroup key={group.label} title={group.label}>
            {group.links.map((link) => (
              <NavLinkItem key={link.to} to={link.to} label={link.label} />
            ))}
          </SidebarGroup>
        ))}
      </nav>
    </aside>
  );
}
