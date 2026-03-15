    # Master Data Page Layout v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the concrete page layout for master data pages.

## Shared master data page structure

All master data pages include:
- breadcrumb
- title + code
- actions: Save / Cancel / Deactivate
- main details block
- optional secondary block

No tabs in MVP.

## Item Page

### Header
- Master Data > Items > ITEM-001
- Item ITEM-001

### Main details block
- Code
- Name
- UOM
- Active

### Secondary block
- Description

## Supplier Page

### Header
- Master Data > Suppliers > SUP-0001
- Supplier SUP-0001

### Main details block
- Code
- Name
- Active

### Secondary block
- Phone
- Email
- Comment

## Customer Page

### Header
- Master Data > Customers > CUS-0003
- Customer CUS-0003

### Main details block
- Code
- Name
- Active

### Secondary block
- Phone
- Email
- Comment

## Warehouse Page

### Header
- Master Data > Warehouses > WH-001
- Warehouse WH-001

### Main details block
- Code
- Name
- Active

### Secondary block
- Comment

## Deactivate meaning

Deactivate:
- does not delete the record
- prevents use in new documents
- keeps the record valid in historical documents

## Explicit exclusions
Not included in MVP:
- related documents tab
- audit block
- stock history for item
- attachments
- activity feed
