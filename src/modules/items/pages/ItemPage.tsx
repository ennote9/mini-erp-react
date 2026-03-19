import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { itemRepository } from "../repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { saveItem } from "../service";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { actionIssue, combineIssues, getErrorAndWarningMessages, issueListContainsMessage, type Issue } from "../../../shared/issues";
import { getItemFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { ItemImagesCard } from "../components/ItemImagesCard";

type FormState = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description: string;
  brandId: string;
  categoryId: string;
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
    brandId: "",
    categoryId: "",
    barcode: "",
    purchasePrice: "",
    salePrice: "",
  };
}

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [imagesRevision, setImagesRevision] = useState(0);
  const item = useMemo(
    () => (id && !isNew ? itemRepository.getById(id) : undefined),
    [id, isNew, imagesRevision],
  );

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getItemFormHealth({
        code: form.code,
        name: form.name,
        uom: form.uom,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
      }),
    [form.code, form.name, form.uom, form.purchasePrice, form.salePrice],
  );

  const brandOptions = useMemo(() => {
    const active = brandRepository.list().filter((b) => b.isActive);
    const currentId = form.brandId;
    if (!currentId) return active;
    const current = brandRepository.getById(currentId);
    if (current && !current.isActive && !active.some((b) => b.id === currentId)) {
      return [current, ...active];
    }
    return active;
  }, [form.brandId]);

  const categoryOptions = useMemo(() => {
    const active = categoryRepository.list().filter((c) => c.isActive);
    const currentId = form.categoryId;
    if (!currentId) return active;
    const current = categoryRepository.getById(currentId);
    if (current && !current.isActive && !active.some((c) => c.id === currentId)) {
      return [current, ...active];
    }
    return active;
  }, [form.categoryId]);

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name, form.uom, form.purchasePrice, form.salePrice]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );
  const { errors: combinedErrors, warnings: combinedWarnings } = useMemo(
    () => getErrorAndWarningMessages(combinedIssues),
    [combinedIssues],
  );

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      return;
    }
    if (item) {
      setForm({
        code: item.code,
        name: item.name,
        uom: item.uom,
        isActive: item.isActive,
        description: item.description ?? "",
        brandId: item.brandId ?? "",
        categoryId: item.categoryId ?? "",
        barcode: item.barcode ?? "",
        purchasePrice: item.purchasePrice !== undefined ? String(item.purchasePrice) : "",
        salePrice: item.salePrice !== undefined ? String(item.salePrice) : "",
      });
    }
  }, [id, isNew, item?.id, item?.code, item?.name, item?.uom, item?.isActive, item?.description, item?.brandId, item?.categoryId, item?.barcode, item?.purchasePrice, item?.salePrice]);

  const parsePrice = (s: string): number | undefined => {
    const t = s.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    setActionIssues([]);
    const result = saveItem(
      {
        code: form.code,
        name: form.name,
        uom: form.uom,
        isActive: form.isActive,
        description: form.description || undefined,
        brandId: form.brandId || undefined,
        categoryId: form.categoryId || undefined,
        barcode: form.barcode || undefined,
        purchasePrice: parsePrice(form.purchasePrice),
        salePrice: parsePrice(form.salePrice),
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/items");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssue(result.error)]);
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
          <div className="doc-header__right">
            {(combinedErrors.length > 0 || combinedWarnings.length > 0) && (
              <DocumentIssueStrip errors={combinedErrors} warnings={combinedWarnings} />
            )}
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
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,42rem)_minmax(260px,1fr)] xl:items-start">
      <Card className="max-w-2xl w-full border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
          <CardDescription className="text-xs">
            Code, name, unit of measure and status for this item.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="item-code" className="text-sm">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. ITEM-001"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-name" className="text-sm">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Item name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-uom" className="text-sm">
                UOM <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-uom"
                type="text"
                value={form.uom}
                onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                placeholder="e.g. EA"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-brand" className="text-sm">Brand</Label>
              <select
                id="item-brand"
                value={form.brandId}
                onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                className={cn(
                  "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">—</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name} {!b.isActive ? "(inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-category" className="text-sm">Category</Label>
              <select
                id="item-category"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className={cn(
                  "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">—</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} {!c.isActive ? "(inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="item-barcode" className="text-sm">Barcode</Label>
              <Input
                id="item-barcode"
                type="text"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Optional"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-purchasePrice" className="text-sm">Purchase price</Label>
              <Input
                id="item-purchasePrice"
                type="number"
                min={0}
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                placeholder="0.00"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="item-salePrice" className="text-sm">Sale price</Label>
              <Input
                id="item-salePrice"
                type="number"
                min={0}
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                placeholder="0.00"
                className="h-8 text-sm"
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
                className="cursor-pointer text-sm font-normal"
              >
                Active
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="item-description" className="text-sm">Description</Label>
              <Textarea
                id="item-description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional"
                rows={2}
                className="resize-none h-auto min-h-[4.5rem] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <ItemImagesCard
        isNew={isNew}
        itemId={isNew ? undefined : id}
        images={item?.images ?? []}
        onImagesChanged={() => setImagesRevision((n) => n + 1)}
      />
      </div>
    </div>
  );
}
