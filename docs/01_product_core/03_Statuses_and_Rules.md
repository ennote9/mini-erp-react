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
- view
- **reverse once** (full reversal — reason recorded; creates compensating movements)

Not allowed:
- edit content
- post again

Stock impact:
- yes, positive stock movements and balance update; reversal applies the inverse via `receipt_reversal` movements

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

### Reversed
Meaning:
- posted receipt was **fully reversed** once; document remains for audit

Allowed:
- view only

Not allowed:
- edit
- post
- reverse again

Stock impact:
- compensating movements restored available stock per implemented rules

### Allowed transitions
- Draft -> Posted
- Draft -> Cancelled
- Posted -> Reversed (single reversal)

### Forbidden transitions
- Draft -> Reversed
- Cancelled -> any non-terminal transition except view
- Reversed -> any other status
- Posted -> Cancelled *(use reversal, not cancel)*

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
- view
- **reverse once** (full reversal — reason recorded; compensating movements; linked sales order returns to **confirmed** for rework per code)

Not allowed:
- edit content
- post again

Stock impact:
- yes, negative stock movements and balance update; reversal applies compensating `shipment_reversal` movements

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

### Reversed
Meaning:
- posted shipment was **fully reversed** once

Allowed:
- view only

Not allowed:
- edit
- post
- reverse again

Stock impact:
- compensating movements per reversal implementation; reservations reconciled

### Allowed transitions
- Draft -> Posted
- Draft -> Cancelled
- Posted -> Reversed (single reversal)

### Forbidden transitions
- Draft -> Reversed
- Cancelled -> active editing
- Reversed -> any other status
- Posted -> Cancelled *(use reversal, not cancel)*

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
- Posted Receipt *(content locked; reversal is a separate action)*
- Posted Shipment *(content locked; reversal is a separate action)*
- Reversed Receipt / Shipment
- Cancelled documents

## Global accounting rules

1. Draft does not affect stock.
2. Confirmed does not affect stock.
3. Posted Receipt increases stock.
4. Posted Shipment decreases stock.
5. Closed is a completion state for planning documents, not a posting state.
6. Full **reversal** from posted creates compensating movements and transitions factual document to **reversed** (single reversal per document in current rules).

## Source-document rules

Receipt may be created only if:
- source Purchase Order exists
- source Purchase Order is Confirmed
- no Posted Receipt already exists for that order

Shipment may be created only if:
- source Sales Order exists
- source Sales Order is Confirmed
- no Posted Shipment already exists for that order

## Explicitly excluded or partial status concepts

Still **not** modeled as first-class document statuses (examples):
- Partially Received / Partially Shipped (as statuses)
- Reopened planning documents
- On Hold
- Picked / Packed / wave picking
- Approval chains
- Payment-settled statuses

**Implemented today (was “excluded” in original MVP text):**
- **Reversed** — terminal factual status after a single full reversal from **posted**.
- **Reservations** — separate persisted records (not the same as a document status); see `08_Current_Product_State.md`.
