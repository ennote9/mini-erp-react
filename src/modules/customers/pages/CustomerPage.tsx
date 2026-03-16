import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { customerRepository } from "../repository";
import { saveCustomer } from "../service";
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
  };
}

export function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const customer = useMemo(
    () => (id && !isNew ? customerRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
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
      });
      setSaveError(null);
    }
  }, [id, isNew, customer?.id, customer?.code, customer?.name, customer?.isActive, customer?.phone, customer?.email, customer?.comment, customer?.contactPerson, customer?.taxId, customer?.billingAddress, customer?.shippingAddress, customer?.city, customer?.country, customer?.paymentTermsDays]);

  const parsePaymentTerms = (s: string): number | undefined => {
    const t = s.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setSaveError(null);
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
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/customers");
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/customers");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Customer not found.</p>
      </div>
    );
  }

  if (!isNew && !customer) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Customer not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/customers" },
    { label: "Customers", to: "/customers" },
    { label: isNew ? "New" : customer!.code },
  ];

  const displayTitle = isNew ? "New Customer" : `Customer ${customer!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/customers" aria-label="Back to Customers" />
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
          </div>
          <div className="doc-header__actions">
            <Button type="button" onClick={handleSave}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
      {saveError && (
        <div
          className="rounded-md border border-red-600/80 bg-destructive/25 px-4 py-1.5 text-sm text-red-600"
          role="alert"
        >
          {saveError}
        </div>
      )}
      <Card className="mt-6 max-w-2xl border-0 shadow-none">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Code, name, contact and status for this customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. CUS-0001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-contactPerson">Contact person</Label>
              <Input
                id="customer-contactPerson"
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-taxId">Tax ID</Label>
              <Input
                id="customer-taxId"
                type="text"
                value={form.taxId}
                onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-billingAddress">Billing address</Label>
              <Input
                id="customer-billingAddress"
                type="text"
                value={form.billingAddress}
                onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-shippingAddress">Shipping address</Label>
              <Input
                id="customer-shippingAddress"
                type="text"
                value={form.shippingAddress}
                onChange={(e) => setForm((f) => ({ ...f, shippingAddress: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-city">City</Label>
              <Input
                id="customer-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-country">Country</Label>
              <Input
                id="customer-country"
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-paymentTermsDays">Payment terms (days)</Label>
              <Input
                id="customer-paymentTermsDays"
                type="number"
                min={0}
                step={1}
                value={form.paymentTermsDays}
                onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                placeholder="e.g. 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Optional"
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
                className="cursor-pointer font-normal"
              >
                Active
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="text"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-comment">Comment</Label>
              <Textarea
                id="customer-comment"
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
                placeholder="Optional"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
