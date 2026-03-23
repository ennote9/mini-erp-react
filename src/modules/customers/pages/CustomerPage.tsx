import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { customerRepository } from "../repository";
import { saveCustomer } from "../service";
import { carrierRepository } from "../../carriers/repository";
import { translateCarrierType } from "../../carriers";
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
import { getCustomerFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import { cn } from "@/lib/utils";
import { Tabs } from "radix-ui";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  phone: string;
  email: string;
  comment: string;
  contactPerson: string;
  taxId: string;
  billingAddress: string;
  shippingAddress: string;
  city: string;
  country: string;
  paymentTermsDays: string;
  preferredCarrierId: string;
  defaultRecipientName: string;
  defaultRecipientPhone: string;
  defaultDeliveryAddress: string;
  defaultDeliveryComment: string;
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
    billingAddress: "",
    shippingAddress: "",
    city: "",
    country: "",
    paymentTermsDays: "",
    preferredCarrierId: "",
    defaultRecipientName: "",
    defaultRecipientPhone: "",
    defaultDeliveryAddress: "",
    defaultDeliveryComment: "",
  };
}

export function CustomerPage() {
  const { t, locale } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const customer = useMemo(
    () => (id && !isNew ? customerRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const carrierSelectOptions = useMemo(() => {
    const all = carrierRepository.list();
    const active = all
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const sel = form.preferredCarrierId.trim();
    if (!sel) return active;
    const current = all.find((c) => c.id === sel);
    if (current && !current.isActive && !active.some((c) => c.id === sel)) {
      return [current, ...active];
    }
    return active;
  }, [form.preferredCarrierId, locale]);

  const health = useMemo(
    () =>
      getCustomerFormHealth({
        code: form.code,
        name: form.name,
        phone: form.phone,
        email: form.email,
        paymentTermsDays: form.paymentTermsDays,
        defaultRecipientPhone: form.defaultRecipientPhone,
      }),
    [
      form.code,
      form.name,
      form.phone,
      form.email,
      form.paymentTermsDays,
      form.defaultRecipientPhone,
    ],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [
    form.code,
    form.name,
    form.phone,
    form.email,
    form.paymentTermsDays,
    form.defaultRecipientPhone,
  ]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (customer) {
      setForm({
        code: customer.code,
        name: customer.name,
        isActive: customer.isActive,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        comment: customer.comment ?? "",
        contactPerson: customer.contactPerson ?? "",
        taxId: customer.taxId ?? "",
        billingAddress: customer.billingAddress ?? "",
        shippingAddress: customer.shippingAddress ?? "",
        city: customer.city ?? "",
        country: customer.country ?? "",
        paymentTermsDays: customer.paymentTermsDays !== undefined ? String(customer.paymentTermsDays) : "",
        preferredCarrierId: customer.preferredCarrierId ?? "",
        defaultRecipientName: customer.defaultRecipientName ?? "",
        defaultRecipientPhone: customer.defaultRecipientPhone ?? "",
        defaultDeliveryAddress: customer.defaultDeliveryAddress ?? "",
        defaultDeliveryComment: customer.defaultDeliveryComment ?? "",
      });
    }
  }, [
    id,
    isNew,
    customer?.id,
    customer?.code,
    customer?.name,
    customer?.isActive,
    customer?.phone,
    customer?.email,
    customer?.comment,
    customer?.contactPerson,
    customer?.taxId,
    customer?.billingAddress,
    customer?.shippingAddress,
    customer?.city,
    customer?.country,
    customer?.paymentTermsDays,
    customer?.preferredCarrierId,
    customer?.defaultRecipientName,
    customer?.defaultRecipientPhone,
    customer?.defaultDeliveryAddress,
    customer?.defaultDeliveryComment,
  ]);

  const parsePaymentTerms = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setActionIssues([]);
    const result = saveCustomer(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        phone: form.phone || undefined,
        email: form.email || undefined,
        comment: form.comment || undefined,
        contactPerson: form.contactPerson || undefined,
        taxId: form.taxId || undefined,
        billingAddress: form.billingAddress || undefined,
        shippingAddress: form.shippingAddress || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        paymentTermsDays: parsePaymentTerms(form.paymentTermsDays),
        preferredCarrierId: form.preferredCarrierId.trim() || undefined,
        defaultRecipientName: form.defaultRecipientName || undefined,
        defaultRecipientPhone: form.defaultRecipientPhone || undefined,
        defaultDeliveryAddress: form.defaultDeliveryAddress || undefined,
        defaultDeliveryComment: form.defaultDeliveryComment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/customers");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/customers");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.customer.notFound")}</p>
      </div>
    );
  }

  if (!isNew && !customer) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.customer.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/customers" },
    { label: t("master.customer.listBreadcrumb"), to: "/customers" },
    { label: isNew ? t("master.common.newLabel") : customer!.code },
  ];

  const displayTitle = isNew ? t("master.customer.titleNew") : t("master.customer.titleWithCode", { code: customer!.code });

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/customers" aria-label={t("master.customer.backToListAria")} />
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
      {!isNew && customer ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs"
            onClick={() =>
              navigate(`/sales-orders?customerId=${encodeURIComponent(customer.id)}`)
            }
          >
            {t("master.customer.openAllSalesOrders")}
          </Button>
        </div>
      ) : null}
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <Tabs.Root defaultValue="main">
          <CardHeader className="p-2 pb-0.5 space-y-2">
            <Tabs.List
              className="inline-flex h-9 w-full max-w-md flex-wrap items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5 text-[13px] sm:w-auto"
              aria-label={t("master.customer.tabsAria")}
            >
              <Tabs.Trigger
                value="main"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.customer.tabMain")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="delivery"
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-initial",
                  "text-muted-foreground hover:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {t("master.customer.tabDefaultDelivery")}
              </Tabs.Trigger>
            </Tabs.List>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <Tabs.Content value="main" className="outline-none focus-visible:outline-none">
              <div className="space-y-2">
                <div>
                  <CardTitle className="text-[0.9rem] font-semibold">{t("master.common.detailsTitle")}</CardTitle>
                  <CardDescription className="text-xs">{t("master.customer.detailsDescription")}</CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-code" className="text-sm">
                      {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="customer-code"
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder={t("master.customer.codePlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-name" className="text-sm">
                      {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
                    </Label>
                    <Input
                      id="customer-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("master.customer.namePlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-contactPerson" className="text-sm">{t("doc.columns.contactPerson")}</Label>
                    <Input
                      id="customer-contactPerson"
                      type="text"
                      value={form.contactPerson}
                      onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-taxId" className="text-sm">{t("master.customer.taxId")}</Label>
                    <Input
                      id="customer-taxId"
                      type="text"
                      value={form.taxId}
                      onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-billingAddress" className="text-sm">{t("master.customer.billingAddress")}</Label>
                    <Input
                      id="customer-billingAddress"
                      type="text"
                      value={form.billingAddress}
                      onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-shippingAddress" className="text-sm">{t("master.customer.shippingAddress")}</Label>
                    <Input
                      id="customer-shippingAddress"
                      type="text"
                      value={form.shippingAddress}
                      onChange={(e) => setForm((f) => ({ ...f, shippingAddress: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-city" className="text-sm">{t("doc.columns.city")}</Label>
                    <Input
                      id="customer-city"
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-country" className="text-sm">{t("master.customer.country")}</Label>
                    <Input
                      id="customer-country"
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-paymentTermsDays" className="text-sm">{t("doc.page.paymentTermsDaysLabel")}</Label>
                    <Input
                      id="customer-paymentTermsDays"
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
                    <Label htmlFor="customer-phone" className="text-sm">{t("doc.columns.phone")}</Label>
                    <Input
                      id="customer-phone"
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-email" className="text-sm">{t("doc.columns.email")}</Label>
                    <Input
                      id="customer-email"
                      type="text"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder={t("common.optional")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-2 sm:col-span-2">
                    <Checkbox
                      id="customer-active"
                      checked={form.isActive}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, isActive: checked === true }))
                      }
                    />
                    <Label
                      htmlFor="customer-active"
                      className="cursor-pointer text-sm font-normal"
                    >
                      {t("ops.master.activeCell.active")}
                    </Label>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-comment" className="text-sm">{t("doc.columns.comment")}</Label>
                    <Textarea
                      id="customer-comment"
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
              </div>
            </Tabs.Content>
            <Tabs.Content value="delivery" className="mt-2 outline-none focus-visible:outline-none sm:mt-0">
              <div className="space-y-2">
                <div>
                  <CardTitle className="text-[0.9rem] font-semibold">{t("master.customer.deliveryDefaultsSection")}</CardTitle>
                  <CardDescription className="text-xs leading-snug">{t("master.customer.deliveryDefaultsHint")}</CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-defaultRecipientName" className="text-sm">
                      {t("master.customer.defaultRecipientName")}
                    </Label>
                    <Input
                      id="customer-defaultRecipientName"
                      type="text"
                      value={form.defaultRecipientName}
                      onChange={(e) => setForm((f) => ({ ...f, defaultRecipientName: e.target.value }))}
                      placeholder={t("master.customer.defaultRecipientNamePlaceholder")}
                      className="h-8 text-sm"
                      autoComplete="name"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="customer-defaultRecipientPhone" className="text-sm">
                      {t("master.customer.defaultRecipientPhone")}
                    </Label>
                    <Input
                      id="customer-defaultRecipientPhone"
                      type="text"
                      value={form.defaultRecipientPhone}
                      onChange={(e) => setForm((f) => ({ ...f, defaultRecipientPhone: e.target.value }))}
                      placeholder={t("master.customer.defaultRecipientPhonePlaceholder")}
                      className="h-8 text-sm"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-defaultDeliveryAddress" className="text-sm">
                      {t("master.customer.defaultDeliveryAddress")}
                    </Label>
                    <Textarea
                      id="customer-defaultDeliveryAddress"
                      value={form.defaultDeliveryAddress}
                      onChange={(e) => setForm((f) => ({ ...f, defaultDeliveryAddress: e.target.value }))}
                      placeholder={t("master.customer.defaultDeliveryAddressPlaceholder")}
                      rows={2}
                      className="resize-y min-h-[2.5rem] text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-defaultDeliveryComment" className="text-sm">
                      {t("master.customer.defaultDeliveryComment")}
                    </Label>
                    <Textarea
                      id="customer-defaultDeliveryComment"
                      value={form.defaultDeliveryComment}
                      onChange={(e) => setForm((f) => ({ ...f, defaultDeliveryComment: e.target.value }))}
                      placeholder={t("master.customer.defaultDeliveryCommentPlaceholder")}
                      rows={2}
                      className="resize-y min-h-[2.5rem] text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <Label htmlFor="customer-preferredCarrier" className="text-sm">
                      {t("master.customer.preferredCarrier")}
                    </Label>
                    <select
                      id="customer-preferredCarrier"
                      className={cn(
                        "flex h-8 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground",
                      )}
                      value={form.preferredCarrierId}
                      onChange={(e) => setForm((f) => ({ ...f, preferredCarrierId: e.target.value }))}
                      aria-label={t("master.customer.preferredCarrier")}
                    >
                      <option value="">{t("master.customer.preferredCarrierPlaceholder")}</option>
                      {carrierSelectOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {translateCarrierType(t, c.carrierType)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground m-0 leading-snug">
                      {t("master.customer.preferredCarrierHint")}
                    </p>
                  </div>
                </div>
              </div>
            </Tabs.Content>
          </CardContent>
        </Tabs.Root>
      </Card>
    </div>
  );
}
