import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";

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

/**
 * Page top bar: page title. Breadcrumb and actions added later.
 */
export function PageTopBar() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  return (
    <header className="app-topbar flex items-center gap-2">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <h1 className="app-topbar__title min-w-0 flex-1 truncate">{title}</h1>
    </header>
  );
}
