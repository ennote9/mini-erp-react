/**
 * Single generation counter for local repository–backed read models.
 * Bumped synchronously when persisted domain data changes so dashboards and
 * other summaries can subscribe via useSyncExternalStore without polling.
 */
let generation = 0;
const listeners = new Set<() => void>();

export function bumpAppReadModelRevision(): void {
  generation += 1;
  for (const l of listeners) {
    l();
  }
}

export function subscribeAppReadModelRevision(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getAppReadModelRevision(): number {
  return generation;
}
