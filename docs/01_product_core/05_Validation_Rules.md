    # Validation Rules

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the validation rules that protect data quality and inventory integrity.

## Global principles

- Required fields must be enforced.
- Business codes and document numbers must be unique in their scope.
- Inactive master data cannot be used in new documents.
- Validation messages must be clear and human-readable.
- Document lifecycle actions must validate both field data and business state.

## Master data validation

### Item
Reject save if:
- code is empty
- name is empty
- uom is empty
- code duplicates another Item

### Supplier
Reject save if:
- code is empty
- name is empty
- code duplicates another Supplier

### Customer
Reject save if:
- code is empty
- name is empty
- code duplicates another Customer

### Warehouse
Reject save if:
- code is empty
- name is empty
- code duplicates another Warehouse

## Global document validation

Reject document save if:
- date is empty
- required header relationships are missing
- no lines exist
- a line has no Item
- a line has qty <= 0

Also:
- status is system-controlled
- number is system-controlled after assignment
- system fields are read-only

## Purchase Order validation

### Save Draft
Reject if:
- date missing
- supplier missing
- warehouse missing
- no lines
- line Item missing
- line qty <= 0
- inactive supplier selected
- inactive warehouse selected
- inactive item selected
- duplicate item lines exist in the same document

### Confirm
Reject if:
- document is not valid as Draft
- document is not currently Draft
- no lines
- line-level errors remain

### Create Receipt
Reject if:
- Purchase Order is not Confirmed
- Purchase Order is Closed
- Purchase Order is Cancelled
- Posted Receipt already exists for this order

## Receipt validation

### Create Draft
Reject if:
- source Purchase Order missing
- source Purchase Order is not Confirmed

### Save Draft
Reject if:
- date missing
- purchase order missing
- warehouse missing
- no lines
- line Item missing
- line qty <= 0
- inactive warehouse selected
- inactive item selected
- duplicate item lines exist in the same document

### Post
Reject if:
- Receipt is not Draft
- source Purchase Order is not Confirmed
- no lines
- line-level errors remain
- another Posted Receipt already exists for same Purchase Order

## Sales Order validation

### Save Draft
Reject if:
- date missing
- customer missing
- warehouse missing
- no lines
- line Item missing
- line qty <= 0
- inactive customer selected
- inactive warehouse selected
- inactive item selected
- duplicate item lines exist in the same document

### Confirm
Reject if:
- document is not valid as Draft
- document is not currently Draft
- no lines
- line-level errors remain

### Create Shipment
Reject if:
- Sales Order is not Confirmed
- Sales Order is Closed
- Sales Order is Cancelled
- Posted Shipment already exists for this order

## Shipment validation

### Create Draft
Reject if:
- source Sales Order missing
- source Sales Order is not Confirmed

### Save Draft
Reject if:
- date missing
- sales order missing
- warehouse missing
- no lines
- line Item missing
- line qty <= 0
- inactive warehouse selected
- inactive item selected
- duplicate item lines exist in the same document

### Post
Reject if:
- Shipment is not Draft
- source Sales Order is not Confirmed
- no lines
- line-level errors remain
- another Posted Shipment already exists for same Sales Order
- available stock is insufficient for any line

## Shipment stock validation

Rule:
- available stock >= shipment qty for every line

If not:
- Post is rejected
- document remains Draft
- no movements are created
- stock balance is unchanged

## Status-based validation

Reject:
- edit of Confirmed Purchase Order
- edit of Confirmed Sales Order
- edit of Closed Purchase Order
- edit of Closed Sales Order
- edit of Posted Receipt
- edit of Posted Shipment
- edit of Cancelled documents
- confirm from a non-Draft planning document
- post from a non-Draft factual document

## Line-level validation

For every document line:
- Item is required
- qty must be > 0
- duplicate Item lines are not allowed in MVP

## Inventory protection validation

Reject:
- manual creation of Stock Movement
- manual editing of Stock Movement
- manual deletion of Stock Movement
- manual editing of Stock Balance

## Deactivation behavior validation

If Item / Supplier / Customer / Warehouse is inactive:
- it cannot be selected in new documents
- historical documents referencing it must still open correctly

## Validation message rules

Use clear messages such as:
- Code is required
- Name is required
- Date is required
- Supplier is required
- Customer is required
- Warehouse is required
- At least one line is required
- Quantity must be greater than zero
- Insufficient stock for item ITEM-001
- Posted documents cannot be edited

Do not use:
- Validation failed
- Operation error
- Unexpected state
- technical stack-like messages
