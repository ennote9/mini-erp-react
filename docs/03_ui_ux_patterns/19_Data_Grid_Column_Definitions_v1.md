    # Data Grid Column Definitions v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines required columns and order for each list page grid.

## Global grid column rules

- checkbox column appears on all list pages
- first business column is the primary identifier
- status on document lists must be visible without horizontal scrolling
- similar modules should have similar column structure

## Items
1. Checkbox
2. Code
3. Name
4. UOM
5. Active

## Suppliers
1. Checkbox
2. Code
3. Name
4. Phone
5. Email
6. Active

## Customers
1. Checkbox
2. Code
3. Name
4. Phone
5. Email
6. Active

## Warehouses
1. Checkbox
2. Code
3. Name
4. Active

## Purchase Orders
1. Checkbox
2. Number
3. Date
4. Supplier
5. Warehouse
6. Status

## Receipts
1. Checkbox
2. Number
3. Date
4. Purchase Order
5. Warehouse
6. Status

## Sales Orders
1. Checkbox
2. Number
3. Date
4. Customer
5. Warehouse
6. Status

## Shipments
1. Checkbox
2. Number
3. Date
4. Sales Order
5. Warehouse
6. Status

## Stock Balances
1. Checkbox
2. Item Code
3. Item Name
4. Warehouse
5. Qty On Hand

## Stock Movements
1. Checkbox
2. Date/Time
3. Movement Type
4. Item Code
5. Item Name
6. Warehouse
7. Qty Delta
8. Source Document

## Notes
- Movement Type should be shown as text + badge.
- Status is mandatory on document grids.
- No technical IDs are shown in MVP list pages.
