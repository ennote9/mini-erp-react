import type { ComponentType } from "react";
import { useLocation } from "react-router-dom";
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
  Users,
  Warehouse,
} from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/items": "Items",
  "/brands": "Brands",
  "/categories": "Categories",
  "/suppliers": "Suppliers",
  "/customers": "Customers",
  "/warehouses": "Warehouses",
  "/purchase-orders": "Purchase Orders",
  "/receipts": "Receipts",
  "/sales-orders": "Sales Orders",
  "/shipments": "Shipments",
  "/stock-balances": "Stock Balances",
  "/stock-movements": "Stock Movements",
};

function getPageTitle(pathname: string): string {
  if (pathname.match(/^\/items\/[^/]+$/)) return "Item";
  if (pathname.match(/^\/brands\/[^/]+$/)) return "Brand";
  if (pathname.match(/^\/categories\/[^/]+$/)) return "Category";
  if (pathname.match(/^\/suppliers\/[^/]+$/)) return "Supplier";
  if (pathname.match(/^\/customers\/[^/]+$/)) return "Customer";
  if (pathname.match(/^\/warehouses\/[^/]+$/)) return "Warehouse";
  if (pathname.match(/^\/purchase-orders\/[^/]+$/)) return "Purchase Order";
  if (pathname.match(/^\/receipts\/[^/]+$/)) return "Receipt";
  if (pathname.match(/^\/sales-orders\/[^/]+$/)) return "Sales Order";
  if (pathname.match(/^\/shipments\/[^/]+$/)) return "Shipment";
  return PAGE_TITLES[pathname] ?? "Mini ERP";
}

function getPageIcon(
  pathname: string
): ComponentType<{ className?: string }> | null {
  if (pathname === "/") return LayoutDashboard;
  if (pathname === "/items" || pathname.match(/^\/items\/[^/]+$/)) return Package;
  if (pathname === "/brands" || pathname.match(/^\/brands\/[^/]+$/)) return Tag;
  if (pathname === "/categories" || pathname.match(/^\/categories\/[^/]+$/))
    return FolderOpen;
  if (pathname === "/suppliers" || pathname.match(/^\/suppliers\/[^/]+$/))
    return Truck;
  if (pathname === "/customers" || pathname.match(/^\/customers\/[^/]+$/))
    return Users;
  if (pathname === "/warehouses" || pathname.match(/^\/warehouses\/[^/]+$/))
    return Warehouse;
  if (
    pathname === "/purchase-orders" ||
    pathname.match(/^\/purchase-orders\/[^/]+$/)
  )
    return ShoppingCart;
  if (pathname === "/receipts" || pathname.match(/^\/receipts\/[^/]+$/))
    return Receipt;
  if (pathname === "/sales-orders" || pathname.match(/^\/sales-orders\/[^/]+$/))
    return ShoppingBag;
  if (pathname === "/shipments" || pathname.match(/^\/shipments\/[^/]+$/))
    return PackageCheck;
  if (pathname === "/stock-balances") return Scale;
  if (pathname === "/stock-movements") return ArrowLeftRight;
  return null;
}

/**
 * Page top bar: page title. Breadcrumb and actions added later.
 */
export function PageTopBar() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  const Icon = getPageIcon(location.pathname);
  return (
    <header className="app-topbar flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <h1 className="app-topbar__title min-w-0 flex-1 truncate">{title}</h1>
    </header>
  );
}
