    # Dashboard v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

Dashboard is the high-level overview screen for the owner of a small business.

## Dashboard goals
- understand current system state quickly
- see recent important activity
- jump quickly into a module

## Block structure

### A. Summary Cards
- Items count
- Suppliers count
- Customers count
- Warehouses count

### B. Stock Overview
- Total items with stock
- Total quantity on hand

### C. Latest Purchase Orders
Columns:
- Number
- Date
- Supplier
- Status

### D. Latest Sales Orders
Columns:
- Number
- Date
- Customer
- Status

### E. Latest Stock Movements
Columns:
- Date/Time
- Movement Type
- Item
- Qty Delta
- Warehouse
- Source Document

### F. Quick Navigation
Links to:
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
