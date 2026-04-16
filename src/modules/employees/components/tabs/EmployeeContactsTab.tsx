import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeTabProps } from "./types";

export function EmployeeContactsTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const c = draft.contacts;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t("employees.tabs.contacts.title")}</CardTitle>
        <CardDescription className="text-xs">{t("employees.tabs.contacts.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.workEmail")}</Label>
          <Input
            className="h-8 text-sm"
            value={c.workEmail}
            onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, workEmail: e.target.value } }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.workPhone")}</Label>
          <Input
            className="h-8 text-sm"
            value={c.workPhone}
            onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, workPhone: e.target.value } }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.internalExtension")}</Label>
          <Input
            className="h-8 text-sm"
            value={c.internalExtension}
            onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, internalExtension: e.target.value } }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("employees.fields.corporateMessenger")}</Label>
          <Input
            className="h-8 text-sm"
            value={c.corporateMessengerId}
            onChange={(e) =>
              patch((p) => ({ ...p, contacts: { ...p.contacts, corporateMessengerId: e.target.value } }))
            }
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">{t("employees.fields.officeLocation")}</Label>
          <Input
            className="h-8 text-sm"
            value={c.officeLocation}
            onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, officeLocation: e.target.value } }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
