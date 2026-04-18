import { useTranslation } from "@/shared/i18n";
import { LABELS_STATION_SOURCE } from "../lib/labelsStationConstants";
import type { ItemPreviewWarningCode } from "../lib/itemPreviewContext";

type Props = {
  source: string | null;
  itemName: string;
  itemCode: string;
  selectedBarcode: string;
  primaryBarcode: string;
  warnings: ItemPreviewWarningCode[];
};

function warningMessage(t: (k: string) => string, code: ItemPreviewWarningCode): string {
  switch (code) {
    case "barcodeNotFound":
      return t("labels.workspace.contextBanner.warningBarcodeNotFound");
    case "barcodeInactive":
      return t("labels.workspace.contextBanner.warningBarcodeInactive");
    case "noActiveBarcodes":
      return t("labels.workspace.contextBanner.warningNoActiveBarcodes");
    default: {
      const _e: never = code;
      return _e;
    }
  }
}

export function WorkspaceItemContextBanner({
  source,
  itemName,
  itemCode,
  selectedBarcode,
  primaryBarcode,
  warnings,
}: Props) {
  const { t } = useTranslation();
  const same = selectedBarcode === primaryBarcode;

  return (
    <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground">{t("labels.workspace.contextBanner.title")}</span>
        {source === "item-barcodes" ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.contextBanner.sourceFromBarcodesTab")}
          </span>
        ) : source === LABELS_STATION_SOURCE ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.contextBanner.sourceFromStation")}
          </span>
        ) : null}
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.contextBanner.itemName")}
          </dt>
          <dd className="truncate font-medium text-foreground" title={itemName}>
            {itemName}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.contextBanner.itemCode")}
          </dt>
          <dd className="truncate font-mono text-foreground" title={itemCode}>
            {itemCode}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.contextBanner.selectedBarcode")}
          </dt>
          <dd className="font-mono text-foreground">
            {selectedBarcode || "—"}
            {same ? (
              <span className="ml-2 text-[10px] text-muted-foreground">
                ({t("labels.workspace.contextBanner.sameAsPrimary")})
              </span>
            ) : null}
          </dd>
        </div>
        {!same ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("labels.workspace.contextBanner.primaryBarcode")}
            </dt>
            <dd className="font-mono text-foreground">{primaryBarcode || "—"}</dd>
          </div>
        ) : null}
      </dl>
      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[11px] text-amber-600/95 dark:text-amber-400/90">
          {warnings.map((w) => (
            <li key={w}>{warningMessage(t, w)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
