    # Object Page Pattern v1

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document defines the standard structure for all record detail pages.

## Role of an object page

An object page supports:
- full record visibility
- editing where allowed
- context visibility
- record-specific actions

## Standard structure

### A. Breadcrumb
Required on object pages.

### B. Header
Contains:
- object type
- business identifier
- status where relevant
- actions

### C. Summary Area
Shows core information quickly.

### D. Main Content
Varies by object type:
- simpler for master data
- tabbed for documents

## Object page categories

### Master Data Page
- simple
- no lifecycle actions
- no document lines
- no tabs in MVP

### Document Page
- status-aware
- process actions
- lines
- Overview / Lines tabs

## Read-only behavior

View mode must be clear when:
- document is Confirmed
- document is Closed
- document is Posted
- document is Cancelled

## Core consistency rules
- breadcrumb always present
- title always uses business identifier
- actions always live in object action area
- documents and master data do not share the same complexity level
