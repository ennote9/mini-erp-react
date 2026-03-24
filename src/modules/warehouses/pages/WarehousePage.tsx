import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { warehouseRepository } from "../repository";
import { saveWarehouse } from "../service";
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
import { getWarehouseFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  comment: string;
  warehouseType: string;
  address: string;
  city: string;
  country: string;
  contactPerson: string;
  phone: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    comment: "",
    warehouseType: "",
    address: "",
    city: "",
    country: "",
    contactPerson: "",
    phone: "",
  };
}

export function WarehousePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const warehouse = useMemo(
    () => (id && !isNew ? warehouseRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getWarehouseFormHealth({
        code: form.code,
        name: form.name,
        phone: form.phone,
      }),
    [form.code, form.name, form.phone],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name, form.phone]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (warehouse) {
      setForm({
        code: warehouse.code,
        name: warehouse.name,
        isActive: warehouse.isActive,
        comment: warehouse.comment ?? "",
        warehouseType: warehouse.warehouseType ?? "",
        address: warehouse.address ?? "",
        city: warehouse.city ?? "",
        country: warehouse.country ?? "",
        contactPerson: warehouse.contactPerson ?? "",
        phone: warehouse.phone ?? "",
      });
    }
  }, [id, isNew, warehouse]);

  const handleSave = () => {
    setActionIssues([]);
    const result = saveWarehouse(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        comment: form.comment || undefined,
        warehouseType: form.warehouseType || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/warehouses");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssueFromServiceMessage(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/warehouses");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.warehouse.notFound")}</p>
      </div>
    );
  }

  if (!isNew && !warehouse) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>{t("master.warehouse.notFound")}</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("master.breadcrumb.masterData"), to: "/warehouses" },
    { label: t("master.warehouse.listBreadcrumb"), to: "/warehouses" },
    { label: isNew ? t("master.common.newLabel") : warehouse!.code },
  ];

  const displayTitle = isNew ? t("master.warehouse.titleNew") : t("master.warehouse.titleWithCode", { code: warehouse!.code });

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/warehouses" aria-label={t("master.warehouse.backToListAria")} />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div>
            <div className="doc-header__title-row">
              <h2 className="doc-header__title">{displayTitle}</h2>
            </div>
            {!isNew && warehouse ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/stock-balances?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  {t("master.warehouse.openStockBalances")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/stock-movements?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  {t("master.warehouse.openStockMovements")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/receipts?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  {t("master.warehouse.openAllReceipts")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/shipments?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  {t("master.warehouse.openAllShipments")}
                </Button>
              </div>
            ) : null}
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
            {t("master.warehouse.detailsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-code" className="text-sm">
                {t("doc.columns.code")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="warehouse-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t("master.warehouse.codePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-name" className="text-sm">
                {t("doc.columns.name")} <span className="text-destructive">{t("doc.page.requiredStar")}</span>
              </Label>
              <Input
                id="warehouse-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("master.warehouse.namePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-type" className="text-sm">{t("master.warehouse.typeLabel")}</Label>
              <Input
                id="warehouse-type"
                type="text"
                value={form.warehouseType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, warehouseType: e.target.value }))
                }
                placeholder={t("master.warehouse.warehouseTypePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="warehouse-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              <Label
                htmlFor="warehouse-active"
                className="cursor-pointer text-sm font-normal"
              >
                {t("ops.master.activeCell.active")}
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-comment" className="text-sm">{t("doc.columns.comment")}</Label>
              <Textarea
                id="warehouse-comment"
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
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-sm font-semibold">{t("master.warehouse.addressContactTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("master.warehouse.addressContactDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-address" className="text-sm">{t("master.supplier.address")}</Label>
              <Input
                id="warehouse-address"
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder={t("master.warehouse.streetPlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-city" className="text-sm">{t("doc.columns.city")}</Label>
              <Input
                id="warehouse-city"
                type="text"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder={t("master.warehouse.cityPlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-country" className="text-sm">{t("master.supplier.country")}</Label>
              <Input
                id="warehouse-country"
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                placeholder={t("master.warehouse.countryPlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-contact-person" className="text-sm">{t("doc.columns.contactPerson")}</Label>
              <Input
                id="warehouse-contact-person"
                type="text"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
                placeholder={t("master.warehouse.contactNamePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-phone" className="text-sm">{t("doc.columns.phone")}</Label>
              <Input
                id="warehouse-phone"
                type="text"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder={t("master.warehouse.phoneExamplePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
