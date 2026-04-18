import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Item, ItemResponsibleRoleCode } from "../model";
import { itemRepository } from "../repository";
import { employeeRepository } from "@/modules/employees/repository";
import type { Employee } from "@/modules/employees/model";
import {
  attachEmployeesToDirectRows,
  buildDirectAssignmentRows,
  isEmployeeOperationallyUnavailable,
  type DirectAssignmentRowModel,
} from "../lib/itemResponsibles";
import {
  removeItemResponsibleAssignmentAwaitPersist,
  upsertItemResponsibleAssignmentAwaitPersist,
} from "../itemResponsibleService";
import { ItemResponsibleEditDialog } from "./ItemResponsibleEditDialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n/context";
import { cn } from "@/lib/utils";

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

  const directRows = useMemo(() => {
    if (!item) return [];
    const base = buildDirectAssignmentRows(item);
    return attachEmployeesToDirectRows(base, employeesById);
  }, [item, employeesById]);

  const openAssign = useCallback((roleCode: ItemResponsibleRoleCode) => {
    setDialogServerError(null);
    setDialogFixedRole(roleCode);
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
    const filled = Boolean(a && emp);
    const highlightAvail = emp && isEmployeeOperationallyUnavailable(emp);
    const subId = emp?.availability.substituteEmployeeId;

    return (
      <tr
        key={row.roleCode}
        data-filled={filled ? "true" : "false"}
        className={cn(
          "border-t border-border/60 bg-transparent",
          !filled && "text-muted-foreground",
        )}
      >
        <td className={cn("px-2 py-1 align-top text-[11px] font-medium", !filled && "italic text-muted-foreground/90")}>
          {t(`master.item.responsibles.roles.${row.roleCode}`)}
        </td>
        <td className="px-2 py-1 align-top text-[11px]">
          {emp ? (
            <Link className="list-table__link font-medium text-foreground" to={`/employees/${encodeURIComponent(emp.id)}`}>
              {row.display?.displayName ?? emp.identity.displayName}
            </Link>
          ) : (
            <span className="text-muted-foreground/80">{t("master.item.responsibles.emptyRole")}</span>
          )}
        </td>
        <td className={cn("px-2 py-1 align-top text-[11px]", filled ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {row.display?.positionDepartment ?? "—"}
        </td>
        <td
          className={cn(
            "px-2 py-1 align-top text-[11px]",
            highlightAvail && filled && "font-medium text-amber-800 dark:text-amber-500/95",
            !filled && "text-muted-foreground/70",
          )}
        >
          {emp ? (
            <div className="space-y-0.5">
              <div>{availabilityLabel(emp)}</div>
              {emp.identity.status !== "active" ? (
                <div className="text-[10px] font-normal text-amber-700/90 dark:text-amber-400/90">
                  {recordStatusLabel(emp)}
                </div>
              ) : null}
            </div>
          ) : (
            "—"
          )}
        </td>
        <td
          className={cn(
            "px-2 py-1 align-top text-[11px]",
            subId && filled && "font-medium text-foreground/95",
            !filled && "text-muted-foreground/70",
          )}
        >
          {subId ? substituteName(subId) : "—"}
        </td>
        <td className={cn("px-2 py-1 align-top text-[11px]", filled ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {a?.note?.trim() ? a.note : "—"}
        </td>
        <td className={cn("px-2 py-1 align-top text-[11px]", filled ? "text-muted-foreground" : "text-muted-foreground/70")}>
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
    <div data-testid="item-responsibles-direct">
      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[52rem] bg-transparent text-[11px]">
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
          <tbody className="bg-transparent [&_tr]:bg-transparent">{directRows.map(renderDirectRow)}</tbody>
        </table>
      </div>

      <ItemResponsibleEditDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogServerError(null);
        }}
        fixedRoleCode={dialogFixedRole}
        employees={employees}
        itemBrandId={item?.brandId}
        itemCategoryId={item?.categoryId}
        busy={busy}
        serverError={dialogServerError}
        onSubmit={handleSubmitDialog}
      />
    </div>
  );
}
