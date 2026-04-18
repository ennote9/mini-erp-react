import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Item, ItemResponsibleRoleCode } from "../model";
import { itemRepository } from "../repository";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { employeeRepository } from "@/modules/employees/repository";
import type { Employee } from "@/modules/employees/model";
import {
  attachEmployeesToDirectRows,
  buildDirectAssignmentRows,
  buildRelatedByBrandRows,
  buildRelatedByCategoryRows,
  computeResponsiblesSummary,
  type DirectAssignmentRowModel,
  type RelatedContextRowModel,
} from "../lib/itemResponsibles";
import {
  removeItemResponsibleAssignmentAwaitPersist,
  upsertItemResponsibleAssignmentAwaitPersist,
} from "../itemResponsibleService";
import { ItemResponsibleEditDialog } from "./ItemResponsibleEditDialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n/context";

type Props = {
  itemId: string | undefined;
  isNew: boolean;
  revision: number;
  onResponsiblesChanged: () => void;
};

function formatAssignedAt(iso: string, appLocale: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const loc = appLocale === "ru" ? "ru-RU" : appLocale === "kk" ? "kk-KZ" : "en-US";
  return new Date(d).toLocaleString(loc, { dateStyle: "short", timeStyle: "short" });
}

export function ItemResponsiblesTab({ itemId, isNew, revision, onResponsiblesChanged }: Props) {
  const { t, locale } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFixedRole, setDialogFixedRole] = useState<ItemResponsibleRoleCode | undefined>(undefined);
  const [dialogInitialEmployeeId, setDialogInitialEmployeeId] = useState<string | undefined>(undefined);
  const [dialogServerError, setDialogServerError] = useState<string | null>(null);

  const item: Item | undefined = useMemo(() => {
    if (!itemId) return undefined;
    return itemRepository.getById(itemId);
  }, [itemId, revision]);

  const employees = useMemo(() => employeeRepository.list(), [revision]);

  const employeesById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const brandLabel = useMemo(() => {
    const bid = item?.brandId;
    if (!bid) return undefined;
    return brandRepository.getById(bid)?.name;
  }, [item?.brandId, revision]);

  const categoryLabel = useMemo(() => {
    const cid = item?.categoryId;
    if (!cid) return undefined;
    return categoryRepository.getById(cid)?.name;
  }, [item?.categoryId, revision]);

  const directRows = useMemo(() => {
    if (!item) return [];
    const base = buildDirectAssignmentRows(item);
    return attachEmployeesToDirectRows(base, employeesById);
  }, [item, employeesById]);

  const relatedBrandRows = useMemo(() => {
    if (!item) return [];
    return buildRelatedByBrandRows(item, employees, brandLabel);
  }, [item, employees, brandLabel]);

  const relatedCategoryRows = useMemo(() => {
    if (!item) return [];
    return buildRelatedByCategoryRows(item, employees, categoryLabel);
  }, [item, employees, categoryLabel]);

  const summary = useMemo(
    () => computeResponsiblesSummary(directRows, relatedBrandRows, relatedCategoryRows),
    [directRows, relatedBrandRows, relatedCategoryRows],
  );

  const openAssign = useCallback((roleCode: ItemResponsibleRoleCode, initialEmployeeId?: string) => {
    setDialogServerError(null);
    setDialogFixedRole(roleCode);
    setDialogInitialEmployeeId(initialEmployeeId);
    setDialogOpen(true);
  }, []);

  const openAssignChooseRole = useCallback((initialEmployeeId: string) => {
    setDialogServerError(null);
    setDialogFixedRole(undefined);
    setDialogInitialEmployeeId(initialEmployeeId);
    setDialogOpen(true);
  }, []);

  const runPersist = useCallback(async () => {
    onResponsiblesChanged();
  }, [onResponsiblesChanged]);

  const handleSubmitDialog = useCallback(
    async (data: { roleCode: ItemResponsibleRoleCode; employeeId: string; note: string }) => {
      if (!itemId) return;
      setBusy(true);
      setDialogServerError(null);
      try {
        const r = await upsertItemResponsibleAssignmentAwaitPersist(itemId, {
          roleCode: data.roleCode,
          employeeId: data.employeeId,
          note: data.note,
          assignedByEmployeeId: null,
        });
        if (r.success) {
          setDialogOpen(false);
          await runPersist();
        } else {
          setDialogServerError(r.error);
        }
      } finally {
        setBusy(false);
      }
    },
    [itemId, runPersist],
  );

  const handleRemove = useCallback(
    async (roleCode: ItemResponsibleRoleCode) => {
      if (!itemId) return;
      setBusy(true);
      try {
        await removeItemResponsibleAssignmentAwaitPersist(itemId, roleCode);
        await runPersist();
      } finally {
        setBusy(false);
      }
    },
    [itemId, runPersist],
  );

  const substituteName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "—";
      const s = employeesById.get(id);
      return s?.identity.displayName ?? s?.identity.fullName ?? id;
    },
    [employeesById],
  );

  const availabilityLabel = useCallback(
    (e: Employee) => {
      const k = e.availability.kind;
      return t(`employees.employees.enums.availability.${k}` as never);
    },
    [t],
  );

  const recordStatusLabel = useCallback(
    (e: Employee) => {
      const s = e.identity.status;
      return t(`employees.employees.enums.recordStatus.${s}` as never);
    },
    [t],
  );

  const renderDirectRow = (row: DirectAssignmentRowModel) => {
    const emp = row.employee;
    const a = row.assignment;
    return (
      <tr key={row.roleCode} className="border-t border-border/60">
        <td className="px-2 py-1 align-top text-[11px] font-medium">
          {t(`master.item.responsibles.roles.${row.roleCode}`)}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {emp ? (
            <Link className="list-table__link font-medium" to={`/employees/${encodeURIComponent(emp.id)}`}>
              {row.display?.displayName ?? emp.identity.displayName}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t("master.item.responsibles.emptyRole")}</span>
          )}
        </td>
        <td className="px-2 py-1 align-top text-[11px] text-muted-foreground">
          {row.display?.positionDepartment ?? "—"}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {emp ? (
            <div className="space-y-0.5">
              <div>{availabilityLabel(emp)}</div>
              {emp.identity.status !== "active" ? (
                <div className="text-[10px] text-amber-600/90">{recordStatusLabel(emp)}</div>
              ) : null}
            </div>
          ) : (
            "—"
          )}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {emp?.availability.substituteEmployeeId ? substituteName(emp.availability.substituteEmployeeId) : "—"}
        </td>
        <td className="px-2 py-1 align-top text-[11px] text-muted-foreground">{a?.note?.trim() ? a.note : "—"}</td>
        <td className="px-2 py-1 align-top text-[11px] text-muted-foreground">
          {a ? formatAssignedAt(a.assignedAt, locale) : "—"}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          <div className="flex flex-wrap gap-1">
            {!a ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={busy}
                data-testid={`item-responsible-assign-${row.roleCode}`}
                onClick={() => openAssign(row.roleCode)}
              >
                {t("master.item.responsibles.actionAssign")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={busy}
                  data-testid={`item-responsible-replace-${row.roleCode}`}
                  onClick={() => openAssign(row.roleCode)}
                >
                  {t("master.item.responsibles.actionReplace")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                  disabled={busy}
                  data-testid={`item-responsible-remove-${row.roleCode}`}
                  onClick={() => void handleRemove(row.roleCode)}
                >
                  {t("master.item.responsibles.actionRemove")}
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderRelatedRow = (row: RelatedContextRowModel, keyPrefix: string) => {
    const emp = row.employee;
    return (
      <tr key={`${keyPrefix}-${emp.id}`} className="border-t border-border/60">
        <td className="px-2 py-1 align-top text-[11px]">
          <Link className="list-table__link font-medium" to={`/employees/${encodeURIComponent(emp.id)}`}>
            {row.display.displayName}
          </Link>
        </td>
        <td className="px-2 py-1 align-top text-[11px] text-muted-foreground">
          <ul className="list-inside list-disc space-y-0.5">
            {row.businessRoleLabels.map((x) => (
              <li key={x} className="text-[10px] leading-snug">
                {x}
              </li>
            ))}
          </ul>
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {row.scopeKind === "brand"
            ? t("master.item.responsibles.scopeBrandLine", { name: row.scopeLabel })
            : t("master.item.responsibles.scopeCategoryLine", { name: row.scopeLabel })}
        </td>
        <td className="px-2 py-1 align-top text-[11px] text-muted-foreground">{row.display.positionDepartment}</td>
        <td className="px-2 py-1 align-top text-[11px]">
          <div className="space-y-0.5">
            <div>{availabilityLabel(emp)}</div>
            {emp.identity.status !== "active" ? (
              <div className="text-[10px] text-amber-600/90">{recordStatusLabel(emp)}</div>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {emp.availability.substituteEmployeeId ? substituteName(emp.availability.substituteEmployeeId) : "—"}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={busy}
            data-testid={`item-responsible-quick-${keyPrefix}-${emp.id}`}
            onClick={() => openAssignChooseRole(emp.id)}
          >
            {t("master.item.responsibles.actionQuickAssign")}
          </Button>
        </td>
      </tr>
    );
  };

  if (isNew || !itemId) {
    return (
      <div
        data-testid="item-responsibles-unsaved-hint"
        className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-3 text-xs leading-snug text-muted-foreground"
      >
        {t("master.item.responsibles.unsavedHint")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{t("master.item.responsibles.tabIntro")}</p>

      <div
        data-testid="item-responsibles-summary"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-[11px]">
          <div className="text-muted-foreground">{t("master.item.responsibles.summaryDirect")}</div>
          <div className="text-sm font-semibold tabular-nums">{summary.directFilled}</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-[11px]">
          <div className="text-muted-foreground">{t("master.item.responsibles.summaryBrand")}</div>
          <div className="text-sm font-semibold tabular-nums">{summary.relatedBrand}</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-[11px]">
          <div className="text-muted-foreground">{t("master.item.responsibles.summaryCategory")}</div>
          <div className="text-sm font-semibold tabular-nums">{summary.relatedCategory}</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-[11px]">
          <div className="text-muted-foreground">{t("master.item.responsibles.summaryUnavailable")}</div>
          <div className="text-sm font-semibold tabular-nums">{summary.unavailableDirect}</div>
        </div>
      </div>

      <section data-testid="item-responsibles-direct">
        <h3 className="mb-1.5 text-xs font-semibold">{t("master.item.responsibles.sectionDirect")}</h3>
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[52rem] text-[11px]">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colRole")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colEmployee")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colPositionDept")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colAvailability")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colSubstitute")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colComment")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colAssigned")}</th>
                <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colActions")}</th>
              </tr>
            </thead>
            <tbody>{directRows.map(renderDirectRow)}</tbody>
          </table>
        </div>
      </section>

      <section data-testid="item-responsibles-brand">
        <h3 className="mb-1.5 text-xs font-semibold">{t("master.item.responsibles.sectionBrand")}</h3>
        {!item?.brandId ? (
          <div className="text-[11px] text-muted-foreground">{t("master.item.responsibles.noBrandOnItem")}</div>
        ) : relatedBrandRows.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">{t("master.item.responsibles.relatedEmpty")}</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full min-w-[44rem] text-[11px]">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colEmployee")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colBusinessRoles")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colScope")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colPositionDept")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colAvailability")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colSubstitute")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colActions")}</th>
                </tr>
              </thead>
              <tbody>{relatedBrandRows.map((r) => renderRelatedRow(r, "brand"))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section data-testid="item-responsibles-category">
        <h3 className="mb-1.5 text-xs font-semibold">{t("master.item.responsibles.sectionCategory")}</h3>
        {!item?.categoryId ? (
          <div className="text-[11px] text-muted-foreground">{t("master.item.responsibles.noCategoryOnItem")}</div>
        ) : relatedCategoryRows.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">{t("master.item.responsibles.relatedEmpty")}</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full min-w-[44rem] text-[11px]">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colEmployee")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colBusinessRoles")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colScope")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colPositionDept")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colAvailability")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colSubstitute")}</th>
                  <th className="px-2 py-0.5 text-left font-medium">{t("master.item.responsibles.colActions")}</th>
                </tr>
              </thead>
              <tbody>{relatedCategoryRows.map((r) => renderRelatedRow(r, "category"))}</tbody>
            </table>
          </div>
        )}
      </section>

      <ItemResponsibleEditDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogServerError(null);
        }}
        fixedRoleCode={dialogFixedRole}
        initialEmployeeId={dialogInitialEmployeeId}
        employees={employees}
        busy={busy}
        serverError={dialogServerError}
        onSubmit={handleSubmitDialog}
      />
    </div>
  );
}
