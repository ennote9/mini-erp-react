    # Screens v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document lists MVP-era screens and responsibilities, **plus current additions** (2026-03-22). Authoritative **code-aligned** summary: **`01_product_core/08_Current_Product_State.md`** and **`src/app/routes.tsx`**.

## Dashboard
Purpose:
- system overview
- quick navigation
- latest activity visibility

Can:
- show document breakdown cards (PO, SO, receipts, shipments by status)
- show inventory overview (balance rows, movement rows, item counts; movements card may hide in Lite workspace)
- show recent receipts and shipments
- show quick links and operational **signals** (e.g. inactive items, draft factual docs)
- navigate to modules

Note:
- summary **updates after local data changes** without leaving the page (read-model revision subscription)

Cannot:
- create documents directly
- post or confirm documents
- edit master data

## Items
Purpose:
- list all items

Can:
- search
- filter
- open Item page
- create Item
- deactivate Item

Cannot:
- change stock
- post inventory actions

## Item Page
Purpose:
- maintain one Item

Can:
- edit Item
- save
- deactivate
- view **read-only** inventory blocks: balances by warehouse, recent stock movements (refresh when inventory data changes)

Cannot:
- post receipts/shipments or edit balances from this page

## Brands (list + page)
Purpose:
- maintain product brands (Standard/Advanced nav by default)

Brand page:
- edit brand
- related items table
- aggregated balances + recent movements for items in brand (read-only)

## Categories (list + page)
Purpose:
- maintain product categories (Standard/Advanced nav by default)

Category page:
- same pattern as Brand page scoped by category

## Carriers (list + page)
Purpose:
- logistics partner master data

Carrier page:
- edit carrier
- related customers (preferred carrier), sales orders, shipments (refresh on data changes)

## Suppliers
Purpose:
- list all suppliers

Can:
- search
- filter
- open Supplier page
- create Supplier
- deactivate Supplier

Cannot:
- create purchasing fact documents directly

## Supplier Page
Purpose:
- maintain one Supplier

Can:
- edit
- save
- deactivate
- view related purchase orders (summary chips + list; refreshes on data changes)

Cannot:
- perform inventory actions

## Customers
Purpose:
- list all customers

Can:
- search
- filter
- open Customer page
- create Customer
- deactivate Customer

Cannot:
- create shipment directly

## Customer Page
Purpose:
- maintain one Customer

Can:
- edit
- save
- deactivate
- set **preferred carrier** and **default delivery** fields (used when building sales orders / shipment defaults)
- view related sales orders (refreshes on data changes)

Cannot:
- perform inventory postings from this page

## Warehouses
Purpose:
- list all warehouses

Can:
- search
- filter
- open Warehouse page
- create Warehouse
- deactivate Warehouse

Cannot:
- change stock manually

## Warehouse Page
Purpose:
- maintain one Warehouse

Can:
- edit
- save
- deactivate
- view related receipts, shipments, and stock balance/movement **counts** for this warehouse (refreshes on data changes)

Cannot:
- change stock manually
- create movements from this page

## Purchase Orders
Purpose:
- list all purchase orders

Can:
- search
- filter
- open Purchase Order page
- create Purchase Order

Cannot:
- post receipt directly from list
- use bulk document actions in MVP

## Purchase Order Page
Purpose:
- work with a single purchase order

Can in Draft:
- edit
- save
- confirm
- cancel document

Can in Confirmed:
- create receipt
- cancel document

Can in Closed / Cancelled:
- view only

## Receipts
Purpose:
- list all receipts

Can:
- search
- filter
- open Receipt page

Cannot:
- create Receipt via New button

## Receipt Page
Purpose:
- work with one receipt

Can in Draft:
- edit
- save
- post
- cancel document

Can in Posted:
- view
- **reverse** once (full reversal, reason)

Can in Reversed / Cancelled:
- view only

## Sales Orders
Purpose:
- list all sales orders

Can:
- search
- filter
- open Sales Order page
- create Sales Order

Cannot:
- post shipment directly from list
- use bulk document actions in MVP

## Sales Order Page
Purpose:
- work with one sales order

Can in Draft:
- edit
- save
- confirm
- cancel document
- lines with qty, unit price, zero-price reason when required
- optional carrier and delivery fields (carrier defaults from customer preferred carrier)
- **Allocate stock** / reservation actions (workspace/settings dependent)

Can in Confirmed:
- create shipment (may require full reservations per settings)
- cancel document

Can in Closed / Cancelled:
- view only

Also:
- open **preliminary customer document** (print/PDF route) when available

## Shipments
Purpose:
- list all shipments

Can:
- search
- filter
- open Shipment page

Cannot:
- create Shipment via New button

## Shipment Page
Purpose:
- work with one shipment

Can in Draft:
- edit
- save
- post
- cancel document
- edit logistics: carrier, tracking, delivery recipient/address/phone/comment

Can in Posted:
- view
- **reverse** once (full reversal, reason)

Can in Reversed / Cancelled:
- view only

Also:
- open **delivery sheet** and **final customer document** (print/PDF); final customer doc view requires **posted** status

## Stock Balances
Purpose:
- show current inventory balances

Can:
- search
- filter
- review balances

Cannot:
- edit balance
- create balance entries
- post inventory actions

Note:
- no dedicated balance **detail** page; list supports **deep-link filters** (e.g. `itemId`, `brandId`, `categoryId`, `warehouseId`) from master pages
- **Excel export** of current/selected rows (desktop)

## Stock Movements
Purpose:
- show inventory movement history

Can:
- search
- filter
- open source document from movement record
- **Excel export** (desktop)
- deep-link filters similar to stock balances

Cannot:
- edit movement
- delete movement
- create movement manually

Note:
- Nav entry may be hidden in **Lite** workspace; overrides can re-enable
- no dedicated movement **detail** page

## Settings
Purpose:
- workspace profile (Lite / Standard / Advanced) and feature visibility overrides
- locale, theme, hotkeys
- document behavior toggles (confirm/post blocking, event log visibility, cancel/reversal reasons, draft shipment/receipt limits, auto-close planning)
- inventory reservation policy toggles (Advanced)
- commercial rounding and zero-price rules
- data/audit diagnostics (build info, etc.)

## Printable / export routes (no sidebar entry)
- `/sales-orders/:id/customer-document` — preliminary customer document
- `/shipments/:id/customer-document` — final customer document (posted-only content)
- `/shipments/:id/delivery-sheet` — internal delivery sheet

Opened from document pages via in-app navigation; support print and PDF download where the platform allows.
