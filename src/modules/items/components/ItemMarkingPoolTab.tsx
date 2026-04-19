import { useMemo, useState, useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { ItemMarkingRecordKind, ItemMarkingRecordStatus } from "../model/itemMarkingRecord";
import {
  createMarkingRecord,
  listMarkingRecordsByItem,
  patchMarkingRecord,
  removeMarkingRecord,
  updateMarkingRecordStatus,
} from "../markingRecordService";

const KIND_OPTIONS: { value: ItemMarkingRecordKind; labelKey: string }[] = [
  { value: "MARKING", labelKey: "master.item.markingPool.kind.MARKING" },
  { value: "KIZ", labelKey: "master.item.markingPool.kind.KIZ" },
  { value: "DATAMATRIX", labelKey: "master.item.markingPool.kind.DATAMATRIX" },
  { value: "GS1_DATAMATRIX", labelKey: "master.item.markingPool.kind.GS1_DATAMATRIX" },
];

const STATUS_OPTIONS: { value: ItemMarkingRecordStatus; labelKey: string }[] = [
  { value: "AVAILABLE", labelKey: "master.item.markingPool.status.AVAILABLE" },
  { value: "RESERVED", labelKey: "master.item.markingPool.status.RESERVED" },
  { value: "PRINTED", labelKey: "master.item.markingPool.status.PRINTED" },
  { value: "USED", labelKey: "master.item.markingPool.status.USED" },
  { value: "VOID", labelKey: "master.item.markingPool.status.VOID" },
];

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
        <table className="w-full min-w-[720px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
              <th className="px-2 py-1.5">{t("master.item.markingPool.colKind")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colStatus")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colPayload")}</th>
              <th className="px-2 py-1.5">{t("master.item.markingPool.colLabel")}</th>
              <th className="px-2 py-1.5 w-40">{t("master.item.markingPool.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("master.item.markingPool.empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40">
                  <td className="px-2 py-1.5 align-top font-mono text-[10px]">{row.kind}</td>
                  <td className="px-2 py-1.5 align-top">
                    <SelectField
                      value={row.status}
                      onChange={(v) => updateMarkingRecordStatus(row.id, v as ItemMarkingRecordStatus)}
                      options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      placeholder=""
                      className="h-7 max-w-[9rem] text-[10px]"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Input
                      key={`${row.id}-${row.updatedAt}`}
                      defaultValue={row.payload}
                      className="h-7 font-mono text-[10px]"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== row.payload) patchMarkingRecord(row.id, { payload: next });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Input
                      defaultValue={row.humanLabel ?? ""}
                      key={row.id + (row.humanLabel ?? "")}
                      className="h-7 text-[10px]"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (row.humanLabel ?? "")) patchMarkingRecord(row.id, { humanLabel: v || undefined });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
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
    </div>
  );
}
