/**
 * Bumped when persisted inventory-related stores change so UI (e.g. ItemPage
 * stock blocks) can resubscribe without polling. Synchronous on mutation.
 */
let generation = 0;
const listeners = new Set<() => void>();

export function bumpInventoryDisplayRevision(): void {
  generation += 1;
  for (const l of listeners) {
    l();
  }
}

export function subscribeInventoryDisplayRevision(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getInventoryDisplayRevision(): number {
  return generation;
}
