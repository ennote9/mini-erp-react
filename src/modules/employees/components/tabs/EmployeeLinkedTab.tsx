import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeTabProps } from "./types";

function MiniTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; name: string; changedAt?: string; status?: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border/50 p-2">
        <div className="text-xs font-medium text-foreground/90">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{empty}</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/50">
      <div className="border-b border-border/50 bg-muted/30 px-2 py-1 text-xs font-medium">{title}</div>
      <div className="max-h-36 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-2 py-1 font-mono text-muted-foreground">{r.id}</td>
                <td className="px-2 py-1">{r.name}</td>
                <td className="px-2 py-1 text-muted-foreground">{r.status ?? "—"}</td>
                <td className="px-2 py-1 text-muted-foreground">{r.changedAt?.slice(0, 10) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeeLinkedTab({ draft }: EmployeeTabProps) {
  const { t } = useTranslation();
  const l = draft.linkedSummaries;

  const counts = {
    categories: l.assignedCategories.length,
    brands: l.assignedBrands.length,
    warehouses: l.assignedWarehouses.length,
    templates: l.documentTemplates.length,
    created: l.createdObjectsPreview.length,
    approved: l.approvedObjectsPreview.length,
    inWork: l.inWorkObjectsPreview.length,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.linked.summaryTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.linked.summaryHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["categories", counts.categories],
              ["brands", counts.brands],
              ["warehouses", counts.warehouses],
              ["templates", counts.templates],
              ["created", counts.created],
              ["approved", counts.approved],
              ["inWork", counts.inWork],
            ] as const
          ).map(([k, n]) => (
            <div key={k} className="rounded-md border border-border/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(`employees.tabs.linked.count.${k}`)}
              </div>
              <div className="text-lg font-semibold tabular-nums">{n}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <MiniTable
          title={t("employees.tabs.linked.section.categories")}
          rows={l.assignedCategories}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.brands")}
          rows={l.assignedBrands}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.warehouses")}
          rows={l.assignedWarehouses}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.templates")}
          rows={l.documentTemplates}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.created")}
          rows={l.createdObjectsPreview}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.approved")}
          rows={l.approvedObjectsPreview}
          empty={t("employees.tabs.linked.empty")}
        />
        <MiniTable
          title={t("employees.tabs.linked.section.inWork")}
          rows={l.inWorkObjectsPreview}
          empty={t("employees.tabs.linked.empty")}
        />
      </div>
    </div>
  );
}
