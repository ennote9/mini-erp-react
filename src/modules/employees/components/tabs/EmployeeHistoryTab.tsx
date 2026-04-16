import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeTabProps } from "./types";

export function EmployeeHistoryTab({ draft }: EmployeeTabProps) {
  const { t } = useTranslation();
  const rows = draft.audit.slice().sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t("employees.tabs.history.title")}</CardTitle>
        <CardDescription className="text-xs">{t("employees.tabs.history.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("employees.tabs.history.empty")}</div>
        ) : (
          <div className="max-h-[min(480px,60vh)] overflow-auto rounded-md border border-border/60">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-[1] bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-2 py-1.5">{t("employees.history.when")}</th>
                  <th className="px-2 py-1.5">{t("employees.history.actor")}</th>
                  <th className="px-2 py-1.5">{t("employees.history.kind")}</th>
                  <th className="px-2 py-1.5">{t("employees.history.summary")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/50">
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{ev.at.replace("T", " ").slice(0, 19)}</td>
                    <td className="px-2 py-1">{ev.actorLabel}</td>
                    <td className="px-2 py-1 font-mono text-[11px]">{t(`employees.auditKind.${ev.kind}`)}</td>
                    <td className="px-2 py-1">{ev.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
