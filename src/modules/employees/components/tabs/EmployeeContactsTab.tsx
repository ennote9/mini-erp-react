import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeTabProps } from "./types";

/** Matches Main tab — keep in sync with `EmployeeMainTab` width cap. */
const MAIN_FORM_MAX_W = "max-w-[min(calc(27rem-1cm),calc(35%-1cm))]";

export function EmployeeContactsTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const c = draft.contacts;

  const control = "h-7 px-2 text-xs";
  const labelCls = "text-[10px] font-medium leading-none text-muted-foreground";

  return (
    <div className={`w-full shrink-0 ${MAIN_FORM_MAX_W}`}>
      <Card className="border-0 shadow-none ring-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
            {t("employees.tabs.contacts.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.workEmail")}</Label>
            <Input
              className={control}
              value={c.workEmail}
              onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, workEmail: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.workPhone")}</Label>
            <Input
              className={control}
              value={c.workPhone}
              onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, workPhone: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.fields.internalExtension")}</Label>
            <Input
              className={control}
              value={c.internalExtension}
              onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, internalExtension: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>{t("employees.tabs.contacts.messengerLabel")}</Label>
            <Input
              className={control}
              value={c.corporateMessengerId}
              onChange={(e) =>
                patch((p) => ({ ...p, contacts: { ...p.contacts, corporateMessengerId: e.target.value } }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className={labelCls}>{t("employees.fields.officeLocation")}</Label>
            <Input
              className={control}
              value={c.officeLocation}
              onChange={(e) => patch((p) => ({ ...p, contacts: { ...p.contacts, officeLocation: e.target.value } }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
