/**
 * Last-used template on the sticker station page (separate from generic workspace storage).
 */
const STORAGE_KEY = "mini-erp.labels.station.v1";

export type LabelsStationPersisted = {
  lastTemplateId?: string;
};

export function loadLabelsStationStorage(): LabelsStationPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Partial<LabelsStationPersisted>;
    return {
      lastTemplateId: typeof o.lastTemplateId === "string" ? o.lastTemplateId : undefined,
    };
  } catch {
    return {};
  }
}

export function saveLabelsStationStorage(partial: Partial<LabelsStationPersisted>): void {
  const prev = loadLabelsStationStorage();
  const next: LabelsStationPersisted = { ...prev, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
