/**
 * Dev / internal tooling only — destructive reset of purchasing & sales **persisted** stores.
 *
 * - Does not run on import.
 * - Not wired to UI.
 * - With Tauri: writes empty `{ version: 1, records: [] }` to AppLocalData JSON and clears localStorage mirrors.
 * - In plain browser (Vite without Tauri): clears operational data in **browser localStorage mirrors only**;
 *   AppLocalData disk files are not modified.
 * - In-memory repository singletons are **not** updated; reload the app or `vi.resetModules()` in tests.
 */

import { BaseDirectory, exists, readFile } from "@tauri-apps/plugin-fs";
import {
  readDocumentEnvelopeFromBrowserLocalStorage,
  removeDocumentLocalStorageMirror,
  writeDocumentPayload,
  writeDocumentPayloadToBrowserLocalStorageOnly,
} from "@/shared/documentPersistence";
import {
  removeInventoryLocalStorageMirror,
  writeInventoryPayload,
} from "@/shared/inventoryPersistence";
import { flushAllPendingPersistence } from "@/shared/persistenceCoordinator";
import { shouldUseTauriPluginFs } from "@/shared/tauriRuntime";

const PERSIST_VERSION = 1 as const;

/** Relative paths under `BaseDirectory.AppLocalData` cleared to an empty envelope. */
export const RESET_PURCHASING_SALES_DOCUMENT_STORE_PATHS = [
  "documents/purchase-orders.json",
  "documents/receipts.json",
  "documents/sales-orders.json",
  "documents/shipments.json",
  "documents/purchase-order-payments.json",
  "documents/sales-order-payments.json",
  "documents/audit/events.json",
] as const;

export const RESET_PURCHASING_SALES_INVENTORY_STORE_PATHS = [
  "inventory/stock-movements.json",
  "inventory/stock-reservations.json",
  "inventory/stock-balances.json",
] as const;

const ENTITY_ATTACHMENTS_RELATIVE_PATH = "documents/entity-attachments.json" as const;

/** Operational attachment entity types (see `EntityAttachmentType`); `customer` and `agreement` are preserved. */
const OPERATIONAL_ENTITY_ATTACHMENT_TYPES = new Set<string>(["order", "shipment"]);

export type ResetPurchasingSalesPersistenceMode = "tauri_files" | "browser_local_storage_only";

export type ResetPurchasingSalesOperationalStoresResult = {
  success: boolean;
  dryRun: boolean;
  /** How persistence was targeted for this run (dry-run infers from current environment). */
  persistenceMode?: ResetPurchasingSalesPersistenceMode;
  /** Paths written to an empty envelope (excluding filtered entity-attachments). */
  clearedPaths: string[];
  /** Paths that were not modified (unused; reserved for future skips). */
  skippedPaths: string[];
  warnings: string[];
  errors: string[];
  /** Rows removed from `entity-attachments.json` (operational types only); undefined if dry-run or file missing/invalid. */
  entityAttachmentOperationalRowsRemoved?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object";
}

async function filterEntityAttachmentsOnDisk(
  warnings: string[],
  clearedPaths: string[],
): Promise<number | undefined> {
  const path = ENTITY_ATTACHMENTS_RELATIVE_PATH;
  const fileExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
  if (!fileExists) {
    return undefined;
  }

  let text: string;
  try {
    const bytes = await readFile(path, { baseDir: BaseDirectory.AppLocalData });
    text = new TextDecoder().decode(bytes);
  } catch (e) {
    warnings.push(
      `Could not read ${path} to filter operational attachments: ${e instanceof Error ? e.message : String(e)}`,
    );
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    warnings.push(`${path} is not valid JSON; operational attachment rows were not filtered.`);
    return undefined;
  }

  if (!isRecord(parsed)) {
    warnings.push(`${path} has unexpected shape; skipped entity attachment filtering.`);
    return undefined;
  }

  const recordsRaw = parsed.records;
  const version = parsed.version;
  if (version !== PERSIST_VERSION || !Array.isArray(recordsRaw)) {
    warnings.push(`${path} is not a v1 envelope; skipped entity attachment filtering.`);
    return undefined;
  }

  const before = recordsRaw.length;
  const kept = recordsRaw.filter((row) => {
    if (!isRecord(row)) return true;
    const t = row.entityType;
    if (typeof t !== "string") return true;
    return !OPERATIONAL_ENTITY_ATTACHMENT_TYPES.has(t);
  });
  const removed = before - kept.length;
  if (removed > 0) {
    await writeDocumentPayload(path, kept);
    clearedPaths.push(path);
    removeDocumentLocalStorageMirror(path);
  }
  return removed;
}

/**
 * Filters operational attachment rows using the browser localStorage mirror only (no plugin-fs).
 */
function filterEntityAttachmentsBrowserOnly(
  warnings: string[],
  clearedPaths: string[],
): number | undefined {
  const path = ENTITY_ATTACHMENTS_RELATIVE_PATH;
  const envelope = readDocumentEnvelopeFromBrowserLocalStorage(path);
  if (!envelope) {
    warnings.push(
      "Entity attachments were not filtered because no browser localStorage mirror was found for documents/entity-attachments.json and Tauri file persistence is unavailable. Operational localStorage stores were still cleared where possible.",
    );
    return undefined;
  }

  const recordsRaw = envelope.records;
  const before = recordsRaw.length;
  const kept = recordsRaw.filter((row) => {
    if (!isRecord(row)) return true;
    const t = row.entityType;
    if (typeof t !== "string") return true;
    return !OPERATIONAL_ENTITY_ATTACHMENT_TYPES.has(t);
  });
  const removed = before - kept.length;
  if (removed > 0) {
    const ok = writeDocumentPayloadToBrowserLocalStorageOnly(path, kept);
    if (!ok) {
      warnings.push(
        "Entity attachments could not be written to browser localStorage (storage unavailable or full). Operational order/shipment attachment rows may remain until storage is writable.",
      );
      return undefined;
    }
    clearedPaths.push(path);
  }
  return removed;
}

