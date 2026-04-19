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
  /** Dense one-line summary for operator screens (e.g. sticker station). */
  compact?: boolean;
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
  compact,
}: Props) {
  const { t } = useTranslation();
  const same = selectedBarcode === primaryBarcode;

  if (compact) {
    return (
      <div
        className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] text-foreground"
        data-testid="labels-context-banner-compact"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="max-w-[min(100%,20rem)] truncate font-medium" title={itemName}>
            {itemName}
          </span>
          <span className="font-mono text-muted-foreground">{itemCode}</span>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span className="font-mono">{selectedBarcode || "—"}</span>
          {same ? (
            <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("labels.station.badgePrimaryBarcode")}
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{t("labels.workspace.contextBanner.primaryBarcode")}</span>
              <span className="font-mono">{primaryBarcode || "—"}</span>
            </>
          )}
        </div>
        {warnings.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5 border-t border-border/50 pt-1.5 text-[10px] text-amber-800 dark:text-amber-200">
            {warnings.map((w) => (
              <li key={w}>{warningMessage(t, w)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

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
