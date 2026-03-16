import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { itemRepository } from "../repository";
import { saveItem } from "../service";
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
  uom: string;
  isActive: boolean;
  description: string;
  brand: string;
  category: string;
  barcode: string;
  purchasePrice: string;
  salePrice: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    uom: "",
    isActive: true,
    description: "",
    brand: "",
    category: "",
    barcode: "",
    purchasePrice: "",
    salePrice: "",
  };
}

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const item = useMemo(
    () => (id && !isNew ? itemRepository.getById(id) : undefined),
    [id, isNew],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (item) {
      setForm({
        code: item.code,
        name: item.name,
        uom: item.uom,
        isActive: item.isActive,
        description: item.description ?? "",
        brand: item.brand ?? "",
        category: item.category ?? "",
        barcode: item.barcode ?? "",
        purchasePrice: item.purchasePrice !== undefined ? String(item.purchasePrice) : "",
        salePrice: item.salePrice !== undefined ? String(item.salePrice) : "",
      });
      setSaveError(null);
    }
  }, [id, isNew, item?.id, item?.code, item?.name, item?.uom, item?.isActive, item?.description, item?.brand, item?.category, item?.barcode, item?.purchasePrice, item?.salePrice]);

  const parsePrice = (s: string): number | undefined => {
    const t = s.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setSaveError(null);
    const result = saveItem(
      {
        code: form.code,
        name: form.name,
        uom: form.uom,
        isActive: form.isActive,
        description: form.description || undefined,
        brand: form.brand || undefined,
        category: form.category || undefined,
        barcode: form.barcode || undefined,
        purchasePrice: parsePrice(form.purchasePrice),
        salePrice: parsePrice(form.salePrice),
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/items");
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/items");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Item not found.</p>
      </div>
    );
  }

  if (!isNew && !item) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Item not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/items" },
    { label: "Items", to: "/items" },
    { label: isNew ? "New" : item!.code },
  ];

  const displayTitle = isNew ? "New Item" : `Item ${item!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/items" aria-label="Back to Items" />
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
            Code, name, unit of measure and status for this item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="item-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. ITEM-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Item name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-uom">
                UOM <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-uom"
                type="text"
                value={form.uom}
                onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                placeholder="e.g. EA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-brand">Brand</Label>
              <Input
                id="item-brand"
                type="text"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Input
                id="item-category"
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="item-barcode">Barcode</Label>
              <Input
                id="item-barcode"
                type="text"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-purchasePrice">Purchase price</Label>
              <Input
                id="item-purchasePrice"
                type="number"
                min={0}
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-salePrice">Sale price</Label>
              <Input
                id="item-salePrice"
                type="number"
                min={0}
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="item-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              <Label
                htmlFor="item-active"
                className="cursor-pointer font-normal"
              >
                Active
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
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
