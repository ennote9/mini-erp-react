    # Form Layout Pattern v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the common layout and behavior of forms.

## Layout rules

### Master data forms
- 2-column layout on wide desktop pages
- 1-column fallback on narrow widths
- minimal visual fragmentation

### Document forms
- summary / overview fields in 2-column layout
- document lines separated into their own tab/area

## Field grouping

### Item
- Basic Information: Code, Name, UOM, Active
- Additional: Description

### Supplier / Customer
- Basic Information: Code, Name, Active
- Contact: Phone, Email
- Additional: Comment

### Warehouse
- Basic Information: Code, Name, Active
- Additional: Comment

### Documents
- Document: Number, Date, Status
- Business Context: Supplier / Customer / Related Document, Warehouse
- Additional: Comment

## Required fields
Required fields must be visually marked consistently.

Examples:
- Code *
- Name *
- Date *
- Supplier *
- Customer *
- Warehouse *

## Field types

- Text input: code, name, phone, email
- Date picker: date
- Lookup / searchable select: supplier, customer, warehouse, item
- Toggle / checkbox: active
- Textarea: comment, description

## Read-only fields
System-controlled fields are read-only:
- Number
- Status
- UOM on document lines (derived from Item)

## Document line pattern
Each line contains:
- Item
- Qty
- UOM

Rules:
- Item via lookup
- Qty entered manually
- UOM auto-derived
- duplicate Items in same document are not allowed in MVP

## Validation display
- field-level messages for field errors
- page/document-level message for process-level failures
- no technical error text for end users

## Save / Cancel behavior
- Save validates and persists
- Cancel does not persist anything accidentally
