import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeTabProps } from "./types";

/** Compact identity column: max width min(27rem,35%) minus 1cm on each cap + dense ERP form rhythm. */
export function EmployeeMainTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const idn = draft.identity;

  const control = "h-7 px-2 text-xs";
  const labelCls = "text-[10px] font-medium leading-none text-muted-foreground";

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="w-full max-w-[min(calc(27rem-1cm),calc(35%-1cm))] shrink-0">
        <Card className="border-0 shadow-none ring-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.main.identityTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.employeeCode")}</Label>
              <Input
                className={control}
                value={idn.employeeCode}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, employeeCode: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.personnelNumber")}</Label>
              <Input
                className={control}
                value={idn.personnelNumber}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, personnelNumber: e.target.value } }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.fullName")}</Label>
              <Input
                className={control}
                value={idn.fullName}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, fullName: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.displayName")}</Label>
              <Input
                className={control}
                value={idn.displayName}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, displayName: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.status")}</Label>
              <select
                className={`flex w-full rounded-md border border-input bg-background ${control}`}
                value={idn.status}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    identity: { ...p.identity, status: e.target.value as typeof idn.status },
                  }))
                }
              >
                <option value="active">{t("employees.enums.recordStatus.active")}</option>
                <option value="inactive">{t("employees.enums.recordStatus.inactive")}</option>
                <option value="terminated">{t("employees.enums.recordStatus.terminated")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.employmentStart")}</Label>
              <Input
                type="date"
                className={control}
                value={idn.employmentStartDate}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, employmentStartDate: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.employmentEnd")}</Label>
              <Input
                type="date"
                className={control}
                value={idn.employmentEndDate ?? ""}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    identity: { ...p.identity, employmentEndDate: e.target.value || null },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.comment")}</Label>
              <Textarea
                className="min-h-[64px] resize-y text-xs leading-snug"
                value={idn.comment}
                onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, comment: e.target.value } }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
