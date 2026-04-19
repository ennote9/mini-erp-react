import { useMemo, useState, useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { ItemMarkingRecord, ItemMarkingRecordKind } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditSource } from "../model/itemMarkingRecordAudit";
import {
  createMarkingRecord,
  listMarkingRecordAuditByRecordId,
  listMarkingRecordsByItem,
  markMarkingRecordPrinted,
  markMarkingRecordUsed,
  patchMarkingRecord,
  removeMarkingRecord,
  reserveMarkingRecord,
  releaseReservedMarking,
  voidMarkingRecord,
} from "../markingRecordService";

const KIND_OPTIONS: { value: ItemMarkingRecordKind; labelKey: string }[] = [
  { value: "MARKING", labelKey: "master.item.markingPool.kind.MARKING" },
  { value: "KIZ", labelKey: "master.item.markingPool.kind.KIZ" },
  { value: "DATAMATRIX", labelKey: "master.item.markingPool.kind.DATAMATRIX" },
  { value: "GS1_DATAMATRIX", labelKey: "master.item.markingPool.kind.GS1_DATAMATRIX" },
];

function auditSourceLabelKey(source: ItemMarkingRecordAuditSource): string {
  const map: Record<ItemMarkingRecordAuditSource, string> = {
    manual: "master.item.markingPool.auditSource.manual",
    print_workspace: "master.item.markingPool.auditSource.print_workspace",
    print_station: "master.item.markingPool.auditSource.print_station",
    print_batch: "master.item.markingPool.auditSource.print_batch",
    import: "master.item.markingPool.auditSource.import",
    void: "master.item.markingPool.auditSource.void",
    mark_used: "master.item.markingPool.auditSource.mark_used",
    release: "master.item.markingPool.auditSource.release",
    system: "master.item.markingPool.auditSource.system",
  };
  return map[source] ?? map.system;
}

type Props = {
  itemId: string;
};

