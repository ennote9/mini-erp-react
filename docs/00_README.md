    # Mini ERP MVP Documentation Pack

    - Version: MVP v0.1
    - Status: Index
    - Date: 2026-03-09

    This archive contains the baseline documentation set for the first working version of a small-business Mini ERP.

## Product intent

The product is a **small, working ERP core** for a small business. It is intentionally limited to:

- master data: Items, Suppliers, Customers, Warehouses
- purchase flow: Purchase Orders and Receipts
- sales flow: Sales Orders and Shipments
- inventory visibility: Stock Balances and Stock Movements
- dashboard, navigation shell, list/detail pages, and a strict enterprise UI baseline

The system is **not** trying to be a full ERP or WMS in v0.1.

## Documentation structure

### 01_product_core
Core product definition and business logic:
- MVP overview
- domain model
- statuses and rules
- document flows
- validation rules
- acceptance criteria
- scope freeze

### 02_screens_and_navigation
Product map and application structure:
- screen inventory
- app shell and navigation
- screen-to-screen navigation map

### 03_ui_ux_patterns
UI and UX standards:
- list page pattern
- object page pattern
- document page layout
- master data page layout
- form layout pattern
- create/edit pattern
- dashboard spec
- numbering and naming rules
- grid columns
- grid interaction rules
- empty/loading/error states
- UI consistency rules

### 04_growth_and_roadmap
Future growth guidance:
- out of scope / future expansion map

## Core operating constraints for v0.1

- UI language: English
- Discussion language: Russian
- Theme direction: dark-first, but light-ready
- Desktop-first enterprise application shell
- One operational warehouse in MVP logic, but Warehouse remains a full entity
- No reservation logic
- No partial receipt
- No partial shipment
- One Purchase Order -> one Receipt
- One Sales Order -> one Shipment
- Posted Receipt / Shipment can be **fully reversed once** (reason required, compensating stock movements); no partial reversal in MVP
- Stock Balance is stored physically and updated by posting, but is logically derived from stock movements
- Receipt and Shipment are created only from their source documents

## Suggested implementation order

1. MVP_Overview
2. Domain_Model
3. Statuses_and_Rules
4. Document_Flows
5. Validation_Rules
6. Acceptance_Criteria_v0.1
7. MVP_Scope_Freeze_v0.1
8. Screens_v1
9. Navigation_and_App_Shell_v1
10. Screen_to_Screen_Navigation_Map_v1
11. List_Page_Pattern_v1
12. Object_Page_Pattern_v1
13. Document_Page_Layout_v1
14. Master_Data_Page_Layout_v1
15. Form_Layout_Pattern_v1
16. Create_Edit_Pattern_v1
17. Dashboard_v1
18. Document_Numbering_and_Naming_Rules_v1
19. Data_Grid_Column_Definitions_v1
20. Grid_Interaction_Rules_v1
21. Empty_Loading_Error_States_v1
22. UI_Consistency_Rules_v1
23. Out_of_Scope_and_Future_Expansion_Map
