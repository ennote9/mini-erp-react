import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { EMPLOYEE_BUSINESS_ROLE_CODES } from "../../employeeReferenceOptions";
import type { EmployeeBusinessRoleAssignment, EmployeeProcessParticipation } from "../../model";
import type { EmployeeTabProps } from "./types";
import { Plus, Trash2 } from "lucide-react";

export function EmployeeBusinessRolesTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const b = draft.businessRoles;

  const addRole = () => {
    patch((p) => ({
      ...p,
      businessRoles: {
        ...p.businessRoles,
        assignedRoles: [
          ...p.businessRoles.assignedRoles,
          { roleCode: "OPERATOR", description: "", objectsHint: "" },
        ],
      },
    }));
  };

  const updateRole = (i: number, row: EmployeeBusinessRoleAssignment) => {
    patch((p) => {
      const roles = p.businessRoles.assignedRoles.slice();
      roles[i] = row;
      return { ...p, businessRoles: { ...p.businessRoles, assignedRoles: roles } };
    });
  };

  const removeRole = (i: number) => {
    patch((p) => ({
      ...p,
      businessRoles: {
        ...p.businessRoles,
        assignedRoles: p.businessRoles.assignedRoles.filter((_, idx) => idx !== i),
      },
    }));
  };

  const addParticipation = () => {
    patch((p) => ({
      ...p,
      businessRoles: {
        ...p.businessRoles,
        processParticipations: [...p.businessRoles.processParticipations, { participationType: "", detail: "" }],
      },
    }));
  };

  const updatePart = (i: number, row: EmployeeProcessParticipation) => {
    patch((p) => {
      const rows = p.businessRoles.processParticipations.slice();
      rows[i] = row;
      return { ...p, businessRoles: { ...p.businessRoles, processParticipations: rows } };
    });
  };

  const removePart = (i: number) => {
    patch((p) => ({
      ...p,
      businessRoles: {
        ...p.businessRoles,
        processParticipations: p.businessRoles.processParticipations.filter((_, idx) => idx !== i),
      },
    }));
  };

  const apprText = b.approvalResponsibilities.join("\n");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <CardTitle className="text-sm">{t("employees.tabs.business.rolesTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("employees.tabs.business.rolesHint")}</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addRole}>
            <Plus className="h-3.5 w-3.5" />
            {t("employees.actions.addBusinessRole")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {b.assignedRoles.length === 0 ? (
            <div className="text-xs text-muted-foreground">{t("employees.tabs.business.rolesEmpty")}</div>
          ) : (
            b.assignedRoles.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border/60 p-2 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Label className="text-[10px] text-muted-foreground">{t("employees.fields.businessRoleCode")}</Label>
                  <select
                    className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={row.roleCode}
                    onChange={(e) => updateRole(i, { ...row, roleCode: e.target.value })}
                  >
                    {EMPLOYEE_BUSINESS_ROLE_CODES.map((c) => (
                      <option key={c} value={c}>
                        {t(`employees.dict.businessRole.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <Label className="text-[10px] text-muted-foreground">{t("employees.fields.roleDescription")}</Label>
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={row.description}
                    onChange={(e) => updateRole(i, { ...row, description: e.target.value })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-[10px] text-muted-foreground">{t("employees.fields.objectsHint")}</Label>
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={row.objectsHint}
                    onChange={(e) => updateRole(i, { ...row, objectsHint: e.target.value })}
                  />
                </div>
                <div className="flex items-end justify-end md:col-span-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeRole(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <CardTitle className="text-sm">{t("employees.tabs.business.processTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("employees.tabs.business.processHint")}</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addParticipation}>
            <Plus className="h-3.5 w-3.5" />
            {t("employees.actions.addParticipation")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {b.processParticipations.length === 0 ? (
            <div className="text-xs text-muted-foreground">{t("employees.tabs.business.processEmpty")}</div>
          ) : (
            b.processParticipations.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border/60 p-2 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label className="text-[10px] text-muted-foreground">{t("employees.fields.participationType")}</Label>
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={row.participationType}
                    onChange={(e) => updatePart(i, { ...row, participationType: e.target.value })}
                  />
                </div>
                <div className="md:col-span-7">
                  <Label className="text-[10px] text-muted-foreground">{t("employees.fields.participationDetail")}</Label>
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={row.detail}
                    onChange={(e) => updatePart(i, { ...row, detail: e.target.value })}
                  />
                </div>
                <div className="flex items-end justify-end md:col-span-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => removePart(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.business.approvalTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.business.approvalHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.approvalResponsibilities")}</Label>
            <Textarea
              className="min-h-[80px] text-xs"
              value={apprText}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  businessRoles: {
                    ...p.businessRoles,
                    approvalResponsibilities: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dbl"
                checked={b.canDoubleCheck}
                onCheckedChange={(v) =>
                  patch((p) => ({ ...p, businessRoles: { ...p.businessRoles, canDoubleCheck: v === true } }))
                }
              />
              <Label htmlFor="dbl" className="text-sm">
                {t("employees.fields.canDoubleCheck")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="fin"
                checked={b.canFinalApprove}
                onCheckedChange={(v) =>
                  patch((p) => ({ ...p, businessRoles: { ...p.businessRoles, canFinalApprove: v === true } }))
                }
              />
              <Label htmlFor="fin" className="text-sm">
                {t("employees.fields.canFinalApprove")}
              </Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.responsibleForObjectsNote")}</Label>
            <Textarea
              className="min-h-[64px] text-sm"
              value={b.responsibleForObjectsNote}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  businessRoles: { ...p.businessRoles, responsibleForObjectsNote: e.target.value },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
