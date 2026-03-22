# Current product state (code-aligned)

- Status: **Living summary** — describes the **local codebase as implemented today**
- Date: 2026-03-22
- Supersedes narrative in older “MVP v0.1 only” docs where they conflict with code

Use this document when you need an **honest picture of what exists now**. The numbered MVP pack (`01_MVP_Overview` … `07_MVP_Scope_Freeze`) remains a **historical baseline**; when it disagrees with the app, **trust the code and this file**.

## What this app is

A **desktop-first mini ERP** (Tauri + React + TypeScript + Vite) with **local persistence**. It targets small-business operations: master data, purchasing and sales documents, inventory, logistics metadata, printable handoffs, settings, and i18n (e.g. English, Russian, Kazakh). It is **not** a full financial ERP, WMS, or multi-user cloud product.

## Major modules (implemented)

| Area | Role today |
|------|------------|
| **Items** | Product master; optional brand/category; images; prices on item; per-item inventory blocks (balances by warehouse, recent movements). |
| **Brands / Categories** | Item grouping; related items list; **aggregated** stock balances and recent movements across items in scope. |
| **Suppliers / Customers / Warehouses / Carriers** | Partner and location master data. **Carriers** are logistics partners (courier types, contact, optional tracking URL template). |
| **Purchase orders** | Planning: draft → confirm → cancel; unit prices and commercial rounding; link to supplier/warehouse. |
| **Receipts** | Factual inbound from confirmed PO; post/cancel; **full reversal once** from posted (reason); stock movements + balances. |
| **Sales orders** | Planning: draft → confirm → cancel; lines with qty and unit price; payment terms and derived due date; **carrier** and **delivery fields**; **allocate stock** / reservations; optional **preliminary customer document** (print/PDF). |
| **Shipments** | Factual outbound from confirmed SO; post/cancel; **full reversal once** from posted; **carrier**, **tracking**, delivery fields; **delivery sheet** and **final customer document** (print/PDF); stock movements + balances. |
| **Stock balances / Stock movements** | Read-only operational views; filters (e.g. item, brand, category, warehouse); list **Excel export** where implemented; drill-down / contributor context where wired. |
| **Stock reservations** | **Persisted** reservations tied to sales orders/lines; affect allocation views, posting checks, and balance “operational” metrics — **not** a separate sidebar module. |
| **Dashboard** | Document breakdown cards (PO/SO/receipts/shipments), inventory overview (balance rows, movement rows, item counts/images), recent receipts/shipments, quick links, **signals** (e.g. inactive items, drafts). |
| **Settings** | Workspace profile (Lite / Standard / Advanced), locale, theme, documents/inventory/commercial/data-audit toggles with **readiness** labels (active / partial / stored-only / informational). |

## Core flows (implemented)

**Master data** — CRUD-style pages with validation and health hints; several entities show **related documents** (e.g. supplier → POs, customer → SOs, carrier → customers/SOs/shipments, warehouse → receipts/shipments/stock counts) and refresh when local data changes (see *Freshness* below).

**Purchasing** — Draft PO → Confirm → Create receipt → Post receipt → PO closed (per settings, e.g. auto-close when fully fulfilled). Receipt reversal restores stock and moves linked PO back to a workable state per implemented rules.

**Sales** — Draft SO → Confirm → (optional) **Allocate stock** / reservations → Create shipment (lines = **remaining** open qty) → Post shipment → SO closed. Shipment reversal compensates stock and returns SO to **confirmed** for rework. Advanced settings can **require full reservation per line before** creating a shipment draft.

**Inventory** — Balances and movements are driven by **posted** factual documents and **reversals**; reservations reduce “available” in operational views; no manual balance editing.

**Logistics / delivery** — Optional **carrier** on SO (defaults from **customer preferred carrier** if SO carrier unset). **New shipment** copies SO carrier + delivery recipient/address/phone/comment into the draft shipment; draft shipment allows editing logistics fields before post. **Tracking number** lives on the shipment.

**Customer-facing documents** — **Preliminary**: printable route from **sales order** (`/sales-orders/:id/customer-document`), planning data + disclaimer; hidden/unavailable if SO is cancelled or has no lines. **Final**: printable route from **shipment** (`/shipments/:id/customer-document`), **only for posted** shipments; includes shipped lines and shipment logistics. Both support **browser print** and **PDF download** (desktop save via Tauri where available).

