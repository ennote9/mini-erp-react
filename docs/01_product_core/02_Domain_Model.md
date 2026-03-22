    # Domain Model

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the core entities of the Mini ERP MVP and the relationships between them.

## Core modeling principles

1. **Documents and movements drive inventory**  
   Inventory is not maintained by free manual edits.

2. **Stock balance is a derivative business state**  
   It is stored physically for MVP performance, but is logically based on movements.

3. **Planning documents and factual documents are separated**  
   - Purchase Order != Receipt  
   - Sales Order != Shipment

## Entity groups

### Master Data

#### Item
Represents a sellable / receivable product.

Primary business role:
- appears in orders
- appears in receipts and shipments
- appears in balances and movements

Core fields:
- id
- code
- name
- uom
- is_active
- description (optional)

#### Supplier
Represents a vendor from whom stock is purchased.

Core fields:
- id
- code
- name
- is_active
- phone (optional)
- email (optional)
- comment (optional)

#### Customer
Represents a buyer to whom stock is sold.

Core fields:
- id
- code
- name
- is_active
- phone (optional)
- email (optional)
- comment (optional)

#### Warehouse
Represents the warehouse dimension for stock balances and movements.

Core fields:
- id
- code
- name
- is_active
- comment (optional)

### Planning documents

#### Purchase Order
Represents an intention to buy stock from a supplier.

Core fields:
- id
- number
- date
- supplier_id
- warehouse_id
- status
- comment (optional)

#### Sales Order
Represents an intention to sell stock to a customer.

Core fields:
- id
- number
- date
- customer_id
- warehouse_id
- status
- comment (optional)

### Factual documents

#### Receipt
Represents factual incoming stock.

Core fields:
- id
- number
- date
- purchase_order_id
- warehouse_id
- status
- comment (optional)

#### Shipment
Represents factual outgoing stock.

Core fields:
- id
- number
- date
- sales_order_id
- warehouse_id
- status
- comment (optional)

### Inventory entities

#### Stock Movement
Represents a factual inventory change event.

Core fields:
- id
- datetime
- movement_type
- item_id
- warehouse_id
- qty_delta
- source_document_type
- source_document_id
- comment (optional)

#### Stock Balance
Represents the current available quantity by item and warehouse.

Core fields:
- id
- item_id
- warehouse_id
- qty_on_hand

## Line entities

### Purchase Order Line
- id
- purchase_order_id
- item_id
- qty

### Receipt Line
- id
- receipt_id
- item_id
- qty

### Sales Order Line
- id
- sales_order_id
- item_id
- qty

### Shipment Line
- id
- shipment_id
- item_id
- qty

## Relationships

### Item
An Item is referenced by:
- Purchase Order Line
- Receipt Line
- Sales Order Line
- Shipment Line
- Stock Balance
- Stock Movement

### Supplier
A Supplier can have many Purchase Orders.

### Customer
A Customer can have many Sales Orders.

### Warehouse
A Warehouse is referenced by:
- Purchase Order
- Receipt
- Sales Order
- Shipment
- Stock Balance
- Stock Movement

### Purchase Order -> Receipt
In MVP:
- one Purchase Order can produce one Receipt
- after Posted Receipt, the Purchase Order becomes Closed

### Sales Order -> Shipment
In MVP:
- one Sales Order can produce one Shipment
- after Posted Shipment, the Sales Order becomes Closed

### Receipt -> Stock Movement
A Receipt creates one or more positive stock movements, typically one per line.

### Shipment -> Stock Movement
A Shipment creates one or more negative stock movements, typically one per line.

### Stock Movement -> Stock Balance
Stock Balance is updated by posted stock movements.

## Domain rules

1. Purchase Order and Sales Order do not affect stock.
2. Only Posted Receipt and Posted Shipment affect stock.
3. Stock Movement is the system of record for inventory changes.
4. Stock Balance cannot be edited manually.
5. No partial operations in MVP.
6. No reverse posting in MVP.
7. One Purchase Order is closed by one Receipt.
8. One Sales Order is closed by one Shipment.

## Explicit exclusions from the MVP domain

The MVP domain model does **not** include:
- bins / locations
- batches / lots
- serial numbers
- reservations
- allocations
- pricing
- amounts
- taxes
- payment objects
- returns
- adjustments
- approval objects
- audit subsystem objects

---

## Appendix: domain extensions in the current codebase

The following **exist in code today** even though they were not in the original MVP domain summary above. See **`08_Current_Product_State.md`** for workflow context.

### Master data extensions

- **Brand**, **Category** — item classification; items reference optional `brandId` / `categoryId`.
- **Carrier** — logistics partner master data (type, contact, optional tracking URL template, payment terms, etc.).
- **Customer** — extended with `preferredCarrierId`; default delivery fields (`defaultRecipientName`, `defaultRecipientPhone`, `defaultDeliveryAddress`, `defaultDeliveryComment`); extended address/tax/contact fields.
- **Supplier** — extended commercial/contact/address fields as implemented on the Supplier page.
- **Item** — optional images; purchase/sale prices; barcode; brand/category links.

### Planning document extensions

- **Purchase Order / Sales Order** — unit prices per line; commercial money rounding; zero-price reason codes where enforced; payment terms and derived due date on SO.
- **Sales Order** — optional `carrierId`; optional delivery fields (`recipientName`, `recipientPhone`, `deliveryAddress`, `deliveryComment`) aligned with shipment logistics.

### Factual document extensions

- **Receipt / Shipment** — factual status may include **`reversed`** (after a single full reversal from **posted**). Reversal creates compensating **stock movements** (`receipt_reversal`, `shipment_reversal`).
- **Shipment** — optional `carrierId`, `trackingNumber`, same delivery metadata fields as copied from the sales order at creation time.

### Inventory subsystem (not in original MVP list)

- **Stock reservation** — persisted records tied to sales flow; statuses such as active / consumed / released; used for allocation views, shipment gating (settings), and operational balance metrics.

### Printable views (not separate persisted business entities)

- **Sales order customer document** — generated from planning data (preliminary).
- **Shipment customer document** — generated from posted shipment (final).
- **Shipment delivery sheet** — operational printable from shipment record.
