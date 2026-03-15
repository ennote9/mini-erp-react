    # Document Flows

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the step-by-step operational flow for purchasing and sales in MVP v0.1.

## Purchase Flow

### Flow summary
Draft PO -> Confirmed PO -> Draft Receipt -> Posted Receipt -> Closed PO

### Step 1: Create Purchase Order
User:
- opens Purchase Orders list
- clicks New
- fills Date, Supplier, Warehouse, Lines
- saves document

System result:
- Purchase Order is created
- status = Draft
- no stock change
- no stock movements

### Step 2: Confirm Purchase Order
User:
- opens Draft Purchase Order
- clicks Confirm

System validates:
- Date is filled
- Supplier is selected and active
- Warehouse is selected and active
- at least one line exists
- each line has an Item
- each line has qty > 0
- all Items are active

System result:
- Purchase Order status = Confirmed
- no stock change
- no movements
- document becomes non-editable

### Step 3: Create Receipt from Purchase Order
User:
- opens Confirmed Purchase Order
- clicks Create Receipt

System result:
- Draft Receipt is created
- Purchase Order link is assigned
- Warehouse is copied
- lines are copied
- no stock change
- no movements

### Step 4: Post Receipt
User:
- opens Draft Receipt
- clicks Post

System validates:
- Receipt is Draft
- source Purchase Order is Confirmed
- lines exist
- each line has an Item
- each line has qty > 0
- Warehouse is active
- Items are active
- no other Posted Receipt exists for the same Purchase Order

System result:
- Receipt status = Posted
- positive Stock Movements are created
- Stock Balance is increased
- linked Purchase Order status = Closed

### Purchase flow complete when
- Purchase Order is Closed
- Receipt is Posted
- balance increased
- movements created

## Sales Flow

### Flow summary
Draft SO -> Confirmed SO -> Draft Shipment -> Posted Shipment -> Closed SO

### Step 1: Create Sales Order
User:
- opens Sales Orders list
- clicks New
- fills Date, Customer, Warehouse, Lines
- saves document

System result:
- Sales Order is created
- status = Draft
- no stock change
- no movements

### Step 2: Confirm Sales Order
User:
- opens Draft Sales Order
- clicks Confirm

System validates:
- Date is filled
- Customer is selected and active
- Warehouse is selected and active
- at least one line exists
- each line has an Item
- each line has qty > 0
- all Items are active

System result:
- Sales Order status = Confirmed
- no stock change
- no movements
- document becomes non-editable

### Step 3: Create Shipment from Sales Order
User:
- opens Confirmed Sales Order
- clicks Create Shipment

System result:
- Draft Shipment is created
- Sales Order link is assigned
- Warehouse is copied
- lines are copied
- no stock change
- no movements

### Step 4: Post Shipment
User:
- opens Draft Shipment
- clicks Post

System validates:
- Shipment is Draft
- source Sales Order is Confirmed
- lines exist
- each line has an Item
- each line has qty > 0
- Warehouse is active
- Items are active
- enough stock exists for each line
- no other Posted Shipment exists for the same Sales Order

System result:
- Shipment status = Posted
- negative Stock Movements are created
- Stock Balance is decreased
- linked Sales Order status = Closed

### Sales flow complete when
- Sales Order is Closed
- Shipment is Posted
- balance decreased
- movements created

## Explicitly forbidden flow branches

### Purchase side
- Confirm invalid Purchase Order
- Create Receipt from Draft Purchase Order
- Post Receipt with no lines
- Post Receipt twice
- Create second Posted Receipt for same Purchase Order

### Sales side
- Confirm invalid Sales Order
- Create Shipment from Draft Sales Order
- Post Shipment with no lines
- Post Shipment with insufficient stock
- Post Shipment twice
- Create second Posted Shipment for same Sales Order

## Explicitly absent in MVP

Not included:
- partial receipt
- partial shipment
- multiple receipts per order
- multiple shipments per order
- reservation
- allocation
- picking
- packing
- reverse posting
- reopen flow
