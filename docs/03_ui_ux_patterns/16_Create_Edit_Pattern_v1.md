    # Create / Edit Pattern v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines create, edit, and view behavior across the product.

## Core rule
Creation happens on a **separate page**.

## Modes

### Create
- new object
- empty fields or defaults
- Save / Cancel available

### Edit
- existing object
- editable fields enabled if allowed

### View
- read-only page
- business actions depend on state

## Create pattern for master data
From list page:
- click New
- open New Item / Supplier / Customer / Warehouse page
- fill fields
- Save
- page becomes normal detail page after first save

## Create pattern for Purchase Order / Sales Order
From list page:
- click New
- open New Purchase Order / New Sales Order page
- status defaults to Draft
- number assigned after first save
- page becomes normal document page after first save

## Create pattern for Receipt / Shipment
Not created from list pages.

### Receipt
Created only from Confirmed Purchase Order.

### Shipment
Created only from Confirmed Sales Order.

Both open as their own pages with copied context.

## Edit permissions

Editable:
- Draft Purchase Order
- Draft Sales Order
- Draft Receipt
- Draft Shipment
- active or inactive master data records as allowed by business rules

Not editable:
- Confirmed Purchase Order
- Confirmed Sales Order
- Closed Purchase Order
- Closed Sales Order
- Posted Receipt
- Posted Shipment
- Cancelled documents

## Save behavior
Save:
- validates
- persists
- does not change lifecycle state by itself
- keeps user on the same page

## Cancel behavior
### Create mode
- leave without creating the record

### Edit mode
- discard unsaved changes / leave edit state without hidden save

## Action separation

### Form actions
- Save
- Cancel

### Business actions
- Confirm
- Post
- Create Receipt
- Create Shipment
- Cancel document
- Deactivate
