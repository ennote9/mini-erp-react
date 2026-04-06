import { useMemo, useState, useEffect, useCallback, type Dispatch, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerAgreement, CustomerAgreementPricingType } from "@/modules/customer-agreements/model";
import {
  customerAgreementRepository,
  flushPendingCustomerAgreementPersist,
} from "@/modules/customer-agreements/repository";
import { customerAgreementService, saveCustomerAgreement } from "@/modules/customer-agreements/service";

type Props = {
  customerId: string;
};

type AgreementFormState = {
  agreementNo: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  currency: string;
  pricingType: CustomerAgreementPricingType;
  discountPercent: string;
  paymentTermsDays: string;
};

function defaultAgreementForm(): AgreementFormState {
  return {
    agreementNo: "",
    name: "",
    startDate: "",
    endDate: "",
    isActive: true,
    currency: "USD",
    pricingType: "discount_percent",
    discountPercent: "",
    paymentTermsDays: "",
  };
}

function parseOptionalInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function toForm(agreement: CustomerAgreement): AgreementFormState {
  return {
    agreementNo: agreement.agreementNo,
    name: agreement.name ?? "",
    startDate: agreement.startDate,
    endDate: agreement.endDate ?? "",
    isActive: agreement.isActive,
    currency: agreement.currency,
    pricingType: agreement.pricingType,
    discountPercent: agreement.discountPercent !== undefined ? String(agreement.discountPercent) : "",
    paymentTermsDays: agreement.paymentTermsDays !== undefined ? String(agreement.paymentTermsDays) : "",
  };
}

type AgreementFormFieldsProps = {
  idPrefix: string;
  form: AgreementFormState;
  setForm: Dispatch<SetStateAction<AgreementFormState>>;
};

