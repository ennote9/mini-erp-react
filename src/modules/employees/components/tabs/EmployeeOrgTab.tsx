import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { employeeRepository } from "../../repository";
import { EMPLOYEE_DEPARTMENT_CODES, EMPLOYEE_POSITION_CODES } from "../../employeeReferenceOptions";
import type { EmployeeAssignmentScope } from "../../model";
import { translateDepartmentCode, translatePositionCode } from "../../employeeListLabels";
import type { EmployeeTabProps } from "./types";
import { Plus, Trash2 } from "lucide-react";
import { categoryRepository } from "@/modules/categories/repository";
import { brandRepository } from "@/modules/brands/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";

const SCOPE_KINDS: EmployeeAssignmentScope["kind"][] = [
  "category",
  "brand",
  "warehouse",
  "supplier",
  "customer",
  "document_type",
  "business_direction",
  "project",
];

/** Matches Main tab — keep in sync with `EmployeeMainTab` width cap. */
const MAIN_FORM_MAX_W = "max-w-[min(calc(27rem-1cm),calc(35%-1cm))]";
/** Wider cap for multi-column scope rows; still bounded vs full workspace. */
const SCOPES_BLOCK_MAX_W = "max-w-[min(52rem,94%)]";

function masterCaption(code: string, name: string): string {
  return `${code} · ${name}`;
}

export function EmployeeOrgTab({ draft, patch, selfId }: EmployeeTabProps) {
  const { t } = useTranslation();
  const o = draft.org;
  const managers = employeeRepository.list().filter((e) => e.id !== selfId && e.id !== draft.id);
  const rev = useAppReadModelRevision();

  const control = "h-7 px-2 text-xs";
  const labelCls = "text-[10px] font-medium leading-none text-muted-foreground";

  const sortedCategories = useMemo(() => {
    void rev;
    return categoryRepository
      .list()
      .slice()
      .sort((a, b) => masterCaption(a.code, a.name).localeCompare(masterCaption(b.code, b.name)));
  }, [rev]);

  const sortedBrands = useMemo(() => {
    void rev;
    return brandRepository
      .list()
      .slice()
      .sort((a, b) => masterCaption(a.code, a.name).localeCompare(masterCaption(b.code, b.name)));
  }, [rev]);

  const sortedWarehouses = useMemo(() => {
    void rev;
    return warehouseRepository
      .list()
      .slice()
      .sort((a, b) => masterCaption(a.code, a.name).localeCompare(masterCaption(b.code, b.name)));
  }, [rev]);

  const addScope = () => {
    patch((p) => ({
      ...p,
      org: {
        ...p.org,
        assignmentScopes: [
          ...p.org.assignmentScopes,
          { kind: "category", entityId: "", label: "" },
        ],
      },
    }));
  };

  const updateScope = (index: number, next: EmployeeAssignmentScope) => {
    patch((p) => {
      const scopes = p.org.assignmentScopes.slice();
      scopes[index] = next;
      return { ...p, org: { ...p.org, assignmentScopes: scopes } };
    });
  };

  const removeScope = (index: number) => {
    patch((p) => ({
      ...p,
      org: {
        ...p.org,
        assignmentScopes: p.org.assignmentScopes.filter((_, i) => i !== index),
      },
    }));
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className={`w-full shrink-0 ${MAIN_FORM_MAX_W}`}>
        <Card className="border-0 shadow-none ring-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.org.structureTitle")}
            </CardTitle>
            <CardDescription className="text-[11px] leading-snug text-muted-foreground">
              {t("employees.tabs.org.structureHint")}
            </CardDescription>
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
          </CardContent>
        </Card>
      </div>

      <div className={`w-full shrink-0 ${SCOPES_BLOCK_MAX_W}`}>
        <Card className="border-0 shadow-none ring-0">
          <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
                {t("employees.tabs.org.scopesTitle")}
              </CardTitle>
              <CardDescription className="text-[11px] leading-snug text-muted-foreground">
                {t("employees.tabs.org.scopesHint")}
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={addScope}>
              <Plus className="h-3.5 w-3.5" />
              {t("employees.actions.addScope")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {o.assignmentScopes.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">{t("employees.tabs.org.scopesEmpty")}</div>
            ) : (
              <div className="space-y-1.5">
                {o.assignmentScopes.map((row, index) => (
                  <div key={index} className="grid gap-1.5 rounded-md border border-border/60 p-1.5 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <Label className={labelCls}>{t("employees.fields.scopeKind")}</Label>
                      <select
                        className={`mt-0.5 flex w-full rounded-md border border-input bg-background ${control}`}
                        value={row.kind}
                        onChange={(e) =>
                          updateScope(index, {
                            ...row,
                            kind: e.target.value as EmployeeAssignmentScope["kind"],
                            entityId: "",
                            label: "",
                          })
                        }
                      >
                        {SCOPE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t(`employees.scopeKind.${k}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <Label className={labelCls}>
                        {row.kind === "category" || row.kind === "brand" || row.kind === "warehouse"
                          ? t("employees.fields.scopeMasterRecord")
                          : t("employees.fields.entityId")}
                      </Label>
                      {row.kind === "category" ? (
                        <select
                          className={`mt-0.5 flex w-full rounded-md border border-input bg-background ${control}`}
                          value={row.entityId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const c = categoryRepository.getById(id);
                            updateScope(index, {
                              ...row,
                              entityId: id,
                              label: c ? masterCaption(c.code, c.name) : "",
                            });
                          }}
                        >
                          <option value="">{t("employees.placeholders.selectRecord")}</option>
                          {sortedCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {masterCaption(c.code, c.name)}
                            </option>
                          ))}
                        </select>
                      ) : row.kind === "brand" ? (
                        <select
                          className={`mt-0.5 flex w-full rounded-md border border-input bg-background ${control}`}
                          value={row.entityId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const b = brandRepository.getById(id);
                            updateScope(index, {
                              ...row,
                              entityId: id,
                              label: b ? masterCaption(b.code, b.name) : "",
                            });
                          }}
                        >
                          <option value="">{t("employees.placeholders.selectRecord")}</option>
                          {sortedBrands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {masterCaption(b.code, b.name)}
                            </option>
                          ))}
                        </select>
                      ) : row.kind === "warehouse" ? (
                        <select
                          className={`mt-0.5 flex w-full rounded-md border border-input bg-background ${control}`}
                          value={row.entityId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const w = warehouseRepository.getById(id);
                            updateScope(index, {
                              ...row,
                              entityId: id,
                              label: w ? masterCaption(w.code, w.name) : "",
                            });
                          }}
                        >
                          <option value="">{t("employees.placeholders.selectRecord")}</option>
                          {sortedWarehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {masterCaption(w.code, w.name)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          className={`mt-0.5 ${control}`}
                          value={row.entityId}
                          onChange={(e) => updateScope(index, { ...row, entityId: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="md:col-span-5">
                      <Label className={labelCls}>{t("employees.fields.scopeLabel")}</Label>
                      <Input
                        className={`mt-0.5 ${control}`}
                        value={row.label}
                        onChange={(e) => updateScope(index, { ...row, label: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end justify-end md:col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        title={t("common.delete")}
                        onClick={() => removeScope(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
