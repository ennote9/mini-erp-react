import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { supplierRepository } from "../repository";
import { saveSupplier } from "../service";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
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
import { getSupplierFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import {
  getAppReadModelRevision,
  subscribeAppReadModelRevision,
} from "@/shared/appReadModelRevision";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  phone: string;
  email: string;
  comment: string;
  contactPerson: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  paymentTermsDays: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    phone: "",
    email: "",
    comment: "",
    contactPerson: "",
    taxId: "",
    address: "",
    city: "",
    country: "",
    paymentTermsDays: "",
  };
}

export function SupplierPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const supplier = useMemo(
    () => (id && !isNew ? supplierRepository.getById(id) : undefined),
    [id, isNew],
  );

  const appReadModelRevision = useSyncExternalStore(
    subscribeAppReadModelRevision,
    getAppReadModelRevision,
    getAppReadModelRevision,
  );

  const relatedPurchaseOrderRows = useMemo(() => {
    if (!supplier?.id) return [];
    const pos = purchaseOrderRepository
      .list()
      .filter((po) => po.supplierId === supplier.id)
      .slice()
      .sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.number.localeCompare(a.number, undefined, { numeric: true });
      });
    return pos.map((po) => {
      const lines = purchaseOrderRepository.listLines(po.id);
      const lineCount = lines.length;
      const totalAmount = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const wh = warehouseRepository.getById(po.warehouseId);
      return {
        ...po,
        warehouseName: wh?.name ?? po.warehouseId,
        lineCount,
        totalAmount,
      };
    });
  }, [supplier?.id, appReadModelRevision]);

  const relatedPoSummary = useMemo(() => {
    const rows = relatedPurchaseOrderRows;
    return {
      total: rows.length,
      draft: rows.filter((x) => x.status === "draft").length,
      confirmed: rows.filter((x) => x.status === "confirmed").length,
      closed: rows.filter((x) => x.status === "closed").length,
      cancelled: rows.filter((x) => x.status === "cancelled").length,
    };
  }, [relatedPurchaseOrderRows]);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getSupplierFormHealth({
        code: form.code,
        name: form.name,
        phone: form.phone,
        email: form.email,
        paymentTermsDays: form.paymentTermsDays,
      }),
    [form.code, form.name, form.phone, form.email, form.paymentTermsDays],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name, form.phone, form.email, form.paymentTermsDays]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (supplier) {
      setForm({
        code: supplier.code,
        name: supplier.name,
        isActive: supplier.isActive,
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        comment: supplier.comment ?? "",
        contactPerson: supplier.contactPerson ?? "",
        taxId: supplier.taxId ?? "",
        address: supplier.address ?? "",
        city: supplier.city ?? "",
        country: supplier.country ?? "",
        paymentTermsDays: supplier.paymentTermsDays !== undefined ? String(supplier.paymentTermsDays) : "",
      });
    }
  }, [id, isNew, supplier?.id, supplier?.code, supplier?.name, supplier?.isActive, supplier?.phone, supplier?.email, supplier?.comment, supplier?.contactPerson, supplier?.taxId, supplier?.address, supplier?.city, supplier?.country, supplier?.paymentTermsDays]);

  const parsePaymentTerms = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setActionIssues([]);
    const result = saveSupplier(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        phone: form.phone || undefined,
        email: form.email || undefined,
        comment: form.comment || undefined,
        contactPerson: form.contactPerson || undefined,
        taxId: form.taxId || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        paymentTermsDays: parsePaymentTerms(form.paymentTermsDays),
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/suppliers");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/suppliers");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.supplier.notFound")}</p>
      </div>
    );
  }

  if (!isNew && !supplier) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.supplier.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/suppliers" },
    { label: t("master.supplier.listBreadcrumb"), to: "/suppliers" },
    { label: isNew ? t("master.common.newLabel") : supplier!.code },
  ];

  const displayTitle = isNew ? t("master.supplier.titleNew") : t("master.supplier.titleWithCode", { code: supplier!.code });

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/suppliers" aria-label={t("master.supplier.backToListAria")} />
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
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">{t("master.common.detailsTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("master.supplier.detailsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="supplier-code" className="text-sm">
                {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="supplier-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t("master.supplier.codePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-name" className="text-sm">
                {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="supplier-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("master.supplier.namePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-contactPerson" className="text-sm">{t("doc.columns.contactPerson")}</Label>
              <Input
                id="supplier-contactPerson"
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-taxId" className="text-sm">{t("master.supplier.taxId")}</Label>
              <Input
                id="supplier-taxId"
                type="text"
                value={form.taxId}
                onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="supplier-address" className="text-sm">{t("master.supplier.address")}</Label>
              <Input
                id="supplier-address"
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-city" className="text-sm">{t("doc.columns.city")}</Label>
              <Input
                id="supplier-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-country" className="text-sm">{t("master.supplier.country")}</Label>
              <Input
                id="supplier-country"
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-paymentTermsDays" className="text-sm">{t("doc.page.paymentTermsDaysLabel")}</Label>
              <Input
                id="supplier-paymentTermsDays"
                type="number"
                min={0}
                step={1}
                value={form.paymentTermsDays}
                onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                placeholder={t("master.common.paymentTermsExample")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="supplier-phone" className="text-sm">{t("doc.columns.phone")}</Label>
              <Input
                id="supplier-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="supplier-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              <Label
                htmlFor="supplier-active"
                className="cursor-pointer text-sm font-normal"
              >
                {t("ops.master.activeCell.active")}
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="supplier-email" className="text-sm">{t("doc.columns.email")}</Label>
              <Input
                id="supplier-email"
                type="text"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t("common.optional")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="supplier-comment" className="text-sm">{t("doc.columns.comment")}</Label>
              <Textarea
                id="supplier-comment"
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
                placeholder={t("common.optional")}
                rows={2}
                className="resize-none min-h-[4.5rem] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && supplier ? (
        <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
          <CardHeader className="p-2 pb-0.5 space-y-0">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
              <div className="min-w-0 space-y-0.5 flex-1">
                <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                  {t("master.supplier.relatedPurchaseOrdersTitle")}
                </CardTitle>
                <CardDescription className="text-xs leading-snug">
                  {t("master.supplier.relatedPurchaseOrdersHint")}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={() =>
                  navigate(`/purchase-orders?supplierId=${encodeURIComponent(supplier.id)}`)
                }
              >
                {t("master.supplier.openAllPurchaseOrders")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-1 space-y-2">
            <div
              className="flex flex-wrap gap-1.5"
              aria-label={t("master.supplier.relatedPoSummaryAria")}
            >
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("master.supplier.ordersChip")}</span>
                <span className="font-medium text-foreground/90">{relatedPoSummary.total}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("status.labels.draft")}</span>
                <span className="font-medium text-foreground/90">{relatedPoSummary.draft}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("status.labels.confirmed")}</span>
                <span className="font-medium text-foreground/90">{relatedPoSummary.confirmed}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("status.labels.closed")}</span>
                <span className="font-medium text-foreground/90">{relatedPoSummary.closed}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">{t("status.labels.cancelled")}</span>
                <span className="font-medium text-foreground/90">{relatedPoSummary.cancelled}</span>
              </span>
            </div>
            {relatedPurchaseOrderRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 m-0">
                {t("master.supplier.emptyRelatedPo")}
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                <table className="list-table text-sm">
                  <thead>
                    <tr>
                      <th className="list-table__cell--code">{t("doc.columns.number")}</th>
                      <th className="min-w-[100px]">{t("doc.columns.status")}</th>
                      <th className="min-w-[120px]">{t("doc.columns.warehouse")}</th>
                      <th className="w-14 text-right whitespace-nowrap tabular-nums">{t("doc.page.lines")}</th>
                      <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedPurchaseOrderRows.map((po) => (
                      <tr
                        key={po.id}
                        className="list-table__row list-table__row--clickable"
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={t("master.supplier.openPurchaseOrderAria", { number: po.number })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/purchase-orders/${po.id}`);
                          }
                        }}
                      >
                        <td className="list-table__cell--code font-medium">{po.number}</td>
                        <td>
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="truncate max-w-[14rem]" title={po.warehouseName}>
                          {po.warehouseName}
                        </td>
                        <td className="text-right tabular-nums">{po.lineCount}</td>
                        <td className="text-right tabular-nums">{po.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
