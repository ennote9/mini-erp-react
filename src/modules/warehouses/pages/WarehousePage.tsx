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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const warehouse = useMemo(
    () => (id && !isNew ? warehouseRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
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
      setSaveError(null);
    }
  }, [id, isNew, warehouse]);

  const handleSave = () => {
    setSaveError(null);
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
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/warehouses");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Warehouse not found.</p>
      </div>
    );
  }

  if (!isNew && !warehouse) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Warehouse not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/warehouses" },
    { label: "Warehouses", to: "/warehouses" },
    { label: isNew ? "New" : warehouse!.code },
  ];

  const displayTitle = isNew ? "New Warehouse" : `Warehouse ${warehouse!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/warehouses" aria-label="Back to Warehouses" />
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
            Code, name and status for this warehouse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="warehouse-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WH-001"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="warehouse-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Warehouse name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse-type">Type</Label>
              <Input
                id="warehouse-type"
                type="text"
                value={form.warehouseType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, warehouseType: e.target.value }))
                }
                placeholder="e.g. Main, Distribution"
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
                className="cursor-pointer font-normal"
              >
                Active
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-comment">Comment</Label>
              <Textarea
                id="warehouse-comment"
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
      <Card className="mt-6 max-w-2xl border-0 shadow-none">
        <CardHeader>
          <CardTitle>Address &amp; contact</CardTitle>
          <CardDescription>
            Address, city, country and contact details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-address">Address</Label>
              <Input
                id="warehouse-address"
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse-city">City</Label>
              <Input
                id="warehouse-city"
                type="text"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse-country">Country</Label>
              <Input
                id="warehouse-country"
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                placeholder="Country"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-contact-person">Contact person</Label>
              <Input
                id="warehouse-contact-person"
                type="text"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
                placeholder="Name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-phone">Phone</Label>
              <Input
                id="warehouse-phone"
                type="text"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="e.g. +1 312 555 0100"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
