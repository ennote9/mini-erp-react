    # Statuses and Rules

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the status model and lifecycle rules for all documents in MVP v0.1.

## Status model overview

### Planning documents
- Purchase Order
- Sales Order

Allowed statuses:
- Draft
- Confirmed
- Closed
- Cancelled

### Factual documents
- Receipt
- Shipment

Allowed statuses:
- Draft
- Posted
- Cancelled

## Purchase Order

### Draft
Meaning:
- order exists but is still editable

Allowed:
- edit header
- edit lines
- save
- confirm
- cancel document

Not allowed:
- create receipt
- affect stock

Stock impact:
- none

### Confirmed
Meaning:
- order is fixed and ready for receipt creation

Allowed:
- create receipt
- cancel document
- view document

Not allowed:
- edit document content
- affect stock directly

Stock impact:
- none

### Closed
Meaning:
- factual receipt already completed for this order

Allowed:
- view only

Not allowed:
- edit
- cancel
- create another receipt

Stock impact:
- none directly; closure reflects completion of a Posted Receipt

### Cancelled
Meaning:
- order is abandoned and removed from process

Allowed:
- view only

Not allowed:
- edit
- confirm
- create receipt

Stock impact:
- none

### Allowed transitions
- Draft -> Confirmed
- Draft -> Cancelled
- Confirmed -> Closed
- Confirmed -> Cancelled

### Forbidden transitions
- Draft -> Closed directly
- Confirmed -> Draft
- Closed -> any other status
- Cancelled -> any other status

## Receipt

### Draft
Meaning:
- receipt document prepared but not posted

Allowed:
- edit header
- edit lines
- save
- post
- cancel document

Not allowed:
- affect stock

Stock impact:
- none

### Posted
Meaning:
- factual receipt completed and recorded in inventory

Allowed:
- view only

Not allowed:
- edit
- reverse posting
- post again

Stock impact:
- yes, positive stock movements and balance update

### Cancelled
Meaning:
- receipt cancelled before posting

Allowed:
- view only

Not allowed:
- edit
- post

Stock impact:
- none

### Allowed transitions
- Draft -> Posted
- Draft -> Cancelled

### Forbidden transitions
- Posted -> any other status
- Cancelled -> any other status
- Posted -> Cancelled in MVP

## Sales Order

### Draft
Meaning:
- order exists but is still editable

Allowed:
- edit header
- edit lines
- save
- confirm
- cancel document

Not allowed:
- create shipment
- affect stock

Stock impact:
- none

### Confirmed
Meaning:
- order is fixed and ready for shipment creation

Allowed:
- create shipment
- cancel document
- view document

Not allowed:
- edit document content
- affect stock directly

Stock impact:
- none

### Closed
Meaning:
- factual shipment already completed for this order

Allowed:
- view only

Not allowed:
- edit
- cancel
- create another shipment

Stock impact:
- none directly; closure reflects completion of a Posted Shipment

### Cancelled
Meaning:
- order is abandoned and removed from process

Allowed:
- view only

Not allowed:
- edit
- confirm
- create shipment

Stock impact:
- none

### Allowed transitions
- Draft -> Confirmed
- Draft -> Cancelled
- Confirmed -> Closed
- Confirmed -> Cancelled

### Forbidden transitions
- Draft -> Closed directly
- Confirmed -> Draft
- Closed -> any other status
- Cancelled -> any other status

## Shipment

### Draft
Meaning:
- shipment prepared but not posted

Allowed:
- edit header
- edit lines
- save
- post
- cancel document

Not allowed:
- affect stock

Stock impact:
- none

### Posted
Meaning:
- factual shipment completed and recorded in inventory

Allowed:
- view only

Not allowed:
- edit
- reverse posting
- post again

Stock impact:
- yes, negative stock movements and balance update

### Cancelled
Meaning:
- shipment cancelled before posting

Allowed:
- view only

Not allowed:
- edit
- post

Stock impact:
- none

### Allowed transitions
- Draft -> Posted
- Draft -> Cancelled

### Forbidden transitions
- Posted -> any other status
- Cancelled -> any other status
- Posted -> Cancelled in MVP

## Global editing rules

Editable:
- Draft Purchase Order
- Draft Sales Order
- Draft Receipt
- Draft Shipment

Not editable:
- Confirmed Purchase Order
- Confirmed Sales Order
- Closed Purchase Order
- Closed Sales Order
- Posted Receipt
- Posted Shipment
- Cancelled documents

## Global accounting rules

1. Draft does not affect stock.
2. Confirmed does not affect stock.
3. Posted Receipt increases stock.
4. Posted Shipment decreases stock.
5. Closed is a completion state for planning documents, not a posting state.

## Source-document rules

Receipt may be created only if:
- source Purchase Order exists
- source Purchase Order is Confirmed
- no Posted Receipt already exists for that order

Shipment may be created only if:
- source Sales Order exists
- source Sales Order is Confirmed
- no Posted Shipment already exists for that order

## Explicitly excluded status concepts

Not included in MVP:
- Partially Received
- Partially Shipped
- Reopened
- Reversed
- On Hold
- Allocated
- Picked
- Packed
- Approval statuses
- Payment statuses
