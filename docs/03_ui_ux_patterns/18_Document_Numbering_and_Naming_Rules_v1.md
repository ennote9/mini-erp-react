    # Document Numbering and Naming Rules v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines business identifiers and naming conventions.

## Core principle

### Technical ID
Internal system identifier used by the database and logic.

### Business identifier
Human-readable identifier shown in UI and used in search.

## Document number formats

- Purchase Order: `PO-000001`
- Receipt: `RCPT-000001`
- Sales Order: `SO-000001`
- Shipment: `SHP-000001`

### Rule
No year is included in MVP document numbers.

## Master data business codes

### Item
Primary business identifier: `code`
Examples:
- ITEM-001
- SKU-001
- A10025

### Supplier
Suggested code pattern:
- `SUP-0001`

### Customer
Suggested code pattern:
- `CUS-0001`

### Warehouse
Suggested code pattern:
- `WH-001`

## Uniqueness rules

### Documents
Number is unique within its own document type.

### Master data
Business code is unique within its own entity.

## UI display rules

### Documents
Show business number in:
- list page
- page header
- breadcrumb
- summary block
- source document references

### Master data
Show business code in:
- list page
- page header
- breadcrumb
- detail form

## Search rules
Users search by business identifier, not technical id.

Examples:
- PO-000014
- SO-000003
- RCPT-000001
- SHP-000010
- ITEM-001
- SUP-0001

## UI naming language
Use consistent English labels:
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

## Explicit exclusions
Not included in MVP:
- year-based numbers
- branch-based number prefixes
- custom numbering series
- editable business numbers after assignment
