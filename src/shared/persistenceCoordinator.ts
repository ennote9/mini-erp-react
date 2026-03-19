type FlushFn = () => Promise<void>;
type BusyFn = () => boolean;

type PersistenceModuleRegistration = {
  id: string;
  flush: FlushFn;
  isBusy?: BusyFn;
};

type RegisteredModule = {
  flush: FlushFn;
  isBusy?: BusyFn;
};

const modules = new Map<string, RegisteredModule>();

export class PersistenceFlushError extends Error {
  readonly failures: Array<{ moduleId: string; error: unknown }>;

  constructor(failures: Array<{ moduleId: string; error: unknown }>) {
    super(
      `Persistence flush failed for modules: ${failures
        .map((f) => f.moduleId)
        .join(", ")}`,
    );
    this.name = "PersistenceFlushError";
    this.failures = failures;
  }
}

export function registerPersistenceFlush(
  registration: PersistenceModuleRegistration,
): () => void {
  modules.set(registration.id, {
    flush: registration.flush,
    isBusy: registration.isBusy,
  });
  return () => {
    modules.delete(registration.id);
  };
}

export function hasPendingPersistence(): boolean {
  for (const mod of modules.values()) {
    if (mod.isBusy?.()) return true;
  }
  return false;
}

export function listPendingPersistenceModules(): string[] {
  const pending: string[] = [];
  for (const [id, mod] of modules.entries()) {
    if (mod.isBusy?.()) pending.push(id);
  }
  return pending;
}

export async function flushAllPendingPersistence(): Promise<void> {
  const entries = [...modules.entries()];
  const settled = await Promise.allSettled(
    entries.map(async ([moduleId, mod]) => {
      await mod.flush();
      return moduleId;
    }),
  );
  const failures = settled.flatMap((res, i) => {
    if (res.status === "fulfilled") return [];
    return [{ moduleId: entries[i][0], error: res.reason }];
  });
  if (failures.length > 0) {
    throw new PersistenceFlushError(failures);
  }
}
