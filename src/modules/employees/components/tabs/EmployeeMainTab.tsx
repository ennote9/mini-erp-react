import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { employeeRepository } from "../../repository";
import { EMPLOYEE_DEPARTMENT_CODES, EMPLOYEE_POSITION_CODES } from "../../employeeReferenceOptions";
import { EMPLOYEE_PRIMARY_ROLE_CODES } from "../../employeeListConstants";
import { translateDepartmentCode, translatePositionCode, translateSystemRoleCode } from "../../employeeListLabels";
import type { EmployeeTabProps } from "./types";

export function EmployeeMainTab({ draft, patch, selfId }: EmployeeTabProps) {
  const { t } = useTranslation();
  const idn = draft.identity;
  const managers = employeeRepository.list().filter((e) => e.id !== selfId && e.id !== draft.id);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.main.identityTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.main.identityHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.employeeCode")}</Label>
            <Input
              className="h-8 text-sm"
              value={idn.employeeCode}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, employeeCode: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.personnelNumber")}</Label>
            <Input
              className="h-8 text-sm"
              value={idn.personnelNumber}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, personnelNumber: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">{t("employees.fields.fullName")}</Label>
            <Input
              className="h-8 text-sm"
              value={idn.fullName}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, fullName: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.displayName")}</Label>
            <Input
              className="h-8 text-sm"
              value={idn.displayName}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, displayName: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.status")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.position")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={idn.positionCode}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  identity: { ...p.identity, positionCode: e.target.value },
                  org: { ...p.org, positionCode: e.target.value },
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.department")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={idn.departmentCode}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  identity: { ...p.identity, departmentCode: e.target.value },
                  org: { ...p.org, departmentCode: e.target.value },
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.primarySystemRole")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={draft.access.primaryRoleCode}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  access: { ...p.access, primaryRoleCode: e.target.value },
                  identity: { ...p.identity, primarySystemRoleCode: e.target.value },
                }))
              }
            >
              {EMPLOYEE_PRIMARY_ROLE_CODES.map((c) => (
                <option key={c} value={c}>
                  {translateSystemRoleCode(t, c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.directManager")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={idn.directManagerId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                patch((p) => ({
                  ...p,
                  identity: { ...p.identity, directManagerId: v },
                  org: { ...p.org, directManagerId: v },
                }));
              }}
            >
              <option value="">{t("employees.placeholders.none")}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.identity.displayName || m.identity.fullName} ({m.identity.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.employmentStart")}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={idn.employmentStartDate}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, employmentStartDate: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.employmentEnd")}</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={idn.employmentEndDate ?? ""}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  identity: { ...p.identity, employmentEndDate: e.target.value || null },
                }))
              }
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">{t("employees.fields.photoDataUrl")}</Label>
            <Textarea
              className="min-h-[60px] text-xs"
              placeholder={t("employees.placeholders.photoDataUrl")}
              value={idn.photoDataUrl ?? ""}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  identity: { ...p.identity, photoDataUrl: e.target.value || null },
                }))
              }
            />
          </div>
          {idn.photoDataUrl?.startsWith("data:") ? (
            <div className="md:col-span-2">
              <img src={idn.photoDataUrl} alt="" className="max-h-24 rounded border border-border" />
            </div>
          ) : null}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">{t("employees.fields.comment")}</Label>
            <Textarea
              className="min-h-[72px] text-sm"
              value={idn.comment}
              onChange={(e) => patch((p) => ({ ...p, identity: { ...p.identity, comment: e.target.value } }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
