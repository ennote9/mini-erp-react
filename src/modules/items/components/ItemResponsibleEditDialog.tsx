import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import type { ItemResponsibleRoleCode } from "../model";
import { ITEM_RESPONSIBLE_ROLE_CODES } from "../lib/itemResponsibles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/shared/i18n/context";
import type { Employee } from "@/modules/employees/model";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, role dropdown is hidden / fixed. */
  fixedRoleCode?: ItemResponsibleRoleCode;
  /** Pre-selected employee (e.g. quick assign from related list). */
  initialEmployeeId?: string;
  initialNote?: string;
  employees: Employee[];
  busy?: boolean;
  serverError?: string | null;
  onSubmit: (data: { roleCode: ItemResponsibleRoleCode; employeeId: string; note: string }) => void | Promise<void>;
};

export function ItemResponsibleEditDialog({
  open,
  onOpenChange,
  fixedRoleCode,
  initialEmployeeId,
  initialNote,
  employees,
  busy,
  serverError,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [roleCode, setRoleCode] = useState<ItemResponsibleRoleCode>(
    fixedRoleCode ?? ITEM_RESPONSIBLE_ROLE_CODES[0],
  );
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.identity.displayName.localeCompare(b.identity.displayName)),
    [employees],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRoleCode(fixedRoleCode ?? ITEM_RESPONSIBLE_ROLE_CODES[0]);
    setEmployeeId(initialEmployeeId ?? "");
    setNote(initialNote ?? "");
  }, [open, fixedRoleCode, initialEmployeeId, initialNote]);

  const handleSubmit = () => {
    void (async () => {
      setError(null);
      const rid = employeeId.trim();
      if (!rid) {
        setError(t("master.item.responsibles.validationEmployee"));
        return;
      }
      const rc = fixedRoleCode ?? roleCode;
      await onSubmit({ roleCode: rc, employeeId: rid, note: note.trim() });
    })();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content
          data-testid="item-responsible-edit-dialog"
          className="fixed left-1/2 top-1/2 z-[131] w-[min(100vw-1.5rem,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-input bg-background p-3 shadow-lg outline-none"
          onPointerDownOutside={(e) => busy && e.preventDefault()}
        >
          <Dialog.Title className="text-sm font-semibold leading-tight">
            {t("master.item.responsibles.dialogTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[11px] text-muted-foreground">
            {t("master.item.responsibles.dialogHint")}
          </Dialog.Description>

          <div className="mt-3 space-y-2">
            {!fixedRoleCode ? (
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs">{t("master.item.responsibles.colRole")}</Label>
                <select
                  data-testid="item-responsible-dialog-role"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value as ItemResponsibleRoleCode)}
                  className={cn(
                    "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                >
                  {ITEM_RESPONSIBLE_ROLE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`master.item.responsibles.roles.${code}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded border border-border/60 bg-muted/20 px-2 py-1.5 text-[11px]">
                <span className="text-muted-foreground">{t("master.item.responsibles.colRole")}: </span>
                <span className="font-medium">{t(`master.item.responsibles.roles.${fixedRoleCode}`)}</span>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <Label className="text-xs">{t("master.item.responsibles.colEmployee")}</Label>
              <select
                data-testid="item-responsible-dialog-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className={cn(
                  "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                <option value="">{t("master.common.selectEmpty")}</option>
                {sortedEmployees.map((e) => {
                  const unavail =
                    e.identity.status !== "active" || e.availability.kind !== "active";
                  const label = `${e.identity.displayName || e.identity.fullName} (${e.identity.employeeCode})${
                    unavail ? ` — ${t("master.item.responsibles.employeeUnavailableSuffix")}` : ""
                  }`;
                  return (
                    <option key={e.id} value={e.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <Label className="text-xs">{t("master.item.responsibles.colComment")}</Label>
              <textarea
                data-testid="item-responsible-dialog-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none rounded border border-input bg-background px-2 py-1 text-xs"
              />
            </div>

            {error ? <div className="text-[11px] text-destructive">{error}</div> : null}
            {serverError ? <div className="text-[11px] text-destructive">{serverError}</div> : null}

            <div className="flex justify-end gap-1.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={busy}
                data-testid="item-responsible-dialog-submit"
                onClick={handleSubmit}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
