    # Document Page Layout v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the concrete page layout for all document pages.

## Shared document page structure

All document pages include:
- breadcrumb
- title + number
- status
- summary block
- tabs: Overview / Lines
- actions by status

## Purchase Order Page

### Header
- Purchasing > Purchase Orders > PO-000014
- Purchase Order PO-000014
- status badge
- actions

### Summary block
- Number
- Date
- Supplier
- Warehouse
- Status
- Comment

### Tabs
- Overview
- Lines

### Lines grid
- Item
- Qty
- UOM

### Actions
#### Draft
- Save
- Cancel
- Confirm
- Cancel document

#### Confirmed
- Create Receipt
- Cancel document

#### Closed / Cancelled
- view only

## Sales Order Page

### Header
- Sales > Sales Orders > SO-000008
- Sales Order SO-000008
- status badge
- actions

### Summary block
- Number
- Date
- Customer
- Warehouse
- Status
- Comment

### Tabs
- Overview
- Lines

### Lines grid
- Item
- Qty
- UOM

### Actions
#### Draft
- Save
- Cancel
- Confirm
- Cancel document

#### Confirmed
- Create Shipment
- Cancel document

#### Closed / Cancelled
- view only

## Receipt Page

### Header
- Purchasing > Receipts > RCPT-000003
- Receipt RCPT-000003
- status badge
- actions

### Summary block
- Number
- Date
- Related Purchase Order
- Warehouse
- Status
- Comment

### Tabs
- Overview
- Lines

### Lines grid
- Item
- Qty
- UOM

### Actions
#### Draft
- Save
- Cancel
- Post
- Cancel document

#### Posted / Cancelled
- view only

## Shipment Page

### Header
- Sales > Shipments > SHP-000004
- Shipment SHP-000004
- status badge
- actions

### Summary block
- Number
- Date
- Related Sales Order
- Warehouse
- Status
- Comment

### Tabs
- Overview
- Lines

### Lines grid
- Item
- Qty
- UOM

### Actions
#### Draft
- Save
- Cancel
- Post
- Cancel document

#### Posted / Cancelled
- view only

## Explicit exclusions
Not included in MVP:
- Related Documents tab
- History tab
- Attachments
- Audit block
- Financial tab
- line pricing
