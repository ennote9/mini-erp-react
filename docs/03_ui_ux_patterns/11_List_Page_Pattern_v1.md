    # List Page Pattern v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the standard structure for all list pages.

## Role of a list page

A list page is the main working entry point to a module. It supports:
- viewing records
- searching
- filtering
- sorting
- selecting records
- opening object pages
- creating new records where allowed

## Standard structure

### A. Page Header
- page title
- primary action (New) if allowed

### B. Controls Bar
- search
- filter

### C. Data Grid
Main page element.

### D. Optional Selection Bar
Only when row selection is meaningful.

## New button rules

### New is visible on:
- Items
- Suppliers
- Customers
- Warehouses
- Purchase Orders
- Sales Orders

### New is not visible on:
- Receipts
- Shipments
- Stock Balances
- Stock Movements

## Search principles

- one clear search field
- no advanced modes in MVP
- scoped to the current screen only

## Filter principles

- simple
- screen-specific
- not a global query builder

## Grid principles

- enterprise-style
- dense
- desktop-first
- calm and readable

## Required list page states
- normal
- loading
- empty
- filtered-empty
- error where relevant

## Explicit exclusions
Not included in MVP:
- advanced view manager
- saved views
- grouping
- inline editing
- drag-and-drop columns
- complex bulk document actions
