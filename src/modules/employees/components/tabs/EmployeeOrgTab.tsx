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

function masterCaption(code: string, name: string): string {
  return `${code} · ${name}`;
}

export function EmployeeOrgTab({ draft, patch, selfId }: EmployeeTabProps) {
  const { t } = useTranslation();
  const o = draft.org;
  const managers = employeeRepository.list().filter((e) => e.id !== selfId && e.id !== draft.id);
  const rev = useAppReadModelRevision();

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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("employees.tabs.org.structureTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("employees.tabs.org.structureHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.department")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.position")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.directManager")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.functionalManager")}</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.teamOrGroup")}</Label>
            <Input
              className="h-8 text-sm"
              value={o.teamOrGroup}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, teamOrGroup: e.target.value } }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("employees.fields.responsibilityZone")}</Label>
            <Input
              className="h-8 text-sm"
              value={o.responsibilityZone}
              onChange={(e) => patch((p) => ({ ...p, org: { ...p.org, responsibilityZone: e.target.value } }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <CardTitle className="text-sm">{t("employees.tabs.org.scopesTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("employees.tabs.org.scopesHint")}</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addScope}>
            <Plus className="h-3.5 w-3.5" />
            {t("employees.actions.addScope")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {o.assignmentScopes.length === 0 ? (
            <div className="text-xs text-muted-foreground">{t("employees.tabs.org.scopesEmpty")}</div>
          ) : (
            <div className="space-y-2">
              {o.assignmentScopes.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-md border border-border/60 p-2 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <Label className="text-[10px] text-muted-foreground">{t("employees.fields.scopeKind")}</Label>
                    <select
                      className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                    <Label className="text-[10px] text-muted-foreground">
                      {row.kind === "category" || row.kind === "brand" || row.kind === "warehouse"
                        ? t("employees.fields.scopeMasterRecord")
                        : t("employees.fields.entityId")}
                    </Label>
                    {row.kind === "category" ? (
                      <select
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                        className="mt-0.5 h-8 text-xs"
                        value={row.entityId}
                        onChange={(e) => updateScope(index, { ...row, entityId: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="md:col-span-5">
                    <Label className="text-[10px] text-muted-foreground">{t("employees.fields.scopeLabel")}</Label>
                    <Input
                      className="mt-0.5 h-8 text-xs"
                      value={row.label}
                      onChange={(e) => updateScope(index, { ...row, label: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end justify-end md:col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      title={t("common.delete")}
                      onClick={() => removeScope(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
