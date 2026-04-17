import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { employeeRepository } from "../../repository";
import { EMPLOYEE_DEPARTMENT_CODES, EMPLOYEE_POSITION_CODES } from "../../employeeReferenceOptions";
import {
  translateDepartmentCode,
  translateEmploymentType,
  translatePositionCode,
  translateWorkSchedule,
} from "../../employeeListLabels";
import {
  EMPLOYEE_EMPLOYMENT_TYPES,
  EMPLOYEE_WORK_SCHEDULES,
  type EmployeeEmploymentType,
  type EmployeeWorkSchedule,
} from "../../model";
import type { EmployeeTabProps } from "./types";

/** Matches Main tab — keep in sync with `EmployeeMainTab` width cap. */
const MAIN_FORM_MAX_W = "max-w-[min(calc(27rem-1cm),calc(35%-1cm))]";

export function EmployeeOrgTab({ draft, patch, selfId }: EmployeeTabProps) {
  const { t } = useTranslation();
  const o = draft.org;
  const managers = employeeRepository.list().filter((e) => e.id !== selfId && e.id !== draft.id);

  const control = "h-7 px-2 text-xs";
  const labelCls = "text-[10px] font-medium leading-none text-muted-foreground";

  return (
    <div className={`w-full shrink-0 ${MAIN_FORM_MAX_W}`}>
      <Card className="border-0 shadow-none ring-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
            {t("employees.tabs.org.structureTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.department")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.departmentCode}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  org: { ...p.org, departmentCode: e.target.value },
                  identity: { ...p.identity, departmentCode: e.target.value },
                }))
              }
            >
              {EMPLOYEE_DEPARTMENT_CODES.map((c) => (
                <option key={c} value={c}>
                  {translateDepartmentCode(t, c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.position")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.positionCode}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  org: { ...p.org, positionCode: e.target.value },
                  identity: { ...p.identity, positionCode: e.target.value },
                }))
              }
            >
              {EMPLOYEE_POSITION_CODES.map((c) => (
                <option key={c} value={c}>
                  {translatePositionCode(t, c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.directManager")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.directManagerId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                patch((p) => ({
                  ...p,
                  org: { ...p.org, directManagerId: v },
                  identity: { ...p.identity, directManagerId: v },
                }));
              }}
            >
              <option value="">{t("employees.placeholders.none")}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.identity.displayName || m.identity.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.functionalManager")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.functionalManagerId ?? ""}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  org: { ...p.org, functionalManagerId: e.target.value || null },
                }))
              }
            >
              <option value="">{t("employees.placeholders.none")}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.identity.displayName || m.identity.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.teamOrGroup")}</Label>
            <Input
              className={control}
              value={o.teamOrGroup}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, teamOrGroup: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.responsibilityZone")}</Label>
            <Input
              className={control}
              value={o.responsibilityZone}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, responsibilityZone: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.employmentType")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.employmentType}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  org: { ...p.org, employmentType: e.target.value as EmployeeEmploymentType },
                }))
              }
            >
              {EMPLOYEE_EMPLOYMENT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {translateEmploymentType(t, c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.workSchedule")}</Label>
            <select
              className={`flex w-full rounded-md border border-input bg-background ${control}`}
              value={o.workSchedule}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  org: { ...p.org, workSchedule: e.target.value as EmployeeWorkSchedule },
                }))
              }
            >
              {EMPLOYEE_WORK_SCHEDULES.map((c) => (
                <option key={c} value={c}>
                  {translateWorkSchedule(t, c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className={labelCls}>{t("employees.fields.shiftCrew")}</Label>
            <Input
              className={control}
              value={o.shiftLabel}
              placeholder={t("employees.placeholders.shiftCrew")}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, shiftLabel: e.target.value } }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
