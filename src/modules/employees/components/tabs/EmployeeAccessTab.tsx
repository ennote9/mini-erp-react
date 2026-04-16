import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { EMPLOYEE_MODULE_CODES, EMPLOYEE_PERMISSION_GROUPS } from "../../employeeReferenceOptions";
import { EMPLOYEE_PRIMARY_ROLE_CODES } from "../../employeeListConstants";
import { translateSystemRoleCode } from "../../employeeListLabels";
import type { EmployeeTabProps } from "./types";
import { EmployeeAccessDataScopes } from "../EmployeeAccessDataScopes";

function toggleCode(list: string[], code: string, on: boolean): string[] {
  const set = new Set(list);
  if (on) set.add(code);
  else set.delete(code);
  return [...set];
}

export function EmployeeAccessTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const a = draft.access;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.access.accountTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.access.accountHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              id="erp-user"
              checked={a.isErpUser}
              onCheckedChange={(v) => patch((p) => ({ ...p, access: { ...p.access, isErpUser: v === true } }))}
            />
            <Label htmlFor="erp-user" className="text-sm">
              {t("employees.fields.isErpUser")}
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.login")}</Label>
            <Input
              className="h-8 text-sm"
              disabled={!a.isErpUser}
              value={a.login}
              onChange={(e) => patch((p) => ({ ...p, access: { ...p.access, login: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.accessStatus")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={a.accessStatus}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  access: { ...p.access, accessStatus: e.target.value as typeof a.accessStatus },
                }))
              }
            >
              <option value="active">{t("employees.enums.accessStatus.active")}</option>
              <option value="blocked">{t("employees.enums.accessStatus.blocked")}</option>
              <option value="pending">{t("employees.enums.accessStatus.pending")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.primaryRole")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={a.primaryRoleCode}
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
            <Label className="text-xs">{t("employees.fields.permissionGroup")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={a.permissionGroupCode}
              onChange={(e) =>
                patch((p) => ({ ...p, access: { ...p.access, permissionGroupCode: e.target.value } }))
              }
            >
              {EMPLOYEE_PERMISSION_GROUPS.map((c) => (
                <option key={c} value={c}>
                  {t(`employees.dict.permissionGroup.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.lastLoginAt")}</Label>
            <Input
              className="h-8 text-sm"
              readOnly
              value={a.lastLoginAt ?? ""}
              title={t("employees.tabs.access.lastLoginReadonly")}
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              id="admin-flag"
              checked={a.isAdministrator}
              onCheckedChange={(v) => patch((p) => ({ ...p, access: { ...p.access, isAdministrator: v === true } }))}
            />
            <Label htmlFor="admin-flag" className="text-sm">
              {t("employees.fields.isAdministrator")}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.access.scopesTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.access.scopesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.financeVisibility")}</Label>
            <select
              className="flex h-8 max-w-xs rounded-md border border-input bg-background px-2 text-sm"
              value={a.financeVisibility}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  access: { ...p.access, financeVisibility: e.target.value as typeof a.financeVisibility },
                }))
              }
            >
              <option value="none">{t("employees.enums.financeVisibility.none")}</option>
              <option value="limited">{t("employees.enums.financeVisibility.limited")}</option>
              <option value="full">{t("employees.enums.financeVisibility.full")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.priceVisibility")}</Label>
            <select
              className="flex h-8 max-w-xs rounded-md border border-input bg-background px-2 text-sm"
              value={a.priceVisibility}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  access: { ...p.access, priceVisibility: e.target.value as typeof a.priceVisibility },
                }))
              }
            >
              <option value="none">{t("employees.enums.priceVisibility.none")}</option>
              <option value="standard">{t("employees.enums.priceVisibility.standard")}</option>
              <option value="extended">{t("employees.enums.priceVisibility.extended")}</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["canApprove", t("employees.fields.canApprove")],
                ["canReview", t("employees.fields.canReview")],
                ["canEditMaster", t("employees.fields.canEditMaster")],
                ["canDeleteDocuments", t("employees.fields.canDeleteDocuments")],
                ["canArchive", t("employees.fields.canArchive")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`acc-${key}`}
                  checked={a[key]}
                  onCheckedChange={(v) =>
                    patch((p) => ({ ...p, access: { ...p.access, [key]: v === true } as typeof p.access }))
                  }
                />
                <Label htmlFor={`acc-${key}`} className="text-xs">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("employees.fields.allowedModules")}</Label>
            <div className="grid max-h-48 gap-1.5 overflow-auto rounded-md border border-border/60 p-2 sm:grid-cols-2">
              {EMPLOYEE_MODULE_CODES.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <Checkbox
                    id={`mod-${code}`}
                    checked={a.allowedModuleCodes.includes(code)}
                    disabled={!a.isErpUser}
                    onCheckedChange={(v) =>
                      patch((p) => ({
                        ...p,
                        access: {
                          ...p.access,
                          allowedModuleCodes: toggleCode(p.access.allowedModuleCodes, code, v === true),
                        },
                      }))
                    }
                  />
                  <Label htmlFor={`mod-${code}`} className="text-xs">
                    {t(`employees.dict.module.${code}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div>
              <div className="text-xs font-medium text-foreground">{t("employees.tabs.access.scopesDataTitle")}</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("employees.tabs.access.scopesDataHint")}</p>
            </div>
            {!a.isErpUser ? (
              <p className="text-xs text-muted-foreground">{t("employees.tabs.access.scopesDataDisabledHint")}</p>
            ) : null}
            <EmployeeAccessDataScopes
              warehouseScopeIds={a.warehouseScopeIds}
              categoryScopeIds={a.categoryScopeIds}
              brandScopeIds={a.brandScopeIds}
              disabled={!a.isErpUser}
              onPatchScopes={(next) =>
                patch((p) => ({
                  ...p,
                  access: {
                    ...p.access,
                    warehouseScopeIds: next.warehouseScopeIds,
                    categoryScopeIds: next.categoryScopeIds,
                    brandScopeIds: next.brandScopeIds,
                  },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
