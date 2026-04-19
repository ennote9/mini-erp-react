import { useTranslation } from "@/shared/i18n";
import { getMarkingExternalIntegrationInfo } from "../markingExternalSyncService";

/**
 * Shows whether external marking integration is mock, real-ready (HTTP skeleton), or disabled.
 */
export function MarkingIntegrationModeBanner() {
  const { t } = useTranslation();
  const info = getMarkingExternalIntegrationInfo();

  if (info.effectiveLabel === "disabled") {
    return (
      <p className="mt-2 rounded border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
        {t("master.markingIntegration.disabledBanner")}
      </p>
    );
  }
  if (info.effectiveLabel === "mock") {
    return (
      <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-950 dark:text-amber-100">
        {t("master.markingExternalSync.mockBanner")}
      </p>
    );
  }
  return (
    <p className="mt-2 rounded border border-sky-500/35 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-950 dark:text-sky-100">
      {t("master.markingIntegration.realReadyBanner")}
    </p>
  );
}
