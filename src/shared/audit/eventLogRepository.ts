import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../documentPersistence";
import { registerPersistenceFlush } from "../persistenceCoordinator";
import type { AuditEventInput, AuditEventRecord } from "./eventLogTypes";
import { AUDIT_ACTOR_LOCAL_USER } from "./eventLogTypes";

const PERSIST_PATH = getDocumentsFilePath("audit/events.json");

const eventStore: AuditEventRecord[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function normalizeEventRecord(raw: unknown): AuditEventRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.entityType !== "string" ||
    typeof rec.entityId !== "string" ||
    typeof rec.eventType !== "string" ||
    typeof rec.createdAt !== "string" ||
    typeof rec.actor !== "string" ||
    rec.payload == null ||
    typeof rec.payload !== "object"
  ) {
    return null;
  }
  return {
    id: rec.id,
    entityType: rec.entityType as AuditEventRecord["entityType"],
    entityId: rec.entityId,
    eventType: rec.eventType as AuditEventRecord["eventType"],
    createdAt: rec.createdAt,
    actor: rec.actor,
    payload: rec.payload as Record<string, unknown>,
  };
}

function buildSeedRecords(): AuditEventRecord[] {
  return [];
}

export function getAuditEventPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastAuditEventPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingAuditEventPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function schedulePersist(): void {
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeDocumentPayload(PERSIST_PATH, snapshotRecords());
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[auditEventRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

function snapshotRecords(): AuditEventRecord[] {
  return eventStore.map((e) => ({ ...e, payload: { ...e.payload } }));
}

function nextEventId(): string {
  return String(nextId++);
}

export function appendAuditEvent(input: AuditEventInput): void {
  const rec: AuditEventRecord = {
    id: nextEventId(),
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    createdAt: input.createdAt ?? new Date().toISOString(),
    actor: input.actor || AUDIT_ACTOR_LOCAL_USER,
    payload: { ...input.payload },
  };
  eventStore.push(rec);
  schedulePersist();
}

export function appendAuditEvents(inputs: AuditEventInput[]): void {
  if (inputs.length === 0) return;
  const now = new Date().toISOString();
  for (const input of inputs) {
    eventStore.push({
      id: nextEventId(),
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      createdAt: input.createdAt ?? now,
      actor: input.actor || AUDIT_ACTOR_LOCAL_USER,
      payload: { ...input.payload },
    });
  }
  schedulePersist();
}

/** Most recent first. */
export function listAuditEventsForEntity(
  entityType: AuditEventRecord["entityType"],
  entityId: string,
): AuditEventRecord[] {
  return eventStore
    .filter((e) => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizeEventRecord,
    diagnosticsTag: "auditEventRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  eventStore.splice(0, eventStore.length, ...loaded.records);
  nextId = computeNextNumericId(eventStore);
}

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "audit-events",
  flush: flushPendingAuditEventPersist,
  isBusy: getAuditEventPersistBusy,
});
