    # MVP Scope Freeze v0.1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

> **Historical scope freeze (MVP v0.1).** Implementation has **exceeded** this freeze in several areas (see **`08_Current_Product_State.md`**). This file remains as a record of the original boundaries.

This document prevents uncontrolled scope expansion during implementation.

## MVP v0.1 includes

### Master data
- Items
- Suppliers
- Customers
- Warehouses

### Documents
- Purchase Orders
- Receipts
- Sales Orders
- Shipments

### Inventory visibility
- Stock Balances
- Stock Movements

### UI baseline
- Dashboard
- Sidebar shell
- List/detail pages
- Search
- Basic filters
- Basic sorting
- Status badges
- Separate create pages

## Hard exclusions from v0.1

### Warehouse complexity
- bins
- locations
- zoning
- picking
- packing
- waves
- allocation
- reservation

### Inventory complexity
- lots
- batches
- serials
- expiry
- quality statuses
- quarantine

### Document complexity
- partial receipt
- partial shipment
- multiple receipts per order
- multiple shipments per order
- reverse posting
- reopen logic

### Commercial complexity
- prices
- amounts
- discounts
- taxes
- currencies
- payments

### Governance complexity
- roles and permissions
- approval flows
- audit subsystem
- admin console

### UI complexity
- advanced view manager
- saved views
- grouping
- drag and drop columns
- freeze columns
- inline editing
- bulk document actions
- conditional formatting

### Analytics complexity
- BI dashboards
- KPI suite
- forecasting
- ABC/XYZ
- turnover analytics

## Operational constraints

- one operational warehouse scenario
- no reservation
- no partial operations
- no reverse posting
- stock balance not manually editable

## Scope discipline rule

Any new proposed feature must answer:
1. Is it required to complete the core flow?  
2. Does it strengthen existing behavior or add a new logic branch?  
3. Is it needed for first live use, or merely desirable later?  
4. Is it a single-feature enhancement or a platform layer?

If the answer points to “new branch”, “later”, or “platform layer”, it is not v0.1.

## MVP ready does NOT require

MVP v0.1 is still considered complete without:
- advanced grid personalization
- saved views
- BI analytics
- roles
- finance
- returns
- WMS features

The MVP only needs a clean, working core.
