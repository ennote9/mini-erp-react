import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n/context";
import type { LinkedEntityRef } from "../../model";
import type { EmployeeTabProps } from "./types";

type LinkedSectionKey =
  | "categories"
  | "brands"
  | "warehouses"
  | "templates"
  | "created"
  | "approved"
  | "inWork";

function routeForMasterRow(section: LinkedSectionKey, id: string): string | undefined {
  if (section === "categories") return `/categories/${id}`;
  if (section === "brands") return `/brands/${id}`;
  if (section === "warehouses") return `/warehouses/${id}`;
  return undefined;
}

function LinkedSectionTable({
  section,
  title,
  rows,
  empty,
  emptyHint,
}: {
  section: LinkedSectionKey;
  title: string;
  rows: LinkedEntityRef[];
  empty: string;
  emptyHint: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/10 p-3">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{empty}</div>
        <div className="mt-2 text-[11px] leading-snug text-muted-foreground">{emptyHint}</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-2 py-1.5">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {rows.length} {t("employees.tabs.linked.rowCountSuffix")}
        </span>
      </div>
      <div className="max-h-44 overflow-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-[1] bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="border-b border-border/50 px-2 py-1 font-medium">{t("employees.tabs.linked.table.id")}</th>
              <th className="border-b border-border/50 px-2 py-1 font-medium">{t("employees.tabs.linked.table.name")}</th>
              <th className="border-b border-border/50 px-2 py-1 font-medium">{t("employees.tabs.linked.table.status")}</th>
              <th className="border-b border-border/50 px-2 py-1 font-medium">{t("employees.tabs.linked.table.changed")}</th>
              <th className="border-b border-border/50 px-2 py-1 font-medium text-right">{t("employees.tabs.linked.table.open")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const to = routeForMasterRow(section, r.id);
              return (
                <tr key={r.id} className="border-b border-border/35 last:border-0">
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.id}</td>
                  <td className="max-w-[140px] truncate px-2 py-1.5 text-foreground/95" title={r.name}>
                    {r.name}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.status?.trim() ? r.status : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                    {r.changedAt?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {to ? (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" asChild>
                        <Link to={to} title={t("employees.tabs.linked.openMasterTitle")}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t("employees.tabs.linked.table.open")}
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
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

  const empty = t("employees.tabs.linked.empty");
  const emptyHint = t("employees.tabs.linked.emptyHint");

  const sections: { key: LinkedSectionKey; rows: LinkedEntityRef[] }[] = [
    { key: "categories", rows: l.assignedCategories },
    { key: "brands", rows: l.assignedBrands },
    { key: "warehouses", rows: l.assignedWarehouses },
    { key: "templates", rows: l.documentTemplates },
    { key: "created", rows: l.createdObjectsPreview },
    { key: "approved", rows: l.approvedObjectsPreview },
    { key: "inWork", rows: l.inWorkObjectsPreview },
  ];

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
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(`employees.tabs.linked.count.${k}`)}</div>
              <div className="text-lg font-semibold tabular-nums">{n}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map(({ key, rows }) => (
          <LinkedSectionTable
            key={key}
            section={key}
            title={t(`employees.tabs.linked.section.${key}`)}
            rows={rows}
            empty={empty}
            emptyHint={emptyHint}
          />
        ))}
      </div>
    </div>
  );
}
