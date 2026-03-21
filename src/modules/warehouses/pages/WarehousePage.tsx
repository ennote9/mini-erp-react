import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { warehouseRepository } from "../repository";
import { saveWarehouse } from "../service";
import { receiptRepository } from "../../receipts/repository";
import { shipmentRepository } from "../../shipments/repository";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
import { salesOrderRepository } from "../../sales-orders/repository";
import { stockBalanceRepository } from "../../stock-balances/repository";
import { stockMovementRepository } from "../../stock-movements/repository";
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
import { actionIssue, combineIssues, getErrorAndWarningMessages, issueListContainsMessage, type Issue } from "../../../shared/issues";
import { getWarehouseFormHealth } from "../../../shared/masterDataHealth";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { Save, X } from "lucide-react";

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
  const isNew = id === "new";
  const warehouse = useMemo(
    () => (id && !isNew ? warehouseRepository.getById(id) : undefined),
    [id, isNew],
  );

  const relatedReceiptRows = useMemo(() => {
    if (!warehouse?.id) return [];
    const rows = receiptRepository
      .list()
      .filter((r) => r.warehouseId === warehouse.id)
      .slice()
      .sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.number.localeCompare(a.number, undefined, { numeric: true });
      });
    return rows.map((r) => {
      const po = purchaseOrderRepository.getById(r.purchaseOrderId);
      return {
        ...r,
        purchaseOrderNumber: po?.number ?? r.purchaseOrderId,
        lineCount: receiptRepository.listLines(r.id).length,
      };
    });
  }, [warehouse?.id]);

  const relatedReceiptSummary = useMemo(() => {
    const rows = relatedReceiptRows;
    return {
      total: rows.length,
      draft: rows.filter((x) => x.status === "draft").length,
      posted: rows.filter((x) => x.status === "posted").length,
      cancelled: rows.filter((x) => x.status === "cancelled").length,
    };
  }, [relatedReceiptRows]);

  const relatedShipmentRows = useMemo(() => {
    if (!warehouse?.id) return [];
    const rows = shipmentRepository
      .list()
      .filter((s) => s.warehouseId === warehouse.id)
      .slice()
      .sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) return db.localeCompare(da);
        return b.number.localeCompare(a.number, undefined, { numeric: true });
      });
    return rows.map((s) => {
      const so = salesOrderRepository.getById(s.salesOrderId);
      return {
        ...s,
        salesOrderNumber: so?.number ?? s.salesOrderId,
        lineCount: shipmentRepository.listLines(s.id).length,
      };
    });
  }, [warehouse?.id]);

  const relatedShipmentSummary = useMemo(() => {
    const rows = relatedShipmentRows;
    return {
      total: rows.length,
      draft: rows.filter((x) => x.status === "draft").length,
      posted: rows.filter((x) => x.status === "posted").length,
      cancelled: rows.filter((x) => x.status === "cancelled").length,
    };
  }, [relatedShipmentRows]);

  const inventoryCounts = useMemo(() => {
    if (!warehouse?.id) return { balanceRows: 0, movementRows: 0 };
    const wid = warehouse.id;
    const balanceRows = stockBalanceRepository.list().filter((b) => b.warehouseId === wid).length;
    const movementRows = stockMovementRepository.list().filter((m) => m.warehouseId === wid).length;
    return { balanceRows, movementRows };
  }, [warehouse?.id]);

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
  const { errors: combinedErrors, warnings: combinedWarnings } = useMemo(
    () => getErrorAndWarningMessages(combinedIssues),
    [combinedIssues],
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
      setActionIssues([actionIssue(result.error)]);
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
            Code, name and status for this warehouse.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-code" className="text-sm">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="warehouse-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WH-001"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-name" className="text-sm">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="warehouse-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Warehouse name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-type" className="text-sm">Type</Label>
              <Input
                id="warehouse-type"
                type="text"
                value={form.warehouseType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, warehouseType: e.target.value }))
                }
                placeholder="e.g. Main, Distribution"
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
                Active
              </Label>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-comment" className="text-sm">Comment</Label>
              <Textarea
                id="warehouse-comment"
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
      <Card className="mt-4 max-w-2xl border-0 shadow-none">
        <CardHeader className="p-2 pb-0.5">
          <CardTitle className="text-sm font-semibold">Address &amp; contact</CardTitle>
          <CardDescription className="text-xs">
            Address, city, country and contact details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-address" className="text-sm">Address</Label>
              <Input
                id="warehouse-address"
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Street address"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-city" className="text-sm">City</Label>
              <Input
                id="warehouse-city"
                type="text"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder="City"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="warehouse-country" className="text-sm">Country</Label>
              <Input
                id="warehouse-country"
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                placeholder="Country"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-contact-person" className="text-sm">Contact person</Label>
              <Input
                id="warehouse-contact-person"
                type="text"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
                placeholder="Name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <Label htmlFor="warehouse-phone" className="text-sm">Phone</Label>
              <Input
                id="warehouse-phone"
                type="text"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="e.g. +1 312 555 0100"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isNew && warehouse ? (
        <>
          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <CardTitle className="text-[0.9rem] font-semibold tracking-tight">Inventory</CardTitle>
              <CardDescription className="text-xs leading-snug">
                View stock balances and stock movements for this warehouse.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="Inventory summary for this warehouse"
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Balance rows</span>
                  <span className="font-medium text-foreground/90">{inventoryCounts.balanceRows}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Movement rows</span>
                  <span className="font-medium text-foreground/90">{inventoryCounts.movementRows}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/stock-balances?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  Open stock balances
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
                  Open stock movements
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                    Related Receipts
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    Incoming stock for this warehouse. Read-only; open a row for detail.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/receipts?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  Open all receipts
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="Related receipts summary"
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Receipts</span>
                  <span className="font-medium text-foreground/90">{relatedReceiptSummary.total}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-medium text-foreground/90">{relatedReceiptSummary.draft}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Posted</span>
                  <span className="font-medium text-foreground/90">{relatedReceiptSummary.posted}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Cancelled</span>
                  <span className="font-medium text-foreground/90">{relatedReceiptSummary.cancelled}</span>
                </span>
              </div>
              {relatedReceiptRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 m-0">
                  No receipts linked to this warehouse yet.
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                  <table className="list-table text-sm">
                    <thead>
                      <tr>
                        <th className="list-table__cell--code">Number</th>
                        <th className="min-w-[100px]">Status</th>
                        <th className="min-w-[140px]">Purchase order</th>
                        <th className="w-14 text-right whitespace-nowrap tabular-nums">Lines</th>
                        <th className="min-w-[100px] whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedReceiptRows.map((r) => (
                        <tr
                          key={r.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/receipts/${r.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open receipt ${r.number}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/receipts/${r.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-medium">{r.number}</td>
                          <td>
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="truncate max-w-[12rem]" title={r.purchaseOrderNumber}>
                            {r.purchaseOrderNumber}
                          </td>
                          <td className="text-right tabular-nums">{r.lineCount}</td>
                          <td className="tabular-nums text-foreground/90 whitespace-nowrap">{r.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5 space-y-0">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
                <div className="min-w-0 space-y-0.5 flex-1">
                  <CardTitle className="text-[0.9rem] font-semibold tracking-tight">
                    Related Shipments
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    Outgoing stock from this warehouse. Read-only; open a row for detail.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() =>
                    navigate(`/shipments?warehouseId=${encodeURIComponent(warehouse.id)}`)
                  }
                >
                  Open all shipments
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-2">
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="Related shipments summary"
              >
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Shipments</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.total}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.draft}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Posted</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.posted}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
                  <span className="text-muted-foreground">Cancelled</span>
                  <span className="font-medium text-foreground/90">{relatedShipmentSummary.cancelled}</span>
                </span>
              </div>
              {relatedShipmentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 m-0">
                  No shipments linked to this warehouse yet.
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
                  <table className="list-table text-sm">
                    <thead>
                      <tr>
                        <th className="list-table__cell--code">Number</th>
                        <th className="min-w-[100px]">Status</th>
                        <th className="min-w-[140px]">Sales order</th>
                        <th className="w-14 text-right whitespace-nowrap tabular-nums">Lines</th>
                        <th className="min-w-[100px] whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedShipmentRows.map((s) => (
                        <tr
                          key={s.id}
                          className="list-table__row list-table__row--clickable"
                          onClick={() => navigate(`/shipments/${s.id}`)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open shipment ${s.number}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/shipments/${s.id}`);
                            }
                          }}
                        >
                          <td className="list-table__cell--code font-medium">{s.number}</td>
                          <td>
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="truncate max-w-[12rem]" title={s.salesOrderNumber}>
                            {s.salesOrderNumber}
                          </td>
                          <td className="text-right tabular-nums">{s.lineCount}</td>
                          <td className="tabular-nums text-foreground/90 whitespace-nowrap">{s.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
