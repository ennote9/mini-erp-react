import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { carrierRepository } from "../repository";
import { saveCarrier } from "../service";
import { CARRIER_TYPE_IDS } from "../model";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  actionIssueFromServiceMessage,
  combineIssues,
  hasErrors,
  hasWarnings,
  issueListContainsMessage,
  type Issue,
} from "../../../shared/issues";
import { getCarrierFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  carrierType: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  country: string;
  city: string;
  address: string;
  comment: string;
  trackingUrlTemplate: string;
  serviceLevelDefault: string;
  paymentTermsDays: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    carrierType: "courier",
    contactPerson: "",
    phone: "",
    email: "",
    website: "",
    country: "",
    city: "",
    address: "",
    comment: "",
    trackingUrlTemplate: "",
    serviceLevelDefault: "",
    paymentTermsDays: "",
  };
}

export function CarrierPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const carrier = useMemo(
    () => (id && !isNew ? carrierRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getCarrierFormHealth({
        code: form.code,
        name: form.name,
        carrierType: form.carrierType,
        phone: form.phone,
        email: form.email,
        paymentTermsDays: form.paymentTermsDays,
      }),
    [form.code, form.name, form.carrierType, form.phone, form.email, form.paymentTermsDays],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name, form.carrierType, form.phone, form.email, form.paymentTermsDays]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (carrier) {
      setForm({
        code: carrier.code,
        name: carrier.name,
        isActive: carrier.isActive,
        carrierType: carrier.carrierType,
        contactPerson: carrier.contactPerson ?? "",
        phone: carrier.phone ?? "",
        email: carrier.email ?? "",
        website: carrier.website ?? "",
        country: carrier.country ?? "",
        city: carrier.city ?? "",
        address: carrier.address ?? "",
        comment: carrier.comment ?? "",
        trackingUrlTemplate: carrier.trackingUrlTemplate ?? "",
        serviceLevelDefault: carrier.serviceLevelDefault ?? "",
        paymentTermsDays:
          carrier.paymentTermsDays !== undefined ? String(carrier.paymentTermsDays) : "",
      });
    }
  }, [id, isNew, carrier]);

  const parsePaymentTerms = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setActionIssues([]);
    const result = saveCarrier(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        carrierType: form.carrierType,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        comment: form.comment || undefined,
        trackingUrlTemplate: form.trackingUrlTemplate || undefined,
        serviceLevelDefault: form.serviceLevelDefault || undefined,
        paymentTermsDays: parsePaymentTerms(form.paymentTermsDays),
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/carriers");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/carriers");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.carrier.notFound")}</p>
      </div>
    );
  }

  if (!isNew && !carrier) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.carrier.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/carriers" },
    { label: t("master.carrier.listBreadcrumb"), to: "/carriers" },
    { label: isNew ? t("master.common.newLabel") : carrier!.code },
  ];

  const displayTitle = isNew
    ? t("master.carrier.titleNew")
    : t("master.carrier.titleWithCode", { code: carrier!.code });

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/carriers" aria-label={t("master.carrier.backToListAria")} />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
          </div>
          <div className="doc-header__right">
            {(hasErrors(combinedIssues) || hasWarnings(combinedIssues)) && (
              <DocumentIssueStrip issues={combinedIssues} />
            )}
            <div className="doc-header__actions">
              <Button type="button" onClick={handleSave}>
                <Save aria-hidden />
                {t("common.save")}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X aria-hidden />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{t("master.carrier.futureShipmentsHint")}</p>

      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">{t("master.common.detailsTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("master.carrier.detailsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-code" className="text-sm">
                {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="carrier-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t("master.carrier.codePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-name" className="text-sm">
                {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="carrier-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("master.carrier.namePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-type" className="text-sm">
                {t("doc.columns.carrierType")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <select
                id="carrier-type"
                className="doc-form__select h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.carrierType}
                onChange={(e) => setForm((f) => ({ ...f, carrierType: e.target.value }))}
              >
                {CARRIER_TYPE_IDS.map((tid) => (
                  <option key={tid} value={tid}>
                    {t(`master.carrier.types.${tid}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="carrier-contact" className="text-sm">
                {t("doc.columns.contactPerson")}
              </Label>
              <Input
                id="carrier-contact"
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="carrier-phone" className="text-sm">
                {t("doc.columns.phone")}
              </Label>
              <Input
                id="carrier-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-email" className="text-sm">
                {t("doc.columns.email")}
              </Label>
              <Input
                id="carrier-email"
                type="text"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-website" className="text-sm">
                {t("doc.columns.website")}
              </Label>
              <Input
                id="carrier-website"
                type="text"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="carrier-paymentTerms" className="text-sm">
                {t("doc.page.paymentTermsDaysLabel")}
              </Label>
              <Input
                id="carrier-paymentTerms"
                type="number"
                min={0}
                step={1}
                value={form.paymentTermsDays}
                onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                placeholder={t("master.common.paymentTermsExample")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="carrier-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
              />
              <Label htmlFor="carrier-active" className="cursor-pointer text-sm font-normal">
                {t("ops.master.activeCell.active")}
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="text-sm font-medium">{t("master.carrier.addressSectionTitle")}</span>
              <span className="text-xs text-muted-foreground">{t("master.carrier.addressSectionDescription")}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="carrier-country" className="text-sm">
                {t("master.supplier.country")}
              </Label>
              <Input
                id="carrier-country"
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="carrier-city" className="text-sm">
                {t("doc.columns.city")}
              </Label>
              <Input
                id="carrier-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-address" className="text-sm">
                {t("master.supplier.address")}
              </Label>
              <Input
                id="carrier-address"
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-comment" className="text-sm">
                {t("doc.columns.comment")}
              </Label>
              <Textarea
                id="carrier-comment"
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder={t("common.optional")}
                rows={2}
                className="resize-none min-h-[4.5rem] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">{t("master.carrier.logisticsSectionTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("master.carrier.logisticsSectionDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-tracking-url" className="text-sm">
                {t("doc.columns.trackingUrlTemplate")}
              </Label>
              <Input
                id="carrier-tracking-url"
                type="text"
                value={form.trackingUrlTemplate}
                onChange={(e) => setForm((f) => ({ ...f, trackingUrlTemplate: e.target.value }))}
                placeholder={t("master.carrier.trackingUrlPlaceholder")}
                className="h-8 text-sm font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="carrier-service-level" className="text-sm">
                {t("doc.columns.serviceLevelDefault")}
              </Label>
              <Input
                id="carrier-service-level"
                type="text"
                value={form.serviceLevelDefault}
                onChange={(e) => setForm((f) => ({ ...f, serviceLevelDefault: e.target.value }))}
                placeholder={t("master.carrier.serviceLevelPlaceholder")}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