**Delivery sheet** — Operational printable for a **shipment** (`/shipments/:id/delivery-sheet`): internal handoff (carrier, tracking, address, lines, copy helpers); print + PDF similar to customer docs.

## Source-of-truth chains (from code)

1. **Carrier** — Customer `preferredCarrierId` → default when creating SO if user does not set `carrierId` on SO → on **create shipment**, SO `carrierId` wins if it resolves to a valid carrier; else customer preferred carrier. Shipment stores its own `carrierId` and `trackingNumber`.

2. **Delivery metadata** — Customer defaults (`defaultRecipientName`, `defaultRecipientPhone`, `defaultDeliveryAddress`, `defaultDeliveryComment`) feed **sales order** fields (`recipientName`, etc.) when the user selects the customer (UI). **Create shipment** copies SO delivery fields onto the **draft shipment**; edits continue on the shipment until post.

3. **Customer documents** — **Preliminary** = **Sales order** snapshot. **Final** = **Posted shipment** snapshot (unavailable for draft/cancelled/reversed shipment in the customer-doc view).

4. **Reservations / allocation** — Reservations are stored per sales order line context; **manual** allocation from the sales order; shipment post consumes/releases per implemented reconciliation; settings control require-reservation-before-shipment, release on cancel/close, reconcile on save/confirm (some marked **partial** in settings registry).

5. **Planning vs factual** — PO/SO do not post stock. Receipt/Shipment post (or reversal) drives movements and balances.

## UI patterns beyond isolated CRUD

- **Filtered list navigation** — Stock balances and movements accept query params (e.g. `itemId`, `brandId`, `categoryId`, `warehouseId`) for drill-down from item/brand/category/warehouse pages.
- **Operational hub pages** — Master-data detail pages show related lists and summary chips; they subscribe to the shared read-model revision so same-session changes refresh without remount.
- **Dashboard** — Subscribes to the same revision so aggregates and recent activity update after local persistence bumps.

## Settings and workspace profile

- **Workspace mode** (Lite / Standard / Advanced) controls **visibility** of nav items (e.g. brands/categories, stock movements) and **which settings rows appear**.
- **Profile overrides** can force individual features on/off vs the mode default.
- Settings registry marks rows as **active**, **partial**, **storedOnly**, or **informational** (readonly). **Reservations** and **document event recording** are fixed on in the product: persisted “off” values are **normalized to on** on load/patch, and the UI explains this with informational rows (no fake toggles). See `src/shared/settings/registry.ts`.

## Print / export / PDF

- **Print** — `window.print()` on dedicated printable routes with print-specific CSS.
- **PDF** — Renders the same DOM subtree to a PDF file via shared document helpers; user picks save path in Tauri; errors surface as alerts.
- **Excel** — Several **list** pages export current/selected rows to `.xlsx` via Tauri `write_export_file` (not the same subsystem as printable docs).

## Freshness / read-model revision

Local repositories persist asynchronously. A shared **`appReadModelRevision`** counter is bumped when key repositories schedule persistence, so important **read surfaces** (dashboard, warehouse hub, carrier/supplier/customer hubs, item/brand/category inventory blocks) can subscribe via **`useSyncExternalStore`** and recompute derived lists without polling. This does **not** replace domain rules; it only ties UI recompute to mutation timing.

## Honest limitations (examples)

- **No separate “reservations” screen** in navigation — reservations are a subsystem, not a first-class list module.
- **Allocation mode** setting is **manual only** (no automatic allocation mode in code).
- **Date/number format** settings: largely **stored for future** display use (see registry).
- **Partner terms vs document** preference: **stored**, document terms remain authoritative today.
- **Backup/restore, demo reset** — described in settings as **not** implemented.
- **Full multi-step warehouse scenario** — still one logical operational focus in older product language; the app still models **multiple warehouses** as data.

## Where to look in code

- Routes: `src/app/routes.tsx`
- Sidebar: `src/app/shell/Sidebar/AppSidebar.tsx`
- Settings model: `src/shared/settings/types.ts`, registry: `src/shared/settings/registry.ts`
- Workspace visibility: `src/shared/workspace/`
- Read-model revision: `src/shared/appReadModelRevision.ts`
- Shipment create defaults: `src/modules/sales-orders/service.ts` (`createShipment`)
