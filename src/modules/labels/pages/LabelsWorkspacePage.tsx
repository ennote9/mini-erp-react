import { useTranslation } from "@/shared/i18n";
import { LabelsSubnav } from "../components/LabelsSubnav";

/**
 * Print workspace — template selection, preview, and parameters (placeholder layout).
 */
export function LabelsWorkspacePage() {
  const { t } = useTranslation();

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.workspace.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.workspace.intro")}</p>
      </header>

      <div className="grid min-h-[280px] gap-3 lg:grid-cols-12">
        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.templateSection")}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">{t("labels.workspace.templatePlaceholder")}</p>
        </section>
        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.previewSection")}
          </h3>
          <div className="mt-3 flex min-h-[180px] items-center justify-center rounded border border-dashed border-border/70 bg-muted/15 px-2 text-center text-sm text-muted-foreground">
            {t("labels.workspace.previewPlaceholder")}
          </div>
        </section>
        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.paramsSection")}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">{t("labels.workspace.paramsPlaceholder")}</p>
        </section>
      </div>
    </div>
  );
}
