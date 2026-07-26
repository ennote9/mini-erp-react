/**
 * Workspace backup manifest V1 — typed builder only (no disk IO, no zip).
 */

export const WORKSPACE_BACKUP_KIND = "mini-erp-workspace-backup" as const;

export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1 as const;

export const DEFAULT_WORKSPACE_BACKUP_PLATFORM = "tauri" as const;

export const DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY = "AppLocalData" as const;

export type WorkspaceBackupStoreEntry = {
  id: string;
  relativePath: string;
  bytes?: number;
  sha256?: string;
};

export type WorkspaceBackupManifestV1 = {
  kind: typeof WORKSPACE_BACKUP_KIND;
  backupSchemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION;
  appVersion: string;
  createdAt: string;
  platform: typeof DEFAULT_WORKSPACE_BACKUP_PLATFORM;
  baseDirectory: typeof DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY;
  stores: WorkspaceBackupStoreEntry[];
  notes?: string[];
};

export type BuildWorkspaceBackupManifestInput = {
  appVersion: string;
  createdAt: string;
  stores: WorkspaceBackupStoreEntry[];
  notes?: string[];
};

const DEFAULT_STORE_DEFINITIONS: ReadonlyArray<Pick<WorkspaceBackupStoreEntry, "id" | "relativePath">> = [
  { id: "purchase-orders", relativePath: "documents/purchase-orders.json" },
  { id: "sales-orders", relativePath: "documents/sales-orders.json" },
  { id: "receipts", relativePath: "documents/receipts.json" },
  { id: "shipments", relativePath: "documents/shipments.json" },
  { id: "audit-events", relativePath: "documents/audit/events.json" },
  { id: "entity-attachments", relativePath: "documents/entity-attachments.json" },
  { id: "customer-agreements", relativePath: "documents/customer-agreements.json" },
  { id: "purchase-order-payments", relativePath: "documents/purchase-order-payments.json" },
  { id: "sales-order-payments", relativePath: "documents/sales-order-payments.json" },
  { id: "stock-balances", relativePath: "inventory/stock-balances.json" },
  { id: "stock-reservations", relativePath: "inventory/stock-reservations.json" },
  { id: "stock-movements", relativePath: "inventory/stock-movements.json" },
  { id: "carriers", relativePath: "master-data/carriers.json" },
  { id: "warehouses", relativePath: "master-data/warehouses.json" },
  { id: "customers", relativePath: "master-data/customers.json" },
  { id: "suppliers", relativePath: "master-data/suppliers.json" },
  { id: "categories", relativePath: "master-data/categories.json" },
  { id: "brands", relativePath: "master-data/brands.json" },
  { id: "employees", relativePath: "master-data/employees.json" },
  { id: "markdown-records", relativePath: "master-data/markdown-records.json" },
  { id: "markdown-journals", relativePath: "master-data/markdown-journals.json" },
  { id: "markdown-journal-lines", relativePath: "master-data/markdown-journal-lines.json" },
  { id: "label-templates", relativePath: "labels/templates.json" },
  { id: "print-jobs", relativePath: "labels/print-jobs.json" },
  { id: "items", relativePath: "items/items.json" },
  { id: "app-settings", relativePath: "config/app-settings.json" },
];

function isAbsoluteOrUnsafeRelativePath(path: string): boolean {
  const p = path.trim();
  if (p === "") return true;
  if (p.includes("..")) return true;
  if (p.startsWith("/")) return true;
  /** UNC (`\\server\share`) or root-relative absolute on Windows (`\Users\...`). */
  if (p.startsWith("\\")) return true;
  if (/^[a-zA-Z]:[/\\]/.test(p)) return true;
  return false;
}

function assertValidCreatedAt(createdAt: string): void {
  const t = createdAt.trim();
  if (t === "") throw new Error("createdAt must be non-empty.");
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error("createdAt must be a parseable date.");
}

function validateStoreEntry(entry: WorkspaceBackupStoreEntry, index: number): void {
  const prefix = `stores[${index}]`;
  const id = entry.id.trim();
  if (id === "") throw new Error(`${prefix}: id must be non-empty.`);
  const relativePath = entry.relativePath.trim();
  if (relativePath === "") throw new Error(`${prefix}: relativePath must be non-empty.`);
  if (isAbsoluteOrUnsafeRelativePath(entry.relativePath)) {
    throw new Error(`${prefix}: relativePath must be a safe relative path (no '..', not absolute).`);
  }
  if (entry.bytes !== undefined) {
    if (!Number.isFinite(entry.bytes) || entry.bytes < 0) {
      throw new Error(`${prefix}: bytes must be a non-negative finite number when provided.`);
    }
  }
  if (entry.sha256 !== undefined) {
    if (typeof entry.sha256 !== "string" || entry.sha256.trim() === "") {
      throw new Error(`${prefix}: sha256 must be a non-empty string when provided.`);
    }
  }
}

/**
 * Default JSON store paths for a full workspace backup (no item images).
 * Returns a new array of new objects each call — safe for callers to mutate.
 */
export function getDefaultWorkspaceBackupStoreEntries(): WorkspaceBackupStoreEntry[] {
  return DEFAULT_STORE_DEFINITIONS.map((d) => ({ id: d.id, relativePath: d.relativePath }));
}

/**
 * Build a normalized {@link WorkspaceBackupManifestV1} from validated input.
 * Stores are sorted by `relativePath` ascending.
 */
export function buildWorkspaceBackupManifestV1(
  input: BuildWorkspaceBackupManifestInput,
): WorkspaceBackupManifestV1 {
  const appVersion = input.appVersion.trim();
  if (appVersion === "") throw new Error("appVersion must be non-empty.");

  assertValidCreatedAt(input.createdAt);

  if (!input.stores || input.stores.length === 0) {
    throw new Error("stores must be non-empty.");
  }

  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  for (let i = 0; i < input.stores.length; i++) {
    const raw = input.stores[i]!;
    validateStoreEntry(raw, i);
    const id = raw.id.trim();
    const relativePath = raw.relativePath.trim();
    if (seenIds.has(id)) throw new Error(`Duplicate store id: "${id}".`);
    if (seenPaths.has(relativePath)) throw new Error(`Duplicate relativePath: "${relativePath}".`);
    seenIds.add(id);
    seenPaths.add(relativePath);
  }

  const sorted = [...input.stores]
    .map((s) => ({
      id: s.id.trim(),
      relativePath: s.relativePath.trim(),
      ...(s.bytes !== undefined ? { bytes: s.bytes } : {}),
      ...(s.sha256 !== undefined ? { sha256: s.sha256 } : {}),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const manifest: WorkspaceBackupManifestV1 = {
    kind: WORKSPACE_BACKUP_KIND,
    backupSchemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    appVersion,
    createdAt: input.createdAt.trim(),
    platform: DEFAULT_WORKSPACE_BACKUP_PLATFORM,
    baseDirectory: DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY,
    stores: sorted,
  };

  if (input.notes !== undefined && input.notes.length > 0) {
    manifest.notes = [...input.notes];
  }

  return manifest;
}