/**
 * Clears purchasing/sales operational persistence to empty stores.
 *
 * When `dryRun` is true: no flush, no writes; returns planned paths only.
 */
export async function resetPurchasingSalesOperationalStores(
  options?: { dryRun?: boolean },
): Promise<ResetPurchasingSalesOperationalStoresResult> {
  const dryRun = options?.dryRun ?? false;
  const clearedPaths: string[] = [];
  const skippedPaths: string[] = [];
  const warnings: string[] = [
    "This helper only updates persisted files / localStorage mirrors. Reload modules or restart the app so repository in-memory state matches disk.",
  ];
  const errors: string[] = [];
  const tauriFs = shouldUseTauriPluginFs();

  const plannedDocumentPaths = [...RESET_PURCHASING_SALES_DOCUMENT_STORE_PATHS];
  const plannedInventoryPaths = [...RESET_PURCHASING_SALES_INVENTORY_STORE_PATHS];

  if (dryRun) {
    const dryWarnings = [
      ...warnings,
      "Dry run: no flush and no disk writes. `clearedPaths` lists paths that would be affected.",
    ];
    if (!tauriFs) {
      dryWarnings.push(
        "Dry run (browser-only): reset would clear operational data in browser localStorage keys (prefixes mini-erp-documents-v1: and mini-erp-inventory-v1:) for the listed relative paths. AppLocalData JSON files would not be modified without Tauri.",
      );
      dryWarnings.push(
        "Dry run (browser-only): entity attachment filtering would use the localStorage mirror for documents/entity-attachments.json if present; otherwise filtering is skipped with a warning.",
      );
    }
    return {
      success: true,
      dryRun: true,
      persistenceMode: tauriFs ? "tauri_files" : "browser_local_storage_only",
      clearedPaths: [
        ...plannedDocumentPaths,
        ...plannedInventoryPaths,
        `${ENTITY_ATTACHMENTS_RELATIVE_PATH} (filter-only: remove entityType order/shipment rows)`,
      ],
      skippedPaths,
      warnings: dryWarnings,
      errors,
      entityAttachmentOperationalRowsRemoved: undefined,
    };
  }

  try {
    await flushAllPendingPersistence();
  } catch (e) {
    errors.push(`flushAllPendingPersistence failed: ${e instanceof Error ? e.message : String(e)}`);
    return {
      success: false,
      dryRun: false,
      persistenceMode: tauriFs ? "tauri_files" : "browser_local_storage_only",
      clearedPaths,
      skippedPaths,
      warnings,
      errors,
    };
  }

  let entityAttachmentOperationalRowsRemoved: number | undefined;

  try {
    if (tauriFs) {
      const removed = await filterEntityAttachmentsOnDisk(warnings, clearedPaths);
      if (removed !== undefined && removed > 0) {
        entityAttachmentOperationalRowsRemoved = removed;
      }
    } else {
      const removed = filterEntityAttachmentsBrowserOnly(warnings, clearedPaths);
      if (removed !== undefined && removed > 0) {
        entityAttachmentOperationalRowsRemoved = removed;
      }
    }
  } catch (e) {
    errors.push(
      `Entity attachment filter failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return {
      success: false,
      dryRun: false,
      persistenceMode: tauriFs ? "tauri_files" : "browser_local_storage_only",
      clearedPaths,
      skippedPaths,
      warnings,
      errors,
      entityAttachmentOperationalRowsRemoved,
    };
  }

  try {
    for (const relativePath of RESET_PURCHASING_SALES_DOCUMENT_STORE_PATHS) {
      await writeDocumentPayload(relativePath, []);
      clearedPaths.push(relativePath);
      if (tauriFs) {
        removeDocumentLocalStorageMirror(relativePath);
      }
    }
    for (const relativePath of RESET_PURCHASING_SALES_INVENTORY_STORE_PATHS) {
      await writeInventoryPayload(relativePath, []);
      clearedPaths.push(relativePath);
      if (tauriFs) {
        removeInventoryLocalStorageMirror(relativePath);
      }
    }
  } catch (e) {
    errors.push(`Store write failed: ${e instanceof Error ? e.message : String(e)}`);
    return {
      success: false,
      dryRun: false,
      persistenceMode: tauriFs ? "tauri_files" : "browser_local_storage_only",
      clearedPaths,
      skippedPaths,
      warnings,
      errors,
      entityAttachmentOperationalRowsRemoved,
    };
  }

  if (!tauriFs) {
    warnings.push(
      "Tauri file persistence was not available: AppLocalData disk JSON files were not modified. Operational purchasing/sales data was cleared via browser localStorage mirrors (and write fallbacks where applicable). Hard-reload the app so repositories re-read storage. Use Tauri dev for on-disk reset.",
    );
  }

  return {
    success: true,
    dryRun: false,
    persistenceMode: tauriFs ? "tauri_files" : "browser_local_storage_only",
    clearedPaths,
    skippedPaths,
    warnings,
    errors,
    entityAttachmentOperationalRowsRemoved,
  };
}

/** Document store paths that would be cleared (for dry-run assertions / tooling). */
export function listResetPurchasingSalesDocumentStorePaths(): readonly string[] {
  return RESET_PURCHASING_SALES_DOCUMENT_STORE_PATHS;
}

/** Inventory store paths that would be cleared (for dry-run assertions / tooling). */
export function listResetPurchasingSalesInventoryStorePaths(): readonly string[] {
  return RESET_PURCHASING_SALES_INVENTORY_STORE_PATHS;
}
