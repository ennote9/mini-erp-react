    # Acceptance Criteria v0.1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    > **Historical.** The app may satisfy additional behaviors today; see **`08_Current_Product_State.md`** for the live product description.

    ## Purpose

This document defines the acceptance gates for MVP v0.1.

## Core acceptance

### Master data
The system is acceptable if it supports:
- create Item / Supplier / Customer / Warehouse
- open and edit each record
- deactivate each record
- enforce unique business codes
- display records in list pages

### Purchase flow
The system is acceptable if it supports:
- create Draft Purchase Order
- add lines
- save Purchase Order
- open Purchase Order from list
- confirm Purchase Order
- create Receipt only from Confirmed Purchase Order
- post Receipt
- set Purchase Order to Closed after Posted Receipt

### Sales flow
The system is acceptable if it supports:
- create Draft Sales Order
- add lines
- save Sales Order
- open Sales Order from list
- confirm Sales Order
- create Shipment only from Confirmed Sales Order
- post Shipment
- set Sales Order to Closed after Posted Shipment

### Inventory logic
The system is acceptable if:
- Receipt increases stock
- Shipment decreases stock
- Draft and Confirmed do not change stock
- stock balance cannot be manually edited
- stock movements are created by posting
- Shipment cannot be posted if stock is insufficient

### UI core
The system is acceptable if:
- sidebar works
- list pages open
- object pages open
- search works
- basic filter works
- row click opens detail page where applicable
- status badges are visible on document lists
- New is visible only where allowed

## Extended acceptance

### Negative validation
The system must reject:
- saving invalid master data
- confirming invalid Purchase Order / Sales Order
- posting invalid Receipt / Shipment
- creating Receipt from invalid source order
- creating Shipment from invalid source order
- posting Shipment with insufficient stock
- duplicate item lines in same document

### Data integrity
The system must ensure:
- one Posted Receipt creates movements matching its lines
- one Posted Shipment creates movements matching its lines
- Stock Balance matches inventory changes
- source document fields on movements are always filled
- Closed Purchase Order always corresponds to a Posted Receipt
- Closed Sales Order always corresponds to a Posted Shipment

### Duplicate protection / idempotency
The system must ensure:
- double-click Post does not double-post
- refresh after Post does not create duplicate movements
- second Posted Receipt cannot exist for same Purchase Order
- second Posted Shipment cannot exist for same Sales Order

### Status integrity
The system must ensure:
- only allowed status transitions are possible
- invalid transitions are blocked
- Posted cannot be edited
- Closed cannot be edited
- Cancelled cannot be edited
- Posted cannot be reversed in MVP

### UI consistency
The system must ensure:
- sidebar behavior is consistent
- breadcrumb on object pages is correct
- Save / Cancel patterns are consistent
- document actions depend on status consistently
- documents do not open in modals
- grid does not edit inline

### Empty / edge states
The system must handle:
- empty database
- empty list pages
- search that returns no rows
- filter that returns no rows
- one-line documents
- multi-line documents
- one operational warehouse
- historical documents with inactive entities

### Dashboard
The system must ensure:
- dashboard loads with no data
- summary cards show zero safely
- latest lists render or show empty states
- dashboard provides navigation but no process actions

### Scope control
The MVP remains acceptable only if it does **not** silently expand to include:
- partial operations
- reverse posting
- pricing / amounts / taxes
- roles and permissions
- advanced view manager
- saved views
- inline editing
- WMS logic
- BI analytics

## End-to-end acceptance scenario

MVP v0.1 is accepted when the following scenario works consistently:

1. Create Item
2. Create Supplier
3. Create Customer
4. Create Warehouse
5. Create Purchase Order
6. Confirm Purchase Order
7. Create Receipt
8. Post Receipt
9. Verify stock increase
10. Create Sales Order
11. Confirm Sales Order
12. Create Shipment
13. Post Shipment
14. Verify stock decrease
15. Verify both movements in Stock Movements
