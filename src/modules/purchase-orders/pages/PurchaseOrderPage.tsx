import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { purchaseOrderRepository } from "../repository";
import { confirm, cancelDocument, createReceipt, saveDraft } from "../service";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import type { PurchaseOrderLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { agGridDefaultColDef } from "../../../shared/ui/ag-grid/agGridDefaults";
import { todayYYYYMMDD, normalizeDateForPO } from "../dateUtils";
import { getPurchaseOrderHealth } from "../../../shared/documentHealth";

type LineWithItem = PurchaseOrderLine & { itemName: string };

type LineFormRow = { itemId: string; qty: number; unitPrice: number; _lineId: number };

type FormState = {
  date: string;
  supplierId: string;
  warehouseId: string;
  comment: string;
  lines: LineFormRow[];
};

function defaultForm(): FormState {
  return {
    date: todayYYYYMMDD(),
    supplierId: "",
    warehouseId: "",
    comment: "",
    lines: [],
  };
}

function poLinesDisplayColumnDefs(
  linesLength: number,
  onRemove: (lineId: number) => void,
): ColDef<LineFormRow>[] {
  return [
    {
      field: "itemId",
      headerName: "Item",
      flex: 1,
      minWidth: 180,
      editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const item = itemRepository.getById(p.value);
        return item ? `${item.name} (${item.code})` : p.value;
      },
    },
    {
      field: "qty",
      headerName: "Qty",
      width: 80,
      editable: false,
    },
    {
      field: "unitPrice",
      headerName: "Unit price",
      width: 100,
      editable: false,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? p.value.toFixed(2)
          : "0.00",
    },
    {
      headerName: "Line amount",
      width: 110,
      editable: false,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return "0.00";
        const amount = qty * unitPrice;
        return Number.isNaN(amount) ? "0.00" : amount.toFixed(2);
      },
    },
    {
      headerName: "",
      width: 90,
      sortable: false,
      cellRenderer: (params: { data?: LineFormRow }) => {
        if (!params.data) return null;
        const lineId = params.data._lineId;
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={linesLength <= 1}
            onClick={() => onRemove(lineId)}
            aria-label="Remove line"
          >
            Remove
          </Button>
        );
      },
    },
  ];
}

function poLinesReadOnlyColumnDefs(): ColDef<LineWithItem>[] {
  return [
    { field: "itemName", headerName: "Item", flex: 1, minWidth: 120 },
    { field: "qty", headerName: "Qty", width: 80 },
    {
      field: "unitPrice",
      headerName: "Unit price",
      width: 100,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? p.value.toFixed(2)
          : "0.00",
    },
    {
      headerName: "Line amount",
      width: 110,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return "0.00";
        const amount = qty * unitPrice;
        return Number.isNaN(amount) ? "0.00" : amount.toFixed(2);
      },
    },
  ];
}

