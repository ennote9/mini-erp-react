import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { categoryRepository } from "../repository";
import { saveCategory } from "../service";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import type { Item } from "../../items/model";
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
import { actionIssue, combineIssues, getErrorAndWarningMessages, issueListContainsMessage, type Issue } from "../../../shared/issues";
import { getCategoryFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  comment: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    comment: "",
  };
}

function itemImageCount(item: Item): number {
  return Array.isArray(item.images) ? item.images.length : 0;
}

function RelatedItemsImagesCell({ item }: { item: Item }) {
  const n = itemImageCount(item);
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }
  return <span className="tabular-nums text-foreground/90">{n}</span>;
}

export function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const category = useMemo(
    () => (id && !isNew ? categoryRepository.getById(id) : undefined),
    [id, isNew],
  );

  const relatedItems = useMemo(() => {
    if (!category?.id) return [];
    return itemRepository
      .list()
      .filter((item) => item.categoryId === category.id)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: "base" }));
  }, [category?.id]);

  const relatedSummary = useMemo(() => {
    const total = relatedItems.length;
    const active = relatedItems.filter((x) => x.isActive).length;
    return { total, active, inactive: total - active };
  }, [relatedItems]);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const health = useMemo(
    () =>
      getCategoryFormHealth({
        code: form.code,
        name: form.name,
      }),
    [form.code, form.name],
  );

  useEffect(() => {
    setActionIssues([]);
  }, [form.code, form.name]);

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
    if (category) {
      setForm({
        code: category.code,
        name: category.name,
        isActive: category.isActive,
        comment: category.comment ?? "",
      });
    }
  }, [id, isNew, category?.id, category?.code, category?.name, category?.isActive, category?.comment]);

  const handleSave = () => {
    setActionIssues([]);
    const result = saveCategory(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        comment: form.comment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/categories");
    } else if (!issueListContainsMessage(health.issues, result.error)) {
      setActionIssues([actionIssue(result.error)]);
    }
  };

  const handleCancel = () => {
    navigate("/categories");
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Category not found.</p>
      </div>
    );
  }

  if (!isNew && !category) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Category not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/categories" },
    { label: "Categories", to: "/categories" },
    { label: isNew ? "New" : category!.code },
  ];

  const displayTitle = isNew ? "New Category" : `Category ${category!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/categories" aria-label="Back to Categories" />
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
                <Save aria-hidden />
                Save
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X aria-hidden />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
          <CardDescription className="text-xs">
            Code, name and status for this category.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="category-code" className="text-sm">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. COMPONENTS"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="category-name" className="text-sm">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Checkbox
                id="category-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked === true }))
                }
              />
              <Label
                htmlFor="category-active"
                className="cursor-pointer text-sm font-normal"
              >
                Active
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="category-comment" className="text-sm">Comment</Label>
              <Textarea
                id="category-comment"
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
                placeholder="Optional"
                rows={2}
                className="resize-none min-h-[4.5rem] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && category ? (
        <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
          <CardHeader className="p-2 pb-0.5 space-y-0">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
              <div className="min-w-0 space-y-0.5 flex-1">
                <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                  Related Items
                </CardTitle>
                <CardDescription className="text-xs leading-snug">
                  Linked inventory records. Read-only; open a row for detail.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={() =>
                  navigate(`/items?categoryId=${encodeURIComponent(category.id)}`)
                }
              >
                Open all items
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-1 space-y-2">
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="Related items summary"
            >
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium text-foreground/90">{relatedSummary.total}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium text-foreground/90">{relatedSummary.active}</span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                <span className="text-muted-foreground">Inactive</span>
                <span className="font-medium text-foreground/90">{relatedSummary.inactive}</span>
              </span>
            </div>
            {relatedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 m-0">
                No items linked to this category yet.
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                <table className="list-table text-sm">
                  <thead>
                    <tr>
                      <th className="list-table__cell--code">Code</th>
                      <th className="list-table__cell--name">Name</th>
                      <th className="min-w-[100px]">Brand</th>
                      <th className="w-16 text-right whitespace-nowrap">Images</th>
                      <th className="list-table__cell--active">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedItems.map((item) => {
                      const brand =
                        item.brandId != null && item.brandId !== ""
                          ? brandRepository.getById(item.brandId)
                          : undefined;
                      const brandName = brand ? brand.name || brand.code || "—" : "—";
                      return (
                        <tr
                          key={item.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/items/${item.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open item ${item.code}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/items/${item.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-mono text-xs">{item.code}</td>
                          <td className="list-table__cell--name">{item.name}</td>
                          <td className="text-muted-foreground">{brandName}</td>
                          <td className="text-right">
                            <RelatedItemsImagesCell item={item} />
                          </td>
                          <td className="list-table__cell--active">
                            <span
                              className={
                                item.isActive
                                  ? "status-plain-text status-plain-text--active"
                                  : "status-plain-text status-plain-text--inactive"
                              }
                            >
                              {item.isActive ? "Active" : "Inactive"}
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
      ) : null}
    </div>
  );
}
