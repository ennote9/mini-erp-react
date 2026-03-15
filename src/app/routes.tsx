import { Routes, Route } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { DashboardPage } from "../modules/dashboard";
import { ItemsListPage, ItemPage } from "../modules/items";
import { SuppliersListPage, SupplierPage } from "../modules/suppliers";
import { CustomersListPage, CustomerPage } from "../modules/customers";
import { WarehousesListPage, WarehousePage } from "../modules/warehouses";
import {
  PurchaseOrdersListPage,
  PurchaseOrderPage,
} from "../modules/purchase-orders";
import { ReceiptsListPage, ReceiptPage } from "../modules/receipts";
import {
  SalesOrdersListPage,
  SalesOrderPage,
} from "../modules/sales-orders";
import { ShipmentsListPage, ShipmentPage } from "../modules/shipments";
import { StockBalancesListPage } from "../modules/stock-balances";
import { StockMovementsListPage } from "../modules/stock-movements";

/**
 * Route tree: shell layout with nested page routes.
 * Minimum required: dashboard, items list, purchase orders list.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="items" element={<ItemsListPage />} />
        <Route path="items/:id" element={<ItemPage />} />
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/:id" element={<SupplierPage />} />
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/:id" element={<CustomerPage />} />
        <Route path="warehouses" element={<WarehousesListPage />} />
        <Route path="warehouses/:id" element={<WarehousePage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersListPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderPage />} />
        <Route path="receipts" element={<ReceiptsListPage />} />
        <Route path="receipts/:id" element={<ReceiptPage />} />
        <Route path="sales-orders" element={<SalesOrdersListPage />} />
        <Route path="sales-orders/:id" element={<SalesOrderPage />} />
        <Route path="shipments" element={<ShipmentsListPage />} />
        <Route path="shipments/:id" element={<ShipmentPage />} />
        <Route path="stock-balances" element={<StockBalancesListPage />} />
        <Route path="stock-movements" element={<StockMovementsListPage />} />
      </Route>
    </Routes>
  );
}
