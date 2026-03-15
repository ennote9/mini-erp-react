    # Empty / Loading / Error States v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines empty, loading, error, and success feedback behavior.

## State categories

### Empty
Data is absent.

### Loading
Data is still being loaded.

### Error
System failed to load data or complete an action.

These states must look different.

## Empty states for list pages

Examples:
- No items yet / Create your first item to start working with inventory
- No suppliers yet / Create your first supplier to start purchasing workflow
- No purchase orders yet / Create your first purchase order to start purchasing workflow
- No stock movements yet / Movements will appear after posting receipts and shipments

## Filtered-empty states
Examples:
- No items match current search
- No purchase orders match current filters
- No stock movements found for current criteria

## Dashboard empty behavior
- summary cards show zero
- latest lists show empty states
- dashboard remains usable

## Loading states

### List pages
Use:
- skeleton rows
or
- table placeholders

### Object pages
Use:
- skeleton header
- skeleton summary block
- skeleton content area

### Dashboard
Prefer block-level skeletons:
- cards
- latest lists
- movement block

## Error states

### Page load error
Show:
- clear title
- short explanation
- Retry action

Examples:
- Unable to load purchase orders
- Unable to load item data

### Validation error
Show inline, near the field where possible.

### Action error
Examples:
- Unable to post shipment
- Insufficient stock for item ITEM-001
- Posted documents cannot be edited

## Retry
Retry should be available on page load errors.

## Success feedback
Short success feedback is allowed for:
- Item saved
- Purchase order confirmed
- Receipt posted
- Shipment posted

## What must not happen
- empty state must not be confused with error
- loading must not be confused with empty
- technical exception text must not be shown to end users
- critical error must not disappear instantly with only a transient toast