export function ItemMarkingPoolTab({ itemId }: Props) {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const rows = useMemo(() => {
    void revision;
    return listMarkingRecordsByItem(itemId);
  }, [itemId, revision]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const auditEntries = useMemo(() => {
    void revision;
    if (!selectedId) return [];
    return listMarkingRecordAuditByRecordId(selectedId, 24);
  }, [selectedId, revision]);

  const [draftKind, setDraftKind] = useState<ItemMarkingRecordKind>("KIZ");
  const [draftPayload, setDraftPayload] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const handleAdd = useCallback(() => {
    const payload = draftPayload.trim();
    if (!payload) return;
    createMarkingRecord({
      itemId,
      kind: draftKind,
      payload,
      humanLabel: draftLabel.trim() || undefined,
      note: draftNote.trim() || undefined,
      status: "AVAILABLE",
      source: "MANUAL",
    });
    setDraftPayload("");
    setDraftLabel("");
    setDraftNote("");
  }, [itemId, draftKind, draftPayload, draftLabel, draftNote]);

  const statusLabel = useCallback((s: ItemMarkingRecord["status"]) => t(`master.item.markingPool.status.${s}`), [t]);

  const rowActions = useCallback(
    (row: ItemMarkingRecord) => {
      const sm = "h-7 px-1.5 text-[10px]";
      const manual = { source: "manual" as const };
      switch (row.status) {
        case "AVAILABLE":
          return (
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="secondary" size="sm" className={sm} onClick={() => reserveMarkingRecord(row.id, manual)}>
                {t("master.item.markingPool.actionReserve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={sm}
                onClick={() => markMarkingRecordPrinted(row.id, { ...manual, reason: "manual_mark_printed" })}
              >
                {t("master.item.markingPool.actionPrinted")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={sm} onClick={() => voidMarkingRecord(row.id, manual)}>
                {t("master.item.markingPool.actionVoid")}
              </Button>
            </div>
          );
        case "RESERVED":
          return (
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="secondary" size="sm" className={sm} onClick={() => releaseReservedMarking(row.id, manual)}>
                {t("master.item.markingPool.actionRelease")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={sm}
                onClick={() => markMarkingRecordPrinted(row.id, { ...manual, reason: "manual_mark_printed" })}
              >
                {t("master.item.markingPool.actionPrinted")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={sm} onClick={() => voidMarkingRecord(row.id, manual)}>
                {t("master.item.markingPool.actionVoid")}
              </Button>
            </div>
          );
        case "PRINTED":
          return (
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="secondary" size="sm" className={sm} onClick={() => markMarkingRecordUsed(row.id, manual)}>
                {t("master.item.markingPool.actionUsed")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={sm} onClick={() => voidMarkingRecord(row.id, manual)}>
                {t("master.item.markingPool.actionVoid")}
              </Button>
            </div>
          );
        default:
          return <span className="text-[10px] text-muted-foreground">—</span>;
      }
    },
    [t],
  );

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-snug text-muted-foreground">{t("master.item.markingPool.hint")}</p>

      <div className="rounded-md border border-border/70 bg-card/40 p-3 space-y-2">
        <p className="text-xs font-medium">{t("master.item.markingPool.addTitle")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.item.markingPool.colKind")}</Label>
            <SelectField
              value={draftKind}
              onChange={(v) => setDraftKind(v as ItemMarkingRecordKind)}
              options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[11px]">{t("master.item.markingPool.colPayload")}</Label>
            <Input
              value={draftPayload}
              onChange={(e) => setDraftPayload(e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder={t("master.item.markingPool.payloadPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.item.markingPool.colLabel")}</Label>
            <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">{t("master.item.markingPool.colNote")}</Label>
          <Textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={2} className="text-xs min-h-0" />
        </div>
        <Button type="button" size="sm" className="h-8" onClick={handleAdd} disabled={!draftPayload.trim()}>
          {t("master.item.markingPool.add")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[900px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
              <th className="px-2 py-1.5 w-8" />
              <th className="px-2 py-1.5">{t("master.item.markingPool.colKind")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colStatus")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colUpdated")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colPayload")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colLabel")}</th>
              <th className="px-2 py-1.5 min-w-[14rem]">{t("master.item.markingPool.colLifecycle")}</th>
              <th className="px-2 py-1.5 w-24">{t("master.item.markingPool.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  {t("master.item.markingPool.empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/40 cursor-pointer ${selectedId === row.id ? "bg-muted/25" : ""}`}
                  onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                >
                  <td className="px-2 py-1.5 align-top text-center text-muted-foreground">
                    {selectedId === row.id ? "▸" : ""}
                  </td>
                  <td className="px-2 py-1.5 align-top font-mono text-[10px]">{row.kind}</td>
                  <td className="px-2 py-1.5 align-top">{statusLabel(row.status)}</td>
                  <td className="px-2 py-1.5 align-top tabular-nums text-[10px] text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Input
                      key={`${row.id}-${row.updatedAt}-p`}
                      defaultValue={row.payload}
                      className="h-7 font-mono text-[10px]"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== row.payload) patchMarkingRecord(row.id, { payload: next });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Input
                      defaultValue={row.humanLabel ?? ""}
                      key={`${row.id}-${row.updatedAt}-l`}
                      className="h-7 text-[10px]"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (row.humanLabel ?? "")) patchMarkingRecord(row.id, { humanLabel: v || undefined });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                  <td className="px-2 py-1.5 align-top" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive"
                      onClick={() => removeMarkingRecord(row.id)}
                    >
                      {t("master.item.markingPool.delete")}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <div className="rounded-md border border-border/60 bg-card/30 p-3 space-y-2">
          <p className="text-xs font-medium">{t("master.item.markingPool.auditTitle")}</p>
          {auditEntries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{t("master.item.markingPool.auditEmpty")}</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-[10px]">
              {[...auditEntries].reverse().map((e) => (
                <li key={e.id} className="border-b border-border/30 pb-1 font-mono leading-snug last:border-0">
                  <span className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>{" "}
                  <span className="text-foreground">
                    {e.fromStatus ? statusLabel(e.fromStatus) : "—"} → {statusLabel(e.toStatus)}
                  </span>
                  <span className="text-muted-foreground"> · {t(auditSourceLabelKey(e.source))}</span>
                  {e.reason ? <span className="text-muted-foreground"> · {e.reason}</span> : null}
                  {e.printJobId ? (
                    <span className="text-muted-foreground" title={e.printJobId}>
                      {" "}
                      · job {e.printJobId.slice(0, 8)}…
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
