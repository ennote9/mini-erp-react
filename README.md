# Mini ERP (React + Tauri)

Desktop-first **mini ERP** for small businesses: master data, purchase and sales documents, inventory (including **reservations**), logistics (**carriers**, delivery metadata, tracking), printable **customer documents** and **delivery sheets** (print + PDF), **settings** (workspace profile, documents, inventory, commercial, audit), and **i18n**. Data is stored **locally**; the UI is built with **React**, **TypeScript**, and **Vite**, packaged with **Tauri**.

## Documentation

Authoritative **current-state** description (kept aligned with the codebase):

- [`docs/01_product_core/08_Current_Product_State.md`](docs/01_product_core/08_Current_Product_State.md)

Index and older baseline docs:

- [`docs/00_README.md`](docs/00_README.md)

## Development

Prerequisites: Node.js, Rust toolchain (for Tauri).

```bash
npm install
npm run dev          # Vite web dev
npm run tauri dev    # Desktop app
npm run build        # Typecheck + production Vite build
```

## Tech stack

- **Frontend:** React 19, React Router, Tailwind/shadcn-style UI
- **Desktop:** Tauri 2
- **State:** Module repositories + local file persistence; lightweight **read-model revision** for key UI freshness (no global Redux-style store)

This repository started from the default Tauri + React + TS template; the **product** is defined by `docs/` and `src/`, not the template README text.
