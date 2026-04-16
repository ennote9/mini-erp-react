import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { employeeRepository } from "../../repository";
import type { EmployeeTabProps } from "./types";

export function EmployeeAvailabilityTab({ draft, patch, selfId }: EmployeeTabProps) {
  const { t } = useTranslation();
  const a = draft.availability;
  const substitutes = employeeRepository.list().filter((e) => e.id !== selfId && e.id !== draft.id);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t("employees.tabs.availability.title")}</CardTitle>
        <CardDescription className="text-xs">{t("employees.tabs.availability.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.availabilityKind")}</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={a.kind}
            onChange={(e) =>
              patch((p) => ({
                ...p,
                availability: { ...p.availability, kind: e.target.value as typeof a.kind },
              }))
            }
          >
            <option value="active">{t("employees.enums.availability.active")}</option>
            <option value="vacation">{t("employees.enums.availability.vacation")}</option>
            <option value="sick_leave">{t("employees.enums.availability.sick_leave")}</option>
            <option value="dismissed">{t("employees.enums.availability.dismissed")}</option>
            <option value="temporarily_unavailable">
              {t("employees.enums.availability.temporarily_unavailable")}
            </option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.substituteEmployee")}</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={a.substituteEmployeeId ?? ""}
            onChange={(e) =>
              patch((p) => ({
                ...p,
                availability: { ...p.availability, substituteEmployeeId: e.target.value || null },
              }))
            }
          >
            <option value="">{t("employees.placeholders.none")}</option>
            {substitutes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.identity.displayName || e.identity.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.periodStart")}</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={a.periodStart}
            onChange={(e) => patch((p) => ({ ...p, availability: { ...p.availability, periodStart: e.target.value } }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.periodEnd")}</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={a.periodEnd ?? ""}
            onChange={(e) =>
              patch((p) => ({
                ...p,
                availability: { ...p.availability, periodEnd: e.target.value || null },
              }))
            }
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">{t("employees.fields.availabilityComment")}</Label>
          <Textarea
            className="min-h-[72px] text-sm"
            value={a.comment}
            onChange={(e) => patch((p) => ({ ...p, availability: { ...p.availability, comment: e.target.value } }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
