import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { supplierRepository } from "../repository";
import { saveSupplier } from "../service";
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
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    phone: "",
    email: "",
    comment: "",
  };
}

export function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const supplier = useMemo(
    () => (id && !isNew ? supplierRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
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
      });
      setSaveError(null);
    }
  }, [id, isNew, supplier?.id, supplier?.code, supplier?.name, supplier?.isActive, supplier?.phone, supplier?.email, supplier?.comment]);

  const handleSave = () => {
    setSaveError(null);
    const result = saveSupplier(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        phone: form.phone || undefined,
        email: form.email || undefined,
        comment: form.comment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/suppliers");
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/suppliers");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Supplier not found.</p>
      </div>
    );
  }

  if (!isNew && !supplier) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Supplier not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/suppliers" },
    { label: "Suppliers", to: "/suppliers" },
    { label: isNew ? "New" : supplier!.code },
  ];

  const displayTitle = isNew ? "New Supplier" : `Supplier ${supplier!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/suppliers" aria-label="Back to Suppliers" />
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
            Code, name, contact and status for this supplier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SUP-0001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Supplier name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Optional"
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
                className="cursor-pointer font-normal"
              >
                Active
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="text"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-comment">Comment</Label>
              <Textarea
                id="supplier-comment"
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
