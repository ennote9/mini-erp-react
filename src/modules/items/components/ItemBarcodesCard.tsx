import { useMemo, useState } from "react";
import type { ItemBarcode } from "../model";
import {
  ITEM_BARCODE_PACKAGING_LEVELS,
  ITEM_BARCODE_ROLES,
  ITEM_BARCODE_SOURCE_TYPES,
  ITEM_BARCODE_SYMBOLOGIES,
  type ItemBarcodeDraft,
} from "../lib/itemBarcodes";
import { removeItemBarcode, saveItemBarcode } from "../service";
import { flushPendingItemsPersist } from "../repository";
import { useTranslation } from "@/shared/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  isNew: boolean;
  itemId?: string;
  barcodes: ItemBarcode[];
  onBarcodesChanged: () => void;
};

function defaultDraft(): ItemBarcodeDraft {
  return {
    codeValue: "",
    symbology: "EAN_13",
    packagingLevel: "UNIT",
    barcodeRole: "SELLABLE",
    sourceType: "MANUFACTURER",
    isPrimary: true,
    isActive: true,
    comment: "",
  };
}

export function ItemBarcodesCard({ isNew, itemId, barcodes, onBarcodesChanged }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ItemBarcodeDraft>(defaultDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; variant: "error" | "info" } | null>(null);

  const ordered = useMemo(() => [...barcodes].sort((a, b) => a.codeValue.localeCompare(b.codeValue)), [barcodes]);

  const resetDraft = () => {
    setDraft(defaultDraft());
    setEditingId(null);
  };

  const startEdit = (row: ItemBarcode) => {
    setEditingId(row.id);
    setDraft({
      codeValue: row.codeValue,
      symbology: row.symbology,
      packagingLevel: row.packagingLevel,
      barcodeRole: row.barcodeRole,
      sourceType: row.sourceType,
      isPrimary: row.isPrimary,
      isActive: row.isActive,
      comment: row.comment ?? "",
    });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!itemId) return;
    setBusy(true);
    setMessage(null);
    const result = saveItemBarcode(itemId, draft, editingId ?? undefined);
    if (!result.success) {
      setBusy(false);
      setMessage({ text: result.error, variant: "error" });
      return;
    }
    try {
      await flushPendingItemsPersist();
      onBarcodesChanged();
      setMessage({ text: t("master.item.barcodes.saved"), variant: "info" });
      resetDraft();
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : t("master.item.barcodes.saveFailed"),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (barcodeId: string) => {
    if (!itemId) return;
    setBusy(true);
    setMessage(null);
    const result = removeItemBarcode(itemId, barcodeId);
    if (!result.success) {
      setBusy(false);
      setMessage({ text: result.error, variant: "error" });
      return;
    }
    try {
      await flushPendingItemsPersist();
      onBarcodesChanged();
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : t("master.item.barcodes.saveFailed"),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (isNew || !itemId) {
    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">{t("master.item.barcodes.title")}</CardTitle>
          <CardDescription className="text-xs">{t("master.item.barcodes.unsavedHint")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">{t("master.item.barcodes.title")}</CardTitle>
        <CardDescription className="text-xs">{t("master.item.barcodes.description")}</CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-1 space-y-3">
        {message && (
          <p className={message.variant === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {message.text}
          </p>
        )}
        <div className="overflow-x-auto rounded border border-border/70">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-muted/20">
              <tr className="border-b border-border/70">
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.codeValue")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.symbology")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.packagingLevel")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.barcodeRole")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.sourceType")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.primary")}</th>
                <th className="px-2 py-1 text-left font-medium">{t("master.item.barcodes.active")}</th>
                <th className="px-2 py-1 text-right font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-muted-foreground" colSpan={8}>
                    {t("master.item.barcodes.empty")}
                  </td>
                </tr>
              ) : (
                ordered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                    <td className="px-2 py-1.5 font-mono">{row.codeValue}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t(`master.item.barcodes.types.${row.symbology}`)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t(`master.item.barcodes.packaging.${row.packagingLevel}`)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t(`master.item.barcodes.roles.${row.barcodeRole}`)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t(`master.item.barcodes.sources.${row.sourceType}`)}</td>
                    <td className="px-2 py-1.5">{row.isPrimary ? t("common.yes") : "—"}</td>
                    <td className="px-2 py-1.5">{row.isActive ? t("common.yes") : "—"}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(row)} disabled={busy}>
                          {t("common.edit")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleRemove(row.id)} disabled={busy}>
                          {t("common.delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <Label className="text-sm">{t("master.item.barcodes.codeValue")}</Label>
            <Input
              value={draft.codeValue}
              onChange={(e) => setDraft((x) => ({ ...x, codeValue: e.target.value }))}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Label className="text-sm">{t("master.item.barcodes.symbology")}</Label>
            <select
              value={draft.symbology}
              onChange={(e) => setDraft((x) => ({ ...x, symbology: e.target.value as ItemBarcodeDraft["symbology"] }))}
              className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              {ITEM_BARCODE_SYMBOLOGIES.map((v) => (
                <option key={v} value={v}>{t(`master.item.barcodes.types.${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <Label className="text-sm">{t("master.item.barcodes.packagingLevel")}</Label>
            <select
              value={draft.packagingLevel}
              onChange={(e) =>
                setDraft((x) => ({ ...x, packagingLevel: e.target.value as ItemBarcodeDraft["packagingLevel"] }))
              }
              className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              {ITEM_BARCODE_PACKAGING_LEVELS.map((v) => (
                <option key={v} value={v}>{t(`master.item.barcodes.packaging.${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <Label className="text-sm">{t("master.item.barcodes.barcodeRole")}</Label>
            <select
              value={draft.barcodeRole}
              onChange={(e) =>
                setDraft((x) => ({ ...x, barcodeRole: e.target.value as ItemBarcodeDraft["barcodeRole"] }))
              }
              className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              {ITEM_BARCODE_ROLES.map((v) => (
                <option key={v} value={v}>{t(`master.item.barcodes.roles.${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <Label className="text-sm">{t("master.item.barcodes.sourceType")}</Label>
            <select
              value={draft.sourceType}
              onChange={(e) =>
                setDraft((x) => ({ ...x, sourceType: e.target.value as ItemBarcodeDraft["sourceType"] }))
              }
              className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              {ITEM_BARCODE_SOURCE_TYPES.map((v) => (
                <option key={v} value={v}>{t(`master.item.barcodes.sources.${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={draft.isPrimary} onCheckedChange={(checked) => setDraft((x) => ({ ...x, isPrimary: checked === true }))} />
            <Label className="text-sm">{t("master.item.barcodes.primary")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={draft.isActive} onCheckedChange={(checked) => setDraft((x) => ({ ...x, isActive: checked === true }))} />
            <Label className="text-sm">{t("master.item.barcodes.active")}</Label>
          </div>
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <Label className="text-sm">{t("master.item.barcodes.comment")}</Label>
            <Textarea value={draft.comment ?? ""} onChange={(e) => setDraft((x) => ({ ...x, comment: e.target.value }))} rows={2} className="resize-none min-h-[4.5rem] text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => void handleSave()} disabled={busy}>
            {editingId ? t("common.save") : t("master.item.barcodes.add")}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetDraft} disabled={busy}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