function AgreementFormFields({ idPrefix, form, setForm }: AgreementFormFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("master.customer.agreements.blockGeneral")}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-no`} className="text-sm">
              {t("master.customer.agreements.number")}
            </Label>
            <Input
              id={`${idPrefix}-no`}
              value={form.agreementNo}
              onChange={(e) => setForm((prev) => ({ ...prev, agreementNo: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-name`} className="text-sm">
              {t("doc.columns.name")}
            </Label>
            <Input
              id={`${idPrefix}-name`}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-start`} className="text-sm">
              {t("master.customer.agreements.startDate")}
            </Label>
            <Input
              id={`${idPrefix}-start`}
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-end`} className="text-sm">
              {t("master.customer.agreements.endDate")}
            </Label>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-currency`} className="text-sm">
              {t("master.customer.agreements.currency")}
            </Label>
            <Input
              id={`${idPrefix}-currency`}
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              className="h-8 text-sm uppercase"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox
              id={`${idPrefix}-active`}
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
            />
            <Label htmlFor={`${idPrefix}-active`} className="text-sm font-normal">
              {t("master.customer.agreements.active")}
            </Label>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("master.customer.agreements.blockPricing")}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-pricing-type`} className="text-sm">
              {t("master.customer.agreements.pricingType")}
            </Label>
            <select
              id={`${idPrefix}-pricing-type`}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
              value={form.pricingType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  pricingType: e.target.value as CustomerAgreementPricingType,
                }))
              }
            >
              <option value="discount_percent">
                {t("master.customer.agreements.pricingTypeValues.discount_percent")}
              </option>
              <option value="fixed_price">
                {t("master.customer.agreements.pricingTypeValues.fixed_price")}
              </option>
              <option value="price_list">
                {t("master.customer.agreements.pricingTypeValues.price_list")}
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-discount`} className="text-sm">
              {t("master.customer.agreements.discountPercent")}
            </Label>
            <Input
              id={`${idPrefix}-discount`}
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.discountPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
              className="h-8 text-sm"
              disabled={form.pricingType !== "discount_percent"}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("master.customer.agreements.blockPayment")}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idPrefix}-payment-terms`} className="text-sm">
              {t("master.customer.agreements.paymentTermsDays")}
            </Label>
            <Input
              id={`${idPrefix}-payment-terms`}
              type="number"
              min={0}
              step={1}
              value={form.paymentTermsDays}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentTermsDays: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export function CustomerAgreementsSection({ customerId }: Props) {
  const { t } = useTranslation();
  const revision = useAppReadModelRevision();
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AgreementFormState>(defaultAgreementForm);
  const [editForm, setEditForm] = useState<AgreementFormState>(defaultAgreementForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const agreements = useMemo(
    () => customerAgreementRepository.listByCustomer(customerId),
    [customerId, revision],
  );

  const activeAgreement = useMemo(
    () => customerAgreementService.resolveActiveCustomerAgreement(customerId),
    [customerId, revision],
  );

  useEffect(() => {
    if (agreements.length === 0) {
      setSelectedAgreementId(null);
      return;
    }
    if (!selectedAgreementId || !agreements.some((x) => x.id === selectedAgreementId)) {
      setSelectedAgreementId(agreements[0].id);
    }
  }, [agreements, selectedAgreementId]);

  const handleOpenCreate = useCallback(() => {
    setCreateForm(defaultAgreementForm());
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    setCreateError(null);
    const result = saveCustomerAgreement(
      {
        customerId,
        agreementNo: createForm.agreementNo,
        name: createForm.name || undefined,
        startDate: createForm.startDate,
        endDate: createForm.endDate || undefined,
        isActive: createForm.isActive,
        currency: createForm.currency,
        pricingType: createForm.pricingType,
        discountPercent: parseOptionalNumber(createForm.discountPercent),
        paymentTermsDays: parseOptionalInt(createForm.paymentTermsDays),
      },
      undefined,
    );
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    try {
      await flushPendingCustomerAgreementPersist();
    } catch (persistError) {
      setCreateError(
        persistError instanceof Error ? persistError.message : "Agreement persistence failed.",
      );
      return;
    }
    setCreateOpen(false);
    setSelectedAgreementId(result.id);
  }, [createForm, customerId]);

  const handleOpenEdit = useCallback((agreement: CustomerAgreement) => {
    setSelectedAgreementId(agreement.id);
    setEditForm(toForm(agreement));
    setEditError(null);
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!selectedAgreementId) return;
    setEditError(null);
    const result = saveCustomerAgreement(
      {
        customerId,
        agreementNo: editForm.agreementNo,
        name: editForm.name || undefined,
        startDate: editForm.startDate,
        endDate: editForm.endDate || undefined,
        isActive: editForm.isActive,
        currency: editForm.currency,
        pricingType: editForm.pricingType,
        discountPercent: parseOptionalNumber(editForm.discountPercent),
        paymentTermsDays: parseOptionalInt(editForm.paymentTermsDays),
      },
      selectedAgreementId,
    );
    if (!result.success) {
      setEditError(result.error);
      return;
    }
    try {
      await flushPendingCustomerAgreementPersist();
    } catch (persistError) {
      setEditError(
        persistError instanceof Error ? persistError.message : "Agreement persistence failed.",
      );
      return;
    }
    setEditOpen(false);
    setSelectedAgreementId(result.id);
  }, [customerId, editForm, selectedAgreementId]);

  const handleEditDelete = useCallback(() => {
    if (!selectedAgreementId) return;
    if (!window.confirm(t("master.customer.agreements.deleteConfirm"))) return;
    customerAgreementRepository.delete(selectedAgreementId);
    setEditOpen(false);
  }, [selectedAgreementId, t]);

  return (
    <Card className="w-full border-0 bg-transparent shadow-none">
      <CardContent className="space-y-3 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t("master.customer.agreements.sectionTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("master.customer.agreements.sectionHint")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleOpenCreate}>
            {t("master.customer.agreements.new")}
          </Button>
        </div>

        <div className="rounded-md border border-border/80 bg-card/30">
          {agreements.length === 0 ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center gap-1 px-3 py-8 text-center">
              <p className="text-sm font-medium text-foreground">{t("master.customer.agreements.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("master.customer.agreements.empty")}</p>
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              {agreements.map((agreement) => {
                const selected = agreement.id === selectedAgreementId;
                return (
                  <button
                    key={agreement.id}
                    type="button"
                    data-testid="customer-agreement-list-row"
                    data-agreement-id={agreement.id}
                    className={
                      selected
                        ? "flex w-full flex-col gap-1.5 border-b border-border/70 bg-accent/50 px-4 py-3 text-left shadow-[inset_2px_0_0_0_hsl(var(--primary))] transition-colors last:border-b-0"
                        : "flex w-full flex-col gap-1.5 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-accent/25 last:border-b-0"
                    }
                    onClick={() => handleOpenEdit(agreement)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{agreement.agreementNo}</span>
                      {agreement.id === activeAgreement?.id ? (
                        <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                          {t("master.customer.agreements.active")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {agreement.startDate} {"\u2192"} {agreement.endDate || t("master.common.selectEmpty")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("master.customer.agreements.discountShort")}{" "}
                      {agreement.discountPercent !== undefined
                        ? `${agreement.discountPercent}%`
                        : t("master.common.selectEmpty")}
                      {" \u2022 "}
                      {t("master.customer.agreements.paymentShort")}{" "}
                      {agreement.paymentTermsDays !== undefined
                        ? `${agreement.paymentTermsDays} ${t("master.customer.agreements.daysShort")}`
                        : t("master.common.selectEmpty")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-5 shadow-lg focus:outline-none">
              <Dialog.Title className="text-base font-semibold text-foreground">
                {t("master.customer.agreements.new")}
              </Dialog.Title>
              <div className="mt-3">
                <AgreementFormFields idPrefix="customer-agreement-create" form={createForm} setForm={setCreateForm} />
              </div>
              {createError ? <p className="mt-3 text-sm text-destructive">{createError}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" onClick={handleCreate}>
                  {t("master.customer.agreements.create")}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-5 shadow-lg focus:outline-none">
              <Dialog.Title className="text-base font-semibold text-foreground">
                {t("master.customer.agreements.edit")}
              </Dialog.Title>
              <div className="mt-3">
                <AgreementFormFields idPrefix="customer-agreement-edit" form={editForm} setForm={setEditForm} />
              </div>
              {editError ? <p className="mt-3 text-sm text-destructive">{editError}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" variant="outline" onClick={handleEditDelete}>
                  {t("master.customer.agreements.delete")}
                </Button>
                <Button type="button" onClick={handleEditSave}>
                  {t("common.save")}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </CardContent>
    </Card>
  );
}
