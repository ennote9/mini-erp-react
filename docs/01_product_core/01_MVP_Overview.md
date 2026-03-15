    # MVP Overview

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This system is a **Mini ERP for a small business**. The first version is built to support a minimal but complete inventory and document flow:

- create master data
- create purchase orders
- receive stock
- create sales orders
- ship stock
- maintain balances
- keep movement history

## Target user

Primary target user:

- **Owner of a small business**

The owner may also act as:
- purchasing operator
- sales operator
- warehouse operator
- basic inventory controller

## First-version goal

The first version must make the following scenario fully workable:

1. Create Items
2. Create Supplier
3. Create Customer
4. Create Warehouse
5. Create Purchase Order
6. Confirm Purchase Order
7. Create Receipt from Purchase Order
8. Post Receipt
9. Increase stock balance
10. Create Sales Order
11. Confirm Sales Order
12. Create Shipment from Sales Order
13. Post Shipment
14. Decrease stock balance
15. View both movements in Stock Movements

## In scope

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

### UI foundation
- Dashboard
- Sidebar
- List pages
- Detail/object pages
- Search
- Basic filters
- Basic sorting
- Status badges
- Create/edit on separate pages

## Out of scope for v0.1

- bin/location management
- reservation
- allocation
- picking / packing / waves
- batches / lots / serials / expiry
- pricing / amounts / taxes / payments
- roles and permissions
- approval workflows
- advanced view manager
- saved views
- inline editing
- grouping
- advanced BI analytics
- returns
- adjustments
- multiple receipts per purchase order
- multiple shipments per sales order
- reverse posting

## Product boundaries

- One operational warehouse scenario in MVP logic
- Warehouse is still modeled as an entity
- No reservation logic
- No partial receipt
- No partial shipment
- Posted documents are not reversible in MVP
- Stock balance is not edited manually

## Success definition

MVP v0.1 is successful when:

- all master data can be created and maintained
- the full purchase flow works end to end
- the full sales flow works end to end
- stock balances update correctly after posting
- stock movements provide clear traceability
- the UI feels like one coherent enterprise application
