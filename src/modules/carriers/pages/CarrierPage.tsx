import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { carrierRepository } from "../repository";
import { saveCarrier } from "../service";
import { CARRIER_TYPE_IDS } from "../model";
import { salesOrderRepository } from "../../sales-orders/repository";
import { shipmentRepository } from "../../shipments/repository";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
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

  const relatedSalesOrderRows = useMemo(() => {
    if (!carrier?.id) return [];
    const cid = carrier.id;
    const sos = salesOrderRepository
      .list()
      .filter((so) => (so.carrierId?.trim() ?? "") === cid)
      .slice()
      .sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.number.localeCompare(a.number, undefined, { numeric: true });
      });
    return sos.map((so) => {
      const lines = salesOrderRepository.listLines(so.id);
      const lineCount = lines.length;
      const totalAmount = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const wh = warehouseRepository.getById(so.warehouseId);
      const cust = customerRepository.getById(so.customerId);
      return {
        ...so,
        warehouseName: wh?.name ?? so.warehouseId,
        customerName: cust?.name ?? so.customerId,
        lineCount,
        totalAmount,
      };
    });
  }, [carrier?.id]);

  const relatedSoSummary = useMemo(() => {
    const rows = relatedSalesOrderRows;
    return {
      total: rows.length,
      draft: rows.filter((x) => x.status === "draft").length,
      confirmed: rows.filter((x) => x.status === "confirmed").length,
      closed: rows.filter((x) => x.status === "closed").length,
      cancelled: rows.filter((x) => x.status === "cancelled").length,
    };
  }, [relatedSalesOrderRows]);

  const relatedShipmentRows = useMemo(() => {
    if (!carrier?.id) return [];
    const cid = carrier.id;
    const rows = shipmentRepository
      .list()
      .filter((s) => (s.carrierId?.trim() ?? "") === cid)
      .slice()
      .sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.number.localeCompare(a.number, undefined, { numeric: true });
      });
    return rows.map((s) => {
      const so = salesOrderRepository.getById(s.salesOrderId);
      const wh = warehouseRepository.getById(s.warehouseId);
      const tr = s.trackingNumber?.trim();
      return {
        ...s,
        salesOrderNumber: so?.number ?? s.salesOrderId,
        warehouseName: wh?.name ?? s.warehouseId,
        trackingDisplay: tr && tr.length > 0 ? tr : null,
      };
    });
  }, [carrier?.id]);

  const relatedShipmentSummary = useMemo(() => {
    const rows = relatedShipmentRows;
    return {
      total: rows.length,
      draft: rows.filter((x) => x.status === "draft").length,
      posted: rows.filter((x) => x.status === "posted").length,
      cancelled: rows.filter((x) => x.status === "cancelled").length,
      reversed: rows.filter((x) => x.status === "reversed").length,
    };
  }, [relatedShipmentRows]);

  const relatedCustomerRows = useMemo(() => {
    if (!carrier?.id) return [];
    const cid = carrier.id;
    return customerRepository
      .list()
      .filter((c) => (c.preferredCarrierId?.trim() ?? "") === cid)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [carrier?.id]);

  const relatedCustomerSummary = useMemo(() => {
    const rows = relatedCustomerRows;
    return {
      total: rows.length,
      active: rows.filter((x) => x.isActive).length,
      inactive: rows.filter((x) => !x.isActive).length,
    };
  }, [relatedCustomerRows]);

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

      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{t("master.carrier.hubHint")}</p>

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

      {!isNew && carrier ? (
        <>
          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                    {t("master.carrier.relatedCustomersTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    {t("master.carrier.relatedCustomersHint")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/customers?preferredCarrierId=${encodeURIComponent(carrier.id)}`)
                  }
                >
                  {t("master.carrier.openAllCustomers")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label={t("master.carrier.relatedCustomersSummaryAria")}
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("master.carrier.customersChip")}</span>
                  <span className="font-medium text-foreground/90">{relatedCustomerSummary.total}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("ops.master.activeCell.active")}</span>
                  <span className="font-medium text-foreground/90">{relatedCustomerSummary.active}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("ops.master.activeCell.inactive")}</span>
                  <span className="font-medium text-foreground/90">{relatedCustomerSummary.inactive}</span>
                </span>
              </div>
              {relatedCustomerRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 m-0">
                  {t("master.carrier.emptyRelatedCustomers")}
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                  <table className="list-table text-sm">
                    <thead>
                      <tr>
                        <th className="list-table__cell--code">{t("doc.columns.code")}</th>
                        <th className="min-w-[140px]">{t("doc.columns.name")}</th>
                        <th className="min-w-[100px]">{t("doc.columns.city")}</th>
                        <th className="min-w-[90px]">{t("doc.columns.active")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedCustomerRows.map((c) => {
                        const cityTrim = c.city?.trim() ?? "";
                        return (
                          <tr
                            key={c.id}
                            className="list-table__row list-table__row--clickable"
                            onClick={() => navigate(`/customers/${c.id}`)}
                            role="button"
                            tabIndex={0}
                            aria-label={t("master.carrier.openCustomerAria", { code: c.code })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/customers/${c.id}`);
                              }
                            }}
                          >
                            <td className="list-table__cell--code font-medium">{c.code}</td>
                            <td className="truncate max-w-[16rem]" title={c.name}>
                              {c.name}
                            </td>
                            <td className="truncate max-w-[12rem]" title={cityTrim || undefined}>
                              {cityTrim !== "" ? c.city : t("domain.audit.summary.emDash")}
                            </td>
                            <td>
                              <span
                                className={
                                  c.isActive
                                    ? "status-plain-text status-plain-text--active"
                                    : "status-plain-text status-plain-text--inactive"
                                }
                              >
                                {c.isActive
                                  ? t("ops.master.activeCell.active")
                                  : t("ops.master.activeCell.inactive")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                    {t("master.carrier.relatedSalesOrdersTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    {t("master.carrier.relatedSalesOrdersHint")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/sales-orders?carrierId=${encodeURIComponent(carrier.id)}`)
                  }
                >
                  {t("master.carrier.openAllSalesOrders")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label={t("master.carrier.relatedSoSummaryAria")}
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("master.carrier.ordersChip")}</span>
                  <span className="font-medium text-foreground/90">{relatedSoSummary.total}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.labels.draft")}</span>
                  <span className="font-medium text-foreground/90">{relatedSoSummary.draft}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.labels.confirmed")}</span>
                  <span className="font-medium text-foreground/90">{relatedSoSummary.confirmed}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.labels.closed")}</span>
                  <span className="font-medium text-foreground/90">{relatedSoSummary.closed}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.labels.cancelled")}</span>
                  <span className="font-medium text-foreground/90">{relatedSoSummary.cancelled}</span>
                </span>
              </div>
              {relatedSalesOrderRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 m-0">
                  {t("master.carrier.emptyRelatedSo")}
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                  <table className="list-table text-sm">
                    <thead>
                      <tr>
                        <th className="list-table__cell--code">{t("doc.columns.number")}</th>
                        <th className="min-w-[100px]">{t("doc.columns.status")}</th>
                        <th className="min-w-[120px]">{t("doc.columns.customer")}</th>
                        <th className="min-w-[120px]">{t("doc.columns.warehouse")}</th>
                        <th className="w-14 text-right whitespace-nowrap tabular-nums">{t("doc.page.lines")}</th>
                        <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedSalesOrderRows.map((so) => (
                        <tr
                          key={so.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/sales-orders/${so.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={t("master.carrier.openSalesOrderAria", { number: so.number })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/sales-orders/${so.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-medium">{so.number}</td>
                          <td>
                            <StatusBadge status={so.status} />
                          </td>
                          <td className="truncate max-w-[14rem]" title={so.customerName}>
                            {so.customerName}
                          </td>
                          <td className="truncate max-w-[14rem]" title={so.warehouseName}>
                            {so.warehouseName}
                          </td>
                          <td className="text-right tabular-nums">{so.lineCount}</td>
                          <td className="text-right tabular-nums">{so.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                    {t("master.carrier.relatedShipmentsTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    {t("master.carrier.relatedShipmentsHint")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/shipments?carrierId=${encodeURIComponent(carrier.id)}`)
                  }
                >
                  {t("master.carrier.openAllShipments")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label={t("master.carrier.relatedShipmentsSummaryAria")}
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("master.carrier.shipmentsChip")}</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.total}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.factual.draft")}</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.draft}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.factual.posted")}</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.posted}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.factual.cancelled")}</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.cancelled}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">{t("status.factual.reversed")}</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.reversed}</span>
                </span>
              </div>
              {relatedShipmentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 m-0">
                  {t("master.carrier.emptyRelatedShipments")}
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                  <table className="list-table text-sm">
                    <thead>
                      <tr>
                        <th className="list-table__cell--code">{t("doc.columns.number")}</th>
                        <th className="min-w-[100px]">{t("doc.columns.status")}</th>
                        <th className="min-w-[140px]">{t("master.warehouse.colSalesOrder")}</th>
                        <th className="min-w-[120px]">{t("doc.columns.warehouse")}</th>
                        <th className="min-w-[100px] whitespace-nowrap">{t("doc.columns.date")}</th>
                        <th className="min-w-[120px]">{t("doc.shipment.trackingNumber")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedShipmentRows.map((s) => (
                        <tr
                          key={s.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/shipments/${s.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={t("master.carrier.openShipmentAria", { number: s.number })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/shipments/${s.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-medium">{s.number}</td>
                          <td>
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="truncate max-w-[12rem]" title={s.salesOrderNumber}>
                            {s.salesOrderNumber}
                          </td>
                          <td className="truncate max-w-[14rem]" title={s.warehouseName}>
                            {s.warehouseName}
                          </td>
                          <td className="tabular-nums text-foreground/90 whitespace-nowrap">{s.date}</td>
                          <td className="truncate max-w-[12rem] font-mono text-xs" title={s.trackingDisplay ?? undefined}>
                            {s.trackingDisplay ?? t("domain.audit.summary.emDash")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
