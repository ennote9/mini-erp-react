import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import type { EmployeeGender, EmployeeIdentityDocumentType } from "../../model";
import type { EmployeeTabProps } from "./types";

const GENDERS: EmployeeGender[] = ["unspecified", "female", "male"];
const DOC_TYPES: EmployeeIdentityDocumentType[] = [
  "id_card_kz",
  "passport_kz",
  "passport_foreign",
  "residence_permit",
  "other",
];

/** Cards share one sizing rule; max width keeps forms readable in wide grid cells. */
const cardClass =
  "border-0 shadow-none ring-0 min-w-0 w-full max-w-[32rem] justify-self-stretch h-fit";

/** Compact Main tab: dense ERP form rhythm; sections tile in a wrapping grid on wider viewports. */
export function EmployeeMainTab({ draft, patch }: EmployeeTabProps) {
  const { t } = useTranslation();
  const idn = draft.identity;
  const pp = draft.personProfile;

  const control = "h-7 px-2 text-xs";
  const labelCls = "text-[10px] font-medium leading-none text-muted-foreground";

  return (
    <div
      className={
        "grid w-full max-w-[min(100%,calc(32rem*2+0.25rem))] grid-cols-1 gap-3 " +
        "sm:grid-cols-2 sm:items-start sm:justify-items-stretch sm:gap-x-1 sm:gap-y-3"
      }
    >
      <Card className={cardClass}>
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

      <Card className={cardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.main.personalTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.dateOfBirth")}</Label>
              <Input
                type="date"
                className={control}
                value={pp.personal.dateOfBirth}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, dateOfBirth: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.gender")}</Label>
              <select
                className={`flex w-full rounded-md border border-input bg-background ${control}`}
                value={pp.personal.gender}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      personal: { ...p.personProfile.personal, gender: e.target.value as EmployeeGender },
                    },
                  }))
                }
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t(`employees.enums.gender.${g}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.citizenship")}</Label>
              <Input
                className={control}
                value={pp.personal.citizenship}
                placeholder={t("employees.placeholders.citizenship")}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, citizenship: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.iin")}</Label>
              <Input
                className={control}
                inputMode="numeric"
                maxLength={12}
                autoComplete="off"
                value={pp.personal.iin}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, iin: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.placeOfBirth")}</Label>
              <Input
                className={control}
                value={pp.personal.placeOfBirth}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, placeOfBirth: e.target.value } },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

      <Card className={cardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.main.documentTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.documentType")}</Label>
              <select
                className={`flex w-full rounded-md border border-input bg-background ${control}`}
                value={pp.identityDocument.documentType}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      identityDocument: {
                        ...p.personProfile.identityDocument,
                        documentType: e.target.value as EmployeeIdentityDocumentType,
                      },
                    },
                  }))
                }
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`employees.enums.identityDocumentType.${d}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.documentNumber")}</Label>
              <Input
                className={control}
                value={pp.identityDocument.documentNumber}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      identityDocument: { ...p.personProfile.identityDocument, documentNumber: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.issuingAuthority")}</Label>
              <Input
                className={control}
                value={pp.identityDocument.issuingAuthority}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      identityDocument: { ...p.personProfile.identityDocument, issuingAuthority: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.issueDate")}</Label>
              <Input
                type="date"
                className={control}
                value={pp.identityDocument.issueDate}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      identityDocument: { ...p.personProfile.identityDocument, issueDate: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.expiryDate")}</Label>
              <Input
                type="date"
                className={control}
                value={pp.identityDocument.expiryDate ?? ""}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      identityDocument: {
                        ...p.personProfile.identityDocument,
                        expiryDate: e.target.value || null,
                      },
                    },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

      <Card className={cardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.main.addressTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.country")}</Label>
              <Input
                className={control}
                value={pp.address.country}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, address: { ...p.personProfile.address, country: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.region")}</Label>
              <Input
                className={control}
                value={pp.address.region}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, address: { ...p.personProfile.address, region: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.city")}</Label>
              <Input
                className={control}
                value={pp.address.city}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, address: { ...p.personProfile.address, city: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.residentialAddress")}</Label>
              <Textarea
                className="min-h-[56px] resize-y text-xs leading-snug"
                value={pp.address.residentialAddress}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      address: { ...p.personProfile.address, residentialAddress: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.registrationAddress")}</Label>
              <Textarea
                className="min-h-[56px] resize-y text-xs leading-snug"
                value={pp.address.registrationAddress}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      address: { ...p.personProfile.address, registrationAddress: e.target.value },
                    },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

      <Card className={cardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold leading-tight tracking-tight">
              {t("employees.tabs.main.additionalPersonalTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label className={labelCls}>{t("employees.fields.maritalStatus")}</Label>
              <Input
                className={control}
                value={pp.personal.maritalStatus}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, maritalStatus: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.personalPhone")}</Label>
              <Input
                className={control}
                value={pp.personal.personalPhone}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, personalPhone: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.personalEmail")}</Label>
              <Input
                type="email"
                className={control}
                value={pp.personal.personalEmail}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: { ...p.personProfile, personal: { ...p.personProfile.personal, personalEmail: e.target.value } },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.emergencyContactName")}</Label>
              <Input
                className={control}
                value={pp.personal.emergencyContactName}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      personal: { ...p.personProfile.personal, emergencyContactName: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>{t("employees.fields.emergencyContactPhone")}</Label>
              <Input
                className={control}
                value={pp.personal.emergencyContactPhone}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    personProfile: {
                      ...p.personProfile,
                      personal: { ...p.personProfile.personal, emergencyContactPhone: e.target.value },
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
