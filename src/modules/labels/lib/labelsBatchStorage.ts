const STORAGE_KEY = "mini-erp.labels.batch.v1";

export type LabelsBatchPersisted = {
  lastTemplateId?: string;
};

export function loadLabelsBatchStorage(): LabelsBatchPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Partial<LabelsBatchPersisted>;
    return {
      lastTemplateId: typeof o.lastTemplateId === "string" ? o.lastTemplateId : undefined,
    };
  } catch {
    return {};
  }
}

export function saveLabelsBatchStorage(partial: Partial<LabelsBatchPersisted>): void {
  const prev = loadLabelsBatchStorage();
  const next: LabelsBatchPersisted = { ...prev, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
