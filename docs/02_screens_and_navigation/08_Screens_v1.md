    # Screens v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document lists all MVP screens and their responsibilities.

## Dashboard
Purpose:
- system overview
- quick navigation
- latest activity visibility

Can:
- show summary cards
- show latest documents and movements
- navigate to modules

Cannot:
- create documents directly
- post or confirm documents
- edit master data

## Items
Purpose:
- list all items

Can:
- search
- filter
- open Item page
- create Item
- deactivate Item

Cannot:
- change stock
- post inventory actions

## Item Page
Purpose:
- maintain one Item

Can:
- edit Item
- save
- deactivate

Cannot:
- change stock
- execute inventory actions

## Suppliers
Purpose:
- list all suppliers

Can:
- search
- filter
- open Supplier page
- create Supplier
- deactivate Supplier

Cannot:
- create purchasing fact documents directly

## Supplier Page
Purpose:
- maintain one Supplier

Can:
- edit
- save
- deactivate

Cannot:
- perform inventory actions

## Customers
Purpose:
- list all customers

Can:
- search
- filter
- open Customer page
- create Customer
- deactivate Customer

Cannot:
- create shipment directly

## Customer Page
Purpose:
- maintain one Customer

Can:
- edit
- save
- deactivate

Cannot:
- perform inventory actions

## Warehouses
Purpose:
- list all warehouses

Can:
- search
- filter
- open Warehouse page
- create Warehouse
- deactivate Warehouse

Cannot:
- change stock manually

## Warehouse Page
Purpose:
- maintain one Warehouse

Can:
- edit
- save
- deactivate

Cannot:
- change stock manually
- create movements

## Purchase Orders
Purpose:
- list all purchase orders

Can:
- search
- filter
- open Purchase Order page
- create Purchase Order

Cannot:
- post receipt directly from list
- use bulk document actions in MVP

## Purchase Order Page
Purpose:
- work with a single purchase order

Can in Draft:
- edit
- save
- confirm
- cancel document

Can in Confirmed:
- create receipt
- cancel document

Can in Closed / Cancelled:
- view only

## Receipts
Purpose:
- list all receipts

Can:
- search
- filter
- open Receipt page

Cannot:
- create Receipt via New button

## Receipt Page
Purpose:
- work with one receipt

Can in Draft:
- edit
- save
- post
- cancel document

Can in Posted / Cancelled:
- view only

## Sales Orders
Purpose:
- list all sales orders

Can:
- search
- filter
- open Sales Order page
- create Sales Order

Cannot:
- post shipment directly from list
- use bulk document actions in MVP

## Sales Order Page
Purpose:
- work with one sales order

Can in Draft:
- edit
- save
- confirm
- cancel document

Can in Confirmed:
- create shipment
- cancel document

Can in Closed / Cancelled:
- view only

## Shipments
Purpose:
- list all shipments

Can:
- search
- filter
- open Shipment page

Cannot:
- create Shipment via New button

## Shipment Page
Purpose:
- work with one shipment

Can in Draft:
- edit
- save
- post
- cancel document

Can in Posted / Cancelled:
- view only

## Stock Balances
Purpose:
- show current inventory balances

Can:
- search
- filter
- review balances

Cannot:
- edit balance
- create balance entries
- post inventory actions

Note:
- no dedicated detail page in MVP

## Stock Movements
Purpose:
- show inventory movement history

Can:
- search
- filter
- open source document from movement record

Cannot:
- edit movement
- delete movement
- create movement manually

Note:
- no dedicated movement detail page in MVP