export function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const doc = useMemo(
    () => (id && !isNew ? purchaseOrderRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );
  const lines = useMemo(
    () => (id && !isNew ? purchaseOrderRepository.listLines(id) : []),
    [id, isNew, refresh],
  );

  const nextLineIdRef = useRef(0);
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineEntryItemId, setLineEntryItemId] = useState("");
  const [lineEntryQty, setLineEntryQty] = useState(1);
  const [lineEntryUnitPrice, setLineEntryUnitPrice] = useState(0);
  const linesGridRef = useRef<AgGridReact<LineFormRow> | null>(null);

  useEffect(() => {
    if (isNew) {
      nextLineIdRef.current = 0;
      setForm(defaultForm());
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setSaveError(null);
      return;
    }
    if (doc?.status === "draft" && id) {
      const draftLines = purchaseOrderRepository.listLines(id);
      const linesWithId =
        draftLines.length > 0
          ? draftLines.map((l, idx) => ({
              itemId: l.itemId,
              qty: l.qty,
              unitPrice: typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0,
              _lineId: idx,
            }))
          : [];
      nextLineIdRef.current = linesWithId.length;
      setForm({
        date: normalizeDateForPO(doc.date),
        supplierId: doc.supplierId,
        warehouseId: doc.warehouseId,
        comment: doc.comment ?? "",
        lines: linesWithId,
      });
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      setSaveError(null);
    }
  }, [id, isNew, doc?.id, doc?.status, doc?.date, doc?.supplierId, doc?.warehouseId, doc?.comment, refresh]);

  const supplierName = useMemo(
    () =>
      doc
        ? supplierRepository.getById(doc.supplierId)?.name ?? doc.supplierId
        : "",
    [doc],
  );
  const warehouseName = useMemo(
    () =>
      doc
        ? warehouseRepository.getById(doc.warehouseId)?.name ?? doc.warehouseId
        : "",
    [doc],
  );
  const linesWithItem = useMemo<LineWithItem[]>(() => {
    return lines.map((line) => {
      const item = itemRepository.getById(line.itemId);
      return {
        ...line,
        itemName: item?.name ?? line.itemId,
      };
    });
  }, [lines]);

  const isDraft = doc?.status === "draft";
  const isConfirmed = doc?.status === "confirmed";
  const isEditable = isNew || isDraft;

  const activeSuppliers = useMemo(
    () => supplierRepository.list().filter((s) => s.isActive),
    [],
  );
  const activeWarehouses = useMemo(
    () => warehouseRepository.list().filter((w) => w.isActive),
    [],
  );
  const activeItems = useMemo(
    () => itemRepository.list().filter((i) => i.isActive),
    [],
  );

  const handleConfirm = () => {
    if (!id || isNew) return;
    const result = confirm(id);
    if (result.success) setRefresh((r) => r + 1);
    else alert(result.error);
  };
  const handleCancelDocument = () => {
    if (!id || isNew) return;
    const result = cancelDocument(id);
    if (result.success) setRefresh((r) => r + 1);
    else alert(result.error);
  };
  const handleCreateReceipt = () => {
    if (!id || isNew) return;
    const result = createReceipt(id);
    if (result.success) navigate(`/receipts/${result.receiptId}`);
    else alert(result.error);
  };

  const handleSave = () => {
    setSaveError(null);
    const linesToSave = form.lines
      .filter(
        (l) => l.itemId.trim() !== "" && typeof l.qty === "number" && l.qty > 0,
      )
      .map(({ itemId, qty, unitPrice }) => ({
        itemId,
        qty,
        unitPrice: typeof unitPrice === "number" && !Number.isNaN(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      }));
    const result = saveDraft(
      {
        date: normalizeDateForPO(form.date),
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        comment: form.comment || undefined,
        lines: linesToSave,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/purchase-orders");
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/purchase-orders");
  };

  const removeLineByLineId = useCallback((lineId: number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => l._lineId !== lineId),
    }));
    if (editingLineId === lineId) {
      setEditingLineId(null);
      setLineEntryItemId("");
      setLineEntryQty(1);
      setLineEntryUnitPrice(0);
      linesGridRef.current?.api?.deselectAll();
    }
  }, [editingLineId]);

  const addLineFromEntry = () => {
    const itemId = lineEntryItemId.trim();
    const qty = Number(lineEntryQty);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) return;
    const rawPrice = Number(lineEntryUnitPrice);
    const unitPrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    const _lineId = nextLineIdRef.current++;
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemId, qty, unitPrice, _lineId }],
    }));
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
  };

  const updateLineFromEntry = () => {
    if (editingLineId === null) return;
    const itemId = lineEntryItemId.trim();
    const qty = Number(lineEntryQty);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) return;
    const rawPrice = Number(lineEntryUnitPrice);
    const unitPrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) =>
        l._lineId === editingLineId ? { ...l, itemId, qty, unitPrice } : l,
      ),
    }));
    setEditingLineId(null);
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    linesGridRef.current?.api?.deselectAll();
  };

  const cancelEdit = () => {
    setEditingLineId(null);
    setLineEntryItemId("");
    setLineEntryQty(1);
    setLineEntryUnitPrice(0);
    linesGridRef.current?.api?.deselectAll();
  };

  const onLinesSelectionChanged = useCallback((e: SelectionChangedEvent<LineFormRow>) => {
    const rows = e.api.getSelectedRows();
    if (rows.length === 1 && rows[0]) {
      const row = rows[0];
      setEditingLineId(row._lineId);
      setLineEntryItemId(row.itemId);
      setLineEntryQty(row.qty);
      setLineEntryUnitPrice(typeof row.unitPrice === "number" && !Number.isNaN(row.unitPrice) ? row.unitPrice : 0);
    }
  }, []);

  const linesColumnDefs = useMemo(
    () => poLinesDisplayColumnDefs(form.lines.length, removeLineByLineId),
    [form.lines.length, removeLineByLineId],
  );

  const handleLineEntryItemChange = (itemId: string) => {
    setLineEntryItemId(itemId);
    const item = itemId ? itemRepository.getById(itemId) : undefined;
    const price = item?.purchasePrice;
    setLineEntryUnitPrice(typeof price === "number" && !Number.isNaN(price) && price >= 0 ? price : 0);
  };

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const l of form.lines) {
      const q = typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0;
      const p = typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0;
      totalQty += q;
      totalAmount += q * p;
    }
    return { totalQty, totalAmount };
  }, [form.lines]);

  const readonlyTotals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const l of lines) {
      const q = typeof l.qty === "number" && !Number.isNaN(l.qty) ? l.qty : 0;
      const p = typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0;
      totalQty += q;
      totalAmount += q * p;
    }
    return { totalQty, totalAmount };
  }, [lines]);

  const health = useMemo(
    () =>
      getPurchaseOrderHealth({
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        lines: form.lines,
      }),
    [form.supplierId, form.warehouseId, form.lines],
  );

  const getRowClass = useCallback(
    (params: { data?: LineFormRow }) => {
      if (!params.data) return undefined;
      const h = health.lineHealth.get(params.data._lineId);
      return h === "error" ? "doc-lines__row--error" : h === "warning" ? "doc-lines__row--warning" : undefined;
    },
    [health.lineHealth],
  );

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Purchase order not found.</p>
      </div>
    );
  }

  if (!isNew && !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Purchase order not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Purchasing", to: "/purchase-orders" },
    { label: "Purchase Orders", to: "/purchase-orders" },
    { label: isNew ? "New" : doc!.number },
  ];

  const displayTitle = isNew ? "New Purchase Order" : `Purchase Order ${doc!.number}`;
  const displayNumber = isNew ? "—" : doc!.number;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/purchase-orders" aria-label="Back to Purchase Orders" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
            {!isNew && <StatusBadge status={doc!.status} />}
          </div>
          <div className="doc-header__right">
            <div className="doc-header__actions">
              {isEditable && (
                <Button type="button" onClick={handleSave}>
                  Save
                </Button>
              )}
              {!isNew && isDraft && (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={health.errors.length > 0}
                  title={health.errors.length > 0 ? "Fix errors before confirming." : undefined}
                >
                  Confirm
                </Button>
              )}
              {!isNew && isConfirmed && (
                <Button type="button" onClick={handleCreateReceipt}>
                  Create Receipt
                </Button>
              )}
              {!isNew && (isDraft || isConfirmed) && (
                <Button type="button" variant="outline" onClick={handleCancelDocument}>
                  Cancel document
                </Button>
              )}
              {isEditable && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
            {isEditable && (health.errors.length > 0 || health.warnings.length > 0) && (
              <div className="doc-health-panel" role="status" aria-live="polite">
                <div className="doc-health-panel__title">Document issues</div>
                <div className="doc-health-panel__counts">
                  {health.errors.length > 0 && (
                    <span className="doc-health-panel__errors">
                      {health.errors.length} {health.errors.length === 1 ? "error" : "errors"}
                    </span>
                  )}
                  {health.errors.length > 0 && health.warnings.length > 0 && (
                    <span className="doc-health-panel__sep"> · </span>
                  )}
                  {health.warnings.length > 0 && (
                    <span className="doc-health-panel__warnings">
                      {health.warnings.length} {health.warnings.length === 1 ? "warning" : "warnings"}
                    </span>
                  )}
                </div>
                <div className="doc-health-panel__lines">
                  {[...health.errors, ...health.warnings].slice(0, 2).map((msg, i) => (
                    <div key={i} className="doc-health-panel__line">
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      }
      summary={
        saveError ? (
          <div
            className="rounded-md border border-red-600/80 bg-destructive/25 px-4 py-1.5 text-sm text-red-600"
            role="alert"
          >
            {saveError}
          </div>
        ) : null
      }
    >
      {isEditable ? (
        <>
          <Card className="max-w-2xl border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="po-number" className="text-sm">Number</Label>
                  <div id="po-number" className="flex h-8 items-center text-sm text-muted-foreground">
                    {displayNumber}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="po-date" className="text-sm">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePickerField
                    id="po-date"
                    value={form.date}
                    onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                    className="h-8 [&_input]:text-sm"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="po-supplier" className="text-sm">
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="po-supplier"
                    value={form.supplierId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplierId: e.target.value }))
                    }
                    className={cn(
                      "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <option value="">Select supplier</option>
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="po-warehouse" className="text-sm">
                    Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="po-warehouse"
                    value={form.warehouseId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, warehouseId: e.target.value }))
                    }
                    className={cn(
                      "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <option value="">Select warehouse</option>
                    {activeWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <Label htmlFor="po-comment" className="text-sm">Comment</Label>
                  <Input
                    id="po-comment"
                    type="text"
                    value={form.comment}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, comment: e.target.value }))
                    }
                    placeholder="Optional"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="doc-lines mt-2">
            <h3 className="doc-lines__title">Lines</h3>
            {isEditable && (
              <Card className="max-w-2xl border-0 shadow-none mb-1.5">
                <CardContent className="p-2">
                  <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-x-2 gap-y-0 items-end">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-item" className="text-sm">
                        Item <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="line-entry-item"
                        value={lineEntryItemId}
                        onChange={(e) => handleLineEntryItemChange(e.target.value)}
                        className={cn(
                          "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        <option value="">Select item</option>
                        {activeItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-qty" className="text-sm">
                        Qty <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="line-entry-qty"
                        type="number"
                        min={1}
                        value={lineEntryQty}
                        onChange={(e) =>
                          setLineEntryQty(Number(e.target.value) || 1)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="line-entry-unit-price" className="text-sm">Unit price</Label>
                      <Input
                        id="line-entry-unit-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={lineEntryUnitPrice}
                        onChange={(e) =>
                          setLineEntryUnitPrice(Number(e.target.value) >= 0 ? Number(e.target.value) : 0)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {editingLineId === null ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addLineFromEntry}
                        >
                          Add line
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={updateLineFromEntry}
                          >
                            Update line
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            Cancel edit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="doc-lines__grid">
              <AgGridContainer themeClass="doc-lines-grid">
                <AgGridReact<LineFormRow>
                  ref={linesGridRef}
                  rowData={form.lines}
                  columnDefs={linesColumnDefs}
                  defaultColDef={agGridDefaultColDef}
                  getRowId={(p) => String(p.data._lineId)}
                  getRowClass={getRowClass}
                  rowSelection={isEditable ? "single" : undefined}
                  onSelectionChanged={isEditable ? onLinesSelectionChanged : undefined}
                  suppressRowClickSelection={false}
                />
              </AgGridContainer>
            </div>
            {form.lines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Total qty: {totals.totalQty}</span>
                <span>Total amount: {totals.totalAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Card className="max-w-2xl border-0 shadow-none">
            <CardHeader className="p-2 pb-0.5">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-1">
              <dl className="doc-summary doc-summary--compact doc-summary--dense">
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Number</dt>
                  <dd className="doc-summary__value">{doc!.number}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Date</dt>
                  <dd className="doc-summary__value">{normalizeDateForPO(doc!.date)}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Supplier</dt>
                  <dd className="doc-summary__value">{supplierName}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Warehouse</dt>
                  <dd className="doc-summary__value">{warehouseName}</dd>
                </div>
                {doc!.comment != null && doc!.comment !== "" && (
                  <div className="doc-summary__row">
                    <dt className="doc-summary__term">Comment</dt>
                    <dd className="doc-summary__value">{doc!.comment}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
          <div className="doc-lines mt-2">
            <h3 className="doc-lines__title">Lines</h3>
            {linesWithItem.length === 0 ? (
              <p className="doc-lines__empty">No lines.</p>
            ) : (
              <>
                <div className="doc-lines__grid">
                  <AgGridContainer themeClass="doc-lines-grid">
                    <AgGridReact<LineWithItem>
                      rowData={linesWithItem}
                      columnDefs={poLinesReadOnlyColumnDefs()}
                      defaultColDef={agGridDefaultColDef}
                      getRowId={(p) => p.data.id}
                      suppressRowClickSelection
                    />
                  </AgGridContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>Total qty: {readonlyTotals.totalQty}</span>
                  <span>Total amount: {readonlyTotals.totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </DocumentPageLayout>
  );
}
