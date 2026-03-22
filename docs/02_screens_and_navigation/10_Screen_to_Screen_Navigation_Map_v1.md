    # Screen-to-Screen Navigation Map v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the navigation routes between screens.

## Navigation categories

### Sidebar navigation
Module-to-module navigation.

### List -> Object navigation
Open a specific record from a list.

### Process navigation
Create next-step documents from their source documents.

## Entry points

Primary entry points:
- Dashboard
- Sidebar

## Master data navigation

### Items
- Sidebar -> Items
- Items list -> row click -> Item page
- Items list -> New -> New Item page
- Item page -> navigate to filtered **Stock Balances** / **Stock Movements** (item scope) via in-page actions

### Brands
- Sidebar -> Brands *(when visible for workspace)*
- Brands list -> Brand page
- Brand page -> Stock Balances / Movements with brand filter (when offered)

### Categories
- Sidebar -> Categories *(when visible for workspace)*
- Categories list -> Category page
- Category page -> Stock Balances / Movements with category filter (when offered)

### Suppliers
- Sidebar -> Suppliers
- Suppliers list -> row click -> Supplier page
- Suppliers list -> New -> New Supplier page

### Customers
- Sidebar -> Customers
- Customers list -> row click -> Customer page
- Customers list -> New -> New Customer page

### Warehouses
- Sidebar -> Warehouses
- Warehouses list -> row click -> Warehouse page
- Warehouses list -> New -> New Warehouse page

### Carriers
- Sidebar -> Carriers
- Carriers list -> Carrier page
- Carrier page -> related Customers / Sales Orders / Shipments rows *(operational drill-down)*

## Settings

- Sidebar footer -> Settings
- Settings -> switch sections (workspace profile, general, documents, inventory, commercial, data & audit) per workspace mode

## Purchase navigation

### Purchase Orders
- Sidebar -> Purchase Orders
- Dashboard latest PO -> Purchase Order page
- Purchase Orders list -> row click -> Purchase Order page
- Purchase Orders list -> New -> New Purchase Order page

### Purchase Order page
- Draft -> save / confirm / cancel
- Confirmed -> Create Receipt
- Confirmed PO -> Create Receipt -> Receipt page

### Receipts
- Sidebar -> Receipts
- Receipts list -> row click -> Receipt page
- no New button in Receipts list

## Sales navigation

### Sales Orders
- Sidebar -> Sales Orders
- Dashboard latest SO -> Sales Order page
- Sales Orders list -> row click -> Sales Order page
- Sales Orders list -> New -> New Sales Order page

### Sales Order page
- Draft -> save / confirm / cancel
- Confirmed -> Create Shipment *(may require reservations first — settings)*
- Confirmed SO -> Create Shipment -> Shipment page
- Sales Order -> **Preliminary customer document** (dedicated route: `/sales-orders/:id/customer-document`)

### Shipments
- Sidebar -> Shipments
- Shipments list -> row click -> Shipment page
- no New button in Shipments list

### Shipment page
- Shipment -> **Delivery sheet** (`/shipments/:id/delivery-sheet`)
- Shipment -> **Final customer document** (`/shipments/:id/customer-document`) — content for **posted** shipments in customer-facing view

## Inventory navigation

### Stock Balances
- Sidebar -> Stock Balances
- Dashboard stock block -> Stock Balances
- Master / item pages may open balances with **query filters** (e.g. `?itemId=`, `?brandId=`, `?categoryId=`, `?warehouseId=`)

### Stock Movements
- Sidebar -> Stock Movements *(if visible for workspace)*
- Dashboard latest movements block -> Stock Movements
- Source Document link -> Receipt page or Shipment page
- Query filters same family as stock balances

## Forbidden navigation paths

Not allowed in MVP:
- New Receipt from Receipts list
- New Shipment from Shipments list
- Create Receipt from Draft Purchase Order
- Create Shipment from Draft Sales Order
- Post directly from list pages
- Edit non-editable documents through alternative routes

Additional guardrails in current app (examples):
- Second draft receipt/shipment for same planning doc may be blocked by **settings**
- Create shipment may be blocked until lines are **fully reserved** (Advanced setting)

## Main end-to-end route

### Purchase side
Dashboard / Sidebar -> Items / Suppliers / Warehouses -> Purchase Orders -> New Purchase Order -> Purchase Order page -> Create Receipt -> Receipt page -> Stock Balances -> Stock Movements

### Sales side
Dashboard / Sidebar -> Customers -> Sales Orders -> New Sales Order -> Sales Order page -> Create Shipment -> Shipment page -> Stock Balances -> Stock Movements
