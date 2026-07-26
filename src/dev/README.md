# Dev-only tooling

## Purchasing / sales operational reset

`resetPurchasingSalesOperationalStores` clears **persisted** purchasing and sales operational JSON (PO, receipts, SO, shipments, payments, stock movements/reservations/balances, audit events) and filters **operational** rows out of `entity-attachments.json` (`order` / `shipment` only). It does **not** change business rules in services — only files on disk / localStorage mirrors.

**Preserved:** items, master data (suppliers, customers, warehouses, brands, categories, …), customer agreements, label templates, app settings, markdown master-data, and entity attachments for `customer` / `agreement`.

**After a real reset:** restart the desktop app or hard-reload the web view so repositories bootstrap from the cleared files.

**Plain Vite / browser (`npm run dev` without Tauri):** `shouldUseTauriPluginFs()` is false. The reset clears operational data in **browser localStorage** (and still uses `writeDocumentPayload` / `writeInventoryPayload`, which fall back to localStorage when disk I/O fails). **AppLocalData JSON files are not modified** in that mode. The result includes `persistenceMode: "browser_local_storage_only"` and warnings that state disk was not cleared. Entity attachment row filtering uses the **localStorage mirror** for `documents/entity-attachments.json` when present; if there is no mirror, filtering is skipped with a warning (customer/agreement rows are never deleted blindly).

**Document load in the browser:** `loadDocumentsPersisted` now matches inventory: when Tauri file APIs are off, it **only** reads/writes the `mini-erp-documents-v1:*` localStorage mirror (or first-run seed if the key is absent). It does **not** read AppLocalData JSON from disk, so a browser-only reset cannot be overridden by stale on-disk `documents/*.json` files.

### Backup

Export a workspace backup from Settings (or copy your Tauri `AppLocalData` store) before running a real reset.

### Dry run (no writes)

1. Start the app in development (`npm run dev` or `npm run tauri dev`).
2. Open DevTools → Console.
3. Run:

```js
await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.dryRun();
```

Inspect the returned object: `clearedPaths` lists what **would** be touched (dry run lists targets; nothing is written).

**CI / smoke (mock filesystem):** `npm run dev:reset-purchasing-sales:dry` runs a small Vitest file that calls the same helper with `dryRun: true`.

### Real reset (destructive)

You must satisfy **one** of:

- Set environment variable **`VITE_CONFIRM_RESET_PURCHASING_SALES=YES`** when starting the Vite dev server (e.g. PowerShell: `$env:VITE_CONFIRM_RESET_PURCHASING_SALES='YES'; npm run dev`), **then** run:

  ```js
  await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.executeReset();
  ```

- **Or** pass the explicit token (works without the env var):

  ```js
  await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.executeReset({
    confirm: "RESET_PURCHASING_SALES",
  });
  ```

There is **no** Settings UI button for this; it is dev tooling only.

### Printed help

```bash
npm run dev:reset-purchasing-sales:help
```
