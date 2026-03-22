# Mini ERP — documentation pack

- **Index status:** maintained
- **Last doc sync:** 2026-03-22

## How to read this folder

1. **`01_product_core/08_Current_Product_State.md`** — **Start here** for *what the app does today* (aligned with the local codebase).
2. **`01_MVP_Overview.md` … `07_MVP_Scope_Freeze_v0.1.md`** — original **MVP v0.1 baseline** (historical). They are useful for intent and early constraints; when they conflict with code, **prefer `08` and the code**.
3. **`02_screens_and_navigation`** — screen inventory, shell, navigation maps (partially updated for current routes; cross-check `08` and `src/app/routes.tsx`).
4. **`03_ui_ux_patterns`** — UI standards (list pages, document layout, dashboard, grids, etc.).
5. **`04_growth_and_roadmap`** — intentionally out-of-scope / future ideas (not a promise of current features).

## Product intent (current)

A **desktop-first mini ERP** for small-business operations: **master data**, **planning vs factual documents**, **inventory and reservations**, **logistics fields and carriers**, **print/PDF handoffs**, **settings and i18n**, and **local persistence** (Tauri).

## Documentation structure

### 01_product_core

| Doc | Role |
|-----|------|
| `01_MVP_Overview` | Historical MVP narrative |
| `02_Domain_Model` | Core entities + **appendix** for extensions in code |
| `03_Statuses_and_Rules` | Status model; **includes reversal** where implemented |
| `04_Document_Flows` | Purchase/sales steps + **additions** (reversal, reservations, docs) |
| `05_Validation_Rules` | Validation baseline |
| `06_Acceptance_Criteria_v0.1` | Historical acceptance |
| `07_MVP_Scope_Freeze_v0.1` | Historical scope freeze |
| **`08_Current_Product_State`** | **Code-aligned current product** |

### 02_screens_and_navigation

- Screen inventory, app shell, navigation map.

### 03_ui_ux_patterns

- List/object/document/master layouts, dashboard, grids, consistency.

### 04_growth_and_roadmap

- Out of scope / expansion map (future-oriented).

## Suggested reading order (new contributor)

1. `01_product_core/08_Current_Product_State.md`
2. `02_screens_and_navigation/08_Screens_v1.md` + `10_Screen_to_Screen_Navigation_Map_v1.md`
3. `03_ui_ux_patterns/11_List_Page_Pattern_v1.md`, `13_Document_Page_Layout_v1.md`
4. Older MVP docs as needed for background

## Implementation note

UI language and copy are **localized** (see app settings). Original MVP docs assumed English-only discussion; the product now supports **multiple locales** in code.
