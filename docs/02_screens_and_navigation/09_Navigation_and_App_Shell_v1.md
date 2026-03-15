    # Navigation and App Shell v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the stable application shell and navigation behavior.

## Shell layout

### Left Sidebar
Persistent navigation area.

### Main Workspace
Primary working area on the right.

Inside Main Workspace:
- Page Top Bar
- Page Content

## Sidebar principles

Sidebar must be:
- dark
- enterprise-style
- vertical
- structured
- calm
- modular

Sidebar must support:
- expanded mode
- collapsed mode
- grouped navigation
- active state indication

## Sidebar structure

### Dashboard

### Master Data
- Items
- Suppliers
- Customers
- Warehouses

### Purchasing
- Purchase Orders
- Receipts

### Sales
- Sales Orders
- Shipments

### Inventory
- Stock Balances
- Stock Movements

## Sidebar behavior

### Expanded
Shows:
- icons
- labels
- groups
- nested entries

### Collapsed
Shows:
- compact icon-first layout
- reduced width
- more content space for the workspace

### Group behavior
- groups can expand/collapse
- active group is visually clear
- active page is visually clear

## Page Top Bar

Must contain:
- page title
- breadcrumb where relevant
- page-level actions

### List pages
Usually:
- title
- New button if allowed

### Object pages
Usually:
- breadcrumb
- title + identifier
- status if relevant
- object actions

## Breadcrumb rules

### Required on
- all object pages

### Optional on
- simple list pages where context is already obvious

## Consistency requirements

The following must remain stable across the system:
- sidebar behavior
- active state logic
- page top bar placement
- breadcrumb placement
- list/detail navigation pattern
- shell spacing and hierarchy

## Explicit exclusions for MVP shell

Not included:
- favorites
- recent pages
- global command palette
- universal cross-module search
- admin/settings mega sections
