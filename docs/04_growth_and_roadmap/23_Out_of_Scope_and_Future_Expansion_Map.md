    # Out of Scope and Future Expansion Map

    - Version: MVP v0.1
    - Status: Baseline
    - Date: 2026-03-09

    ## Purpose

This document maps future growth without polluting MVP scope.

## Product evolution layers

### v0.1
Working inventory core:
- master data
- purchase orders
- receipts
- sales orders
- shipments
- balances
- movements
- dashboard
- shell and page patterns

### v0.2
First strengthening wave:
- adjustments
- richer dashboard
- stronger traceability
- better detail/inspection pages for balances and movements
- stronger usability and feedback

### v1.0+
Mature product layer:
- partial receipt / shipment
- multiple receipts / shipments per order
- returns
- transfer logic
- pricing / amounts / taxes
- roles and permissions
- approvals
- richer reporting
- advanced grid tooling

### Future Ecosystem
Multi-module platform growth:
- CRM layer
- expanded purchasing intelligence
- WMS layer
- finance / accounting layer
- analytics layer
- platform services (notifications, shared search, workflow engine, shared view management)

## Examples of feature classification

### Likely v0.2
- inventory adjustment document
- better dashboard blocks
- movement inspection page
- balance inspection page

### Likely v1.0+
- partial operations
- returns
- pricing
- permissions
- advanced filter/sort/view behavior

### Likely future ecosystem
- CRM
- WMS execution logic
- finance module
- BI platform
- cross-module platform services

## Feature decision rule

For any new feature ask:
1. Is it required for the core end-to-end MVP flow?
2. Does it strengthen the existing core, or create a new logic branch?
3. Is it needed immediately after first launch, or only “nice to have”?
4. Is it module-local or platform-level?

If it creates a new branch or a platform layer, it is not v0.1.
