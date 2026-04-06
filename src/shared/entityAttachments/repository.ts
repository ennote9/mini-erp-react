import { getDocumentsFilePath, loadDocumentsPersisted, writeDocumentPayload } from "@/shared/documentPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { EntityAttachment, EntityAttachmentType } from "./model";

export type AddEntityAttachmentInput = Omit<EntityAttachment, "id" | "uploadedAt">;

const store: EntityAttachment[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
let pendingWriteErrors: string[] = [];

const PERSIST_PATH = getDocumentsFilePath("entity-attachments.json");

function asOptionalTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : undefined;
}

function asEntityType(v: unknown): EntityAttachmentType | null {
  return v === "customer" || v === "agreement" || v === "order" || v === "shipment" ? v : null;
}

function normalizeAttachment(raw: unknown): EntityAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const entityType = asEntityType(rec.entityType);
  if (
    typeof rec.id !== "string" ||
    entityType === null ||
    typeof rec.entityId !== "string" ||
    typeof rec.fileName !== "string" ||
    typeof rec.storageRef !== "string" ||
    rec.storageRef.trim() === "" ||
    typeof rec.uploadedAt !== "string"
  ) {
    return null;
  }
  const fileName = rec.fileName.trim();
  if (fileName === "") return null;
  return {
    id: rec.id,
    entityType,
    entityId: rec.entityId,
    fileName,
    storageRef: rec.storageRef.trim(),
    fileSize: asOptionalNumber(rec.fileSize),
    mimeType: asOptionalTrimmedString(rec.mimeType),
    uploadedAt: rec.uploadedAt,
    comment: asOptionalTrimmedString(rec.comment),
  };
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeDocumentPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        pendingWriteErrors.push(lastWriteError);
        if (import.meta.env.DEV) {
          console.error("[entityAttachmentRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getEntityAttachmentPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingEntityAttachmentPersist(): Promise<void> {
  await persistChain;
  if (pendingWriteErrors.length > 0) {
    const message = pendingWriteErrors.join(" | ");
    pendingWriteErrors = [];
    throw new Error(message);
  }
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: () => [],
    normalizeRecord: normalizeAttachment,
    diagnosticsTag: "entityAttachmentRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

function nowIso(): string {
  return new Date().toISOString();
}

export const entityAttachmentRepository = {
  listByEntity(entityType: EntityAttachmentType, entityId: string): EntityAttachment[] {
    return store
      .filter((x) => x.entityType === entityType && x.entityId === entityId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map((x) => ({ ...x }));
  },

  add(attachment: AddEntityAttachmentInput): EntityAttachment | null {
    if (attachment.fileName.trim() === "" || attachment.storageRef.trim() === "") return null;
    const created: EntityAttachment = {
      ...attachment,
      id: String(nextId++),
      uploadedAt: nowIso(),
      fileName: attachment.fileName.trim(),
      storageRef: attachment.storageRef.trim(),
      comment: attachment.comment?.trim() || undefined,
    };
    store.push(created);
    schedulePersist();
    return { ...created };
  },

  addMany(attachments: AddEntityAttachmentInput[]): EntityAttachment[] {
    const created: EntityAttachment[] = [];
    for (const attachment of attachments) {
      const row = this.add(attachment);
      if (row) created.push(row);
    }
    return created;
  },

  delete(id: string): boolean {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    schedulePersist();
    return true;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "entity-attachments",
  flush: flushPendingEntityAttachmentPersist,
  isBusy: getEntityAttachmentPersistBusy,
});

