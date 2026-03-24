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
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Warehouse,
  Route,
} from "lucide-react";
import { useTranslation } from "@/shared/i18n";

const PAGE_TITLES: Record<string, string> = {
  "/": "routes.dashboard",
  "/items": "routes.items",
  "/brands": "routes.brands",
  "/categories": "routes.categories",
  "/suppliers": "routes.suppliers",
  "/customers": "routes.customers",
  "/warehouses": "routes.warehouses",
  "/carriers": "routes.carriers",
  "/purchase-orders": "routes.purchaseOrders",
  "/receipts": "routes.receipts",
  "/sales-orders": "routes.salesOrders",
  "/shipments": "routes.shipments",
  "/stock-balances": "routes.stockBalances",
  "/stock-movements": "routes.stockMovements",
  "/settings": "routes.settings",
};

function getPageTitleKey(pathname: string): string {
  if (pathname.match(/^\/items\/[^/]+$/)) return "routes.item";
  if (pathname.match(/^\/brands\/[^/]+$/)) return "routes.brand";
  if (pathname.match(/^\/categories\/[^/]+$/)) return "routes.category";
  if (pathname.match(/^\/suppliers\/[^/]+$/)) return "routes.supplier";
  if (pathname.match(/^\/customers\/[^/]+$/)) return "routes.customer";
  if (pathname.match(/^\/warehouses\/[^/]+$/)) return "routes.warehouse";
  if (pathname.match(/^\/carriers\/[^/]+$/)) return "routes.carrier";
  if (pathname.match(/^\/purchase-orders\/[^/]+$/)) return "routes.purchaseOrder";
  if (pathname.match(/^\/receipts\/[^/]+$/)) return "routes.receipt";
  if (pathname.match(/^\/sales-orders\/[^/]+\/preliminary-document$/))
    return "routes.salesOrderPreliminaryDocument";
  if (pathname.match(/^\/sales-orders\/[^/]+\/customer-document$/))
    return "routes.salesOrderCustomerDocument";
  if (pathname.match(/^\/sales-orders\/[^/]+\/customer-invoice$/))
    return "routes.salesOrderCustomerInvoice";
  if (pathname.match(/^\/sales-orders\/[^/]+$/)) return "routes.salesOrder";
  if (pathname.match(/^\/shipments\/[^/]+\/delivery-sheet$/))
    return "routes.shipmentDeliverySheet";
  if (pathname.match(/^\/shipments\/[^/]+\/customer-document$/))
    return "routes.shipmentCustomerDocument";
  if (pathname.match(/^\/shipments\/[^/]+$/)) return "routes.shipment";
  return PAGE_TITLES[pathname] ?? "routes.fallback";
}

function getPageIcon(
  pathname: string,
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
  if (pathname === "/carriers" || pathname.match(/^\/carriers\/[^/]+$/)) return Route;
  if (
    pathname === "/purchase-orders" ||
    pathname.match(/^\/purchase-orders\/[^/]+$/)
  )
    return ShoppingCart;
  if (pathname === "/receipts" || pathname.match(/^\/receipts\/[^/]+$/))
    return Receipt;
  if (
    pathname === "/sales-orders" ||
    pathname.match(/^\/sales-orders\/[^/]+$/) ||
    pathname.match(/^\/sales-orders\/[^/]+\/preliminary-document$/) ||
    pathname.match(/^\/sales-orders\/[^/]+\/customer-document$/) ||
    pathname.match(/^\/sales-orders\/[^/]+\/customer-invoice$/)
  )
    return ShoppingBag;
  if (
    pathname === "/shipments" ||
    pathname.match(/^\/shipments\/[^/]+$/) ||
    pathname.match(/^\/shipments\/[^/]+\/delivery-sheet$/) ||
    pathname.match(/^\/shipments\/[^/]+\/customer-document$/)
  )
    return PackageCheck;
  if (pathname === "/stock-balances") return Scale;
  if (pathname === "/stock-movements") return ArrowLeftRight;
  if (pathname === "/settings") return Settings;
  return null;
}

/**
 * Page top bar: page title. Breadcrumb and actions added later.
 */
export function PageTopBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const title = t(getPageTitleKey(location.pathname));
  const Icon = getPageIcon(location.pathname);
  return (
    <header className="app-topbar flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <h1 className="app-topbar__title min-w-0 flex-1 truncate">{title}</h1>
    </header>
  );
}
