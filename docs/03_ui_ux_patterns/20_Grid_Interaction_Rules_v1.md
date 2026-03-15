    # Grid Interaction Rules v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines how grids behave across the product.

## Core interaction model

### Row click
- opens object page where applicable

### Checkbox click
- selects row
- does not open object page

### Header click
- changes sorting

### Search
- filters current screen result set

### Filter
- applies screen-specific filters

## Exceptions for no-detail screens

### Stock Balances
- no dedicated detail page in MVP
- row click is not required

### Stock Movements
- no dedicated detail page in MVP
- Source Document link opens Receipt or Shipment page

## Selection behavior
- selected rows have clear selected state
- selected state differs from hover state
- header checkbox may be supported

## Hover behavior
- rows show visible but calm hover state

## Sorting behavior
Single-column sorting only:
1. ascending
2. descending
3. no sort

No multi-sort in MVP.

## Search behavior
- scoped to current list page
- works together with filters
- filtered-empty state differs from empty database state

## Filter behavior
- simple
- screen-specific
- not a global query builder

## Status badge behavior
- informational only
- not interactive in MVP

## Selection bar
Allowed mainly for master data lists where bulk deactivate may later apply.

Not used for bulk document lifecycle actions in MVP.

## Explicit exclusions
Not included:
- inline editing
- drag-and-drop columns
- grouping
- advanced context menu
- saved views
- advanced bulk document actions
