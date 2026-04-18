import { useTranslation } from "@/shared/i18n";
import { LabelsSubnav } from "../components/LabelsSubnav";

/**
 * Print operations / history — placeholder until jobs are persisted and listed.
 */
export function LabelsOperationsPage() {
  const { t } = useTranslation();

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.operations.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.operations.intro")}</p>
      </header>

      <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{t("labels.operations.emptyTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("labels.operations.emptyHint")}</p>
      </div>
    </div>
  );
}
