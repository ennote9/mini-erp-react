    # Dashboard v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

Dashboard is the high-level overview screen for the owner of a small business.

> **Current implementation (2026-03-22):** blocks below match `src/modules/dashboard/` (see also `dashboardStats.ts`). Older MVP text implied master-data count cards and “latest PO/SO” tables; the **live** dashboard is **document- and inventory-centric** as described here.

## Dashboard goals
- understand current system state quickly
- see recent important activity
- jump quickly into a module

## Block structure (implemented)

### A. Document overview (four cards)
- **Purchase orders** — totals by planning status: draft, confirmed, closed, cancelled
- **Sales orders** — same breakdown
- **Receipts** — factual breakdown: draft, posted, **reversed**, cancelled
- **Shipments** — factual breakdown: draft, posted, **reversed**, cancelled

### B. Inventory overview (cards)
- **Stock balances** — count of balance rows (link to list)
- **Stock movements** — count of movement rows (link to list); card may be **hidden** in Lite workspace
- **Items** — total items, active count, count with images (link to items list)

### C. Recent activity
- **Recent receipts** — latest rows with PO number, warehouse, status (link into receipt)
- **Recent shipments** — latest rows with SO number, warehouse, status (link into shipment)

### D. Quick navigation + signals
- **Quick links** — shortcuts to major modules
- **Signals** — operational hints (e.g. inactive items, items without images, counts of draft receipts/shipments)

## Freshness

Aggregates and recent lists **re-subscribe** when local repositories persist changes (`appReadModelRevision` + `useSyncExternalStore`), so the dashboard is not stuck on first mount while the session is open.

## Older MVP wording (deprecated for this screen)

The following were **design ideas** in the original MVP dashboard spec and are **not** what the current UI renders:
- simple count cards only for Items/Suppliers/Customers/Warehouses
- “Latest PO” and “Latest SO” tables as the primary activity widgets
- a large “latest stock movements” table on the dashboard *(movements remain available via sidebar and movement count card)*

## Empty dashboard rules
- summary cards show zero
- latest lists show empty states
- dashboard remains stable and usable

## Dashboard constraints
Dashboard can:
- open documents
- open modules

Dashboard cannot:
- confirm documents
- post documents
- edit records directly
- act as BI analytics center

## Explicit exclusions
Not included in MVP:
- charts
- financial KPIs
- advanced tasks or alerts
- workflow inbox
- dashboard customization
