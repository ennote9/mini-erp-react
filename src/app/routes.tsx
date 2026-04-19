import { Routes, Route } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { DashboardPage } from "../modules/dashboard";
import {
  ItemsListPage,
  ItemPage,
  ItemsLabelDataPage,
  ItemsMarkingImportPage,
  ItemsMarkingReconciliationPage,
  ItemsMarkingTraceabilityPage,
  ItemsMarkingSyncConsolePage,
  MarkingProviderSettingsPage,
} from "../modules/items";
import { BrandsListPage, BrandPage } from "../modules/brands";
import { CategoriesListPage, CategoryPage } from "../modules/categories";
import { SuppliersListPage, SupplierPage } from "../modules/suppliers";
import { CustomersListPage, CustomerPage } from "../modules/customers";
import { WarehousesListPage, WarehousePage } from "../modules/warehouses";
import { CarriersListPage, CarrierPage } from "../modules/carriers";
import { EmployeesListPage, EmployeePage } from "../modules/employees";
import {
  PurchaseOrdersListPage,
  PurchaseOrderPage,
} from "../modules/purchase-orders";
import { ReceiptsListPage, ReceiptPage } from "../modules/receipts";
import {
  SalesOrdersListPage,
  SalesOrderPage,
  SalesOrderPreliminaryDocumentPage,
  SalesOrderCustomerDocumentPage,
  SalesOrderCustomerInvoicePage,
} from "../modules/sales-orders";
import {
  ShipmentsListPage,
  ShipmentPage,
  ShipmentDeliverySheetPage,
  ShipmentCustomerDocumentPage,
} from "../modules/shipments";
import { StockBalanceDetailPage, StockBalancesListPage } from "../modules/stock-balances";
import { StockMovementsListPage } from "../modules/stock-movements";
import { SettingsPage } from "../modules/settings";
import { MarkdownCreatePage, MarkdownJournalPage } from "../modules/markdown-journal";
import { BarcodeRegistryPage } from "../modules/barcode-registry";
import {
  LabelTemplateEditorPage,
  LabelsBatchPage,
  LabelsListPage,
  LabelsOperationsPage,
  LabelsStationPage,
  LabelsWorkspacePage,
} from "../modules/labels";

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
        <Route path="items/label-data" element={<ItemsLabelDataPage />} />
        <Route path="items/marking-import" element={<ItemsMarkingImportPage />} />
        <Route path="items/marking-reconciliation" element={<ItemsMarkingReconciliationPage />} />
        <Route path="items/marking-traceability" element={<ItemsMarkingTraceabilityPage />} />
        <Route path="items/marking-sync" element={<ItemsMarkingSyncConsolePage />} />
        <Route path="barcodes" element={<BarcodeRegistryPage />} />
        <Route path="labels/templates/:id" element={<LabelTemplateEditorPage />} />
        <Route path="labels/workspace" element={<LabelsWorkspacePage />} />
        <Route path="labels/station" element={<LabelsStationPage />} />
        <Route path="labels/batch" element={<LabelsBatchPage />} />
        <Route path="labels/operations" element={<LabelsOperationsPage />} />
        <Route path="labels" element={<LabelsListPage />} />
        <Route path="items/:id" element={<ItemPage />} />
        <Route path="brands" element={<BrandsListPage />} />
        <Route path="brands/:id" element={<BrandPage />} />
        <Route path="categories" element={<CategoriesListPage />} />
        <Route path="categories/:id" element={<CategoryPage />} />
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/:id" element={<SupplierPage />} />
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/:id" element={<CustomerPage />} />
        <Route path="warehouses" element={<WarehousesListPage />} />
        <Route path="warehouses/:id" element={<WarehousePage />} />
        <Route path="carriers" element={<CarriersListPage />} />
        <Route path="carriers/:id" element={<CarrierPage />} />
        <Route path="employees" element={<EmployeesListPage />} />
        <Route path="employees/new" element={<EmployeePage />} />
        <Route path="employees/:id" element={<EmployeePage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersListPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderPage />} />
        <Route path="receipts" element={<ReceiptsListPage />} />
        <Route path="receipts/:id" element={<ReceiptPage />} />
        <Route path="sales-orders" element={<SalesOrdersListPage />} />
        <Route path="sales-orders/:id/preliminary-document" element={<SalesOrderPreliminaryDocumentPage />} />
        <Route path="sales-orders/:id/customer-document" element={<SalesOrderCustomerDocumentPage />} />
        <Route path="sales-orders/:id/customer-invoice" element={<SalesOrderCustomerInvoicePage />} />
        <Route path="sales-orders/:id" element={<SalesOrderPage />} />
        <Route path="shipments" element={<ShipmentsListPage />} />
        <Route path="shipments/:id/delivery-sheet" element={<ShipmentDeliverySheetPage />} />
        <Route path="shipments/:id/customer-document" element={<ShipmentCustomerDocumentPage />} />
        <Route path="shipments/:id" element={<ShipmentPage />} />
        <Route path="stock-balances" element={<StockBalancesListPage />} />
        <Route path="stock-balances/:id" element={<StockBalanceDetailPage />} />
        <Route path="stock-movements" element={<StockMovementsListPage />} />
        <Route path="markdown-journal" element={<MarkdownJournalPage />} />
        <Route path="markdown-journal/new" element={<MarkdownCreatePage />} />
        <Route path="markdown-journal/journals/:id" element={<MarkdownCreatePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/marking-provider" element={<MarkingProviderSettingsPage />} />
      </Route>
    </Routes>
  );
}
