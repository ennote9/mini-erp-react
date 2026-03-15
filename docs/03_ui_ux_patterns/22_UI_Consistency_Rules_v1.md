    # UI Consistency Rules v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the non-negotiable consistency rules that keep the product coherent.

## Core consistency objective

If a user understands one module, they should quickly understand the others.

## Consistency layers

### Shell consistency
- same sidebar behavior
- same collapse / expand logic
- same page top bar rhythm

### Navigation consistency
- same list -> detail logic
- same breadcrumb placement
- same active state logic

### Page pattern consistency
- dashboard behaves like dashboard
- list page behaves like list page
- object page behaves like object page

### Form consistency
- required field indicators
- lookup behavior
- read-only behavior
- Save / Cancel behavior
- error display

### Grid consistency
- checkbox placement
- row click behavior
- search/filter placement
- sorting behavior
- loading/empty/error behavior

### State consistency
- same status words
- same status meaning
- same badge logic
- same editability rules

## Terminology consistency
Use the same product vocabulary everywhere:
- Items
- Suppliers
- Customers
- Warehouses
- Purchase Orders
- Receipts
- Sales Orders
- Shipments
- Stock Balances
- Stock Movements

Do not mix alternative terms such as:
- Vendor vs Supplier
- Client vs Customer
- Product vs Item
unless a deliberate product-wide rename is made.

## Interaction consistency
- Confirm always means Draft -> Confirmed
- Post always means inventory-affecting factual completion
- Cancel document always means document cancellation
- Deactivate always means soft disable, not delete

## Density consistency
The entire system must remain:
- desktop-first
- dense
- structured
- enterprise-like

Do not mix dense enterprise pages with airy consumer-style pages.

## Scope consistency
UI must not imply unsupported features.

Do not show dead placeholders for:
- partial flows
- advanced view manager
- grouping
- pricing
- WMS logic
unless those features are truly in scope.

## Critical behaviors that must never drift
- sidebar behavior
- list/detail pattern
- create on separate page
- no New for Receipt / Shipment
- no inline editing
- action-by-status logic
- naming consistency
- badge consistency
- grid behavior consistency
