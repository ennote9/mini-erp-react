import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, CellValueChangedEvent } from "ag-grid-community";
import { salesOrderRepository } from "../repository";
import { confirm, cancelDocument, createShipment, saveDraft } from "../service";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import type { SalesOrderLine } from "../model";
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
import { ItemSelectCellEditor } from "../../../shared/ui/ag-grid/ItemSelectCellEditor";
import { agGridDefaultColDef } from "../../../shared/ui/ag-grid/agGridDefaults";
import { todayYYYYMMDD, normalizeDateForSO } from "../dateUtils";

type LineWithItem = SalesOrderLine & { itemName: string; uom: string };

type LineFormRow = { itemId: string; qty: number; _lineId: number };

type FormState = {
  date: string;
  customerId: string;
  warehouseId: string;
  comment: string;
  lines: LineFormRow[];
};

function defaultForm(nextLineId: number): FormState {
  return {
    date: todayYYYYMMDD(),
    customerId: "",
    warehouseId: "",
    comment: "",
    lines: [{ itemId: "", qty: 1, _lineId: nextLineId }],
  };
}

function soLinesEditableColumnDefs(
  activeItems: { id: string; code: string; name: string }[],
  linesLength: number,
  onRemove: (lineId: number) => void,
  onItemIdChange: (lineId: number, itemId: string) => void,
): ColDef<LineFormRow>[] {
  return [
    {
      field: "itemId",
      headerName: "Item *",
      flex: 1,
      minWidth: 180,
      editable: true,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const item = itemRepository.getById(p.value);
        return item ? `${item.name} (${item.code})` : p.value;
      },
      cellEditor: ItemSelectCellEditor,
      cellEditorParams: { items: activeItems, onItemSelected: onItemIdChange },
    },
    {
      field: "qty",
      headerName: "Qty *",
      width: 100,
      editable: true,
      type: "numericColumn",
      cellEditor: "agNumberCellEditor",
      cellEditorParams: { min: 0 },
    },
    {
      headerName: "UOM",
      width: 80,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        return itemId ? itemRepository.getById(itemId)?.uom ?? "—" : "—";
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

function soLinesReadOnlyColumnDefs(): ColDef<LineWithItem>[] {
  return [
    { field: "itemName", headerName: "Item", flex: 1, minWidth: 120 },
    { field: "qty", headerName: "Qty", width: 100 },
    { field: "uom", headerName: "UOM", width: 80 },
  ];
}

export function SalesOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const doc = useMemo(
    () => (id && !isNew ? salesOrderRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );
  const lines = useMemo(
    () => (id && !isNew ? salesOrderRepository.listLines(id) : []),
    [id, isNew, refresh],
  );

  const nextLineIdRef = useRef(0);
  const [form, setForm] = useState<FormState>(() => defaultForm(0));

  useEffect(() => {
    if (isNew) {
      nextLineIdRef.current = 0;
      setForm(defaultForm(0));
      setSaveError(null);
      return;
    }
    if (doc?.status === "draft" && id) {
      const draftLines = salesOrderRepository.listLines(id);
      const linesWithId =
        draftLines.length > 0
          ? draftLines.map((l, idx) => ({
              itemId: l.itemId,
              qty: l.qty,
              _lineId: idx,
            }))
          : [{ itemId: "", qty: 1, _lineId: 0 }];
      nextLineIdRef.current = linesWithId.length;
      setForm({
        date: normalizeDateForSO(doc.date),
        customerId: doc.customerId,
        warehouseId: doc.warehouseId,
        comment: doc.comment ?? "",
        lines: linesWithId,
      });
      setSaveError(null);
    }
  }, [id, isNew, doc?.id, doc?.status, doc?.date, doc?.customerId, doc?.warehouseId, doc?.comment, refresh]);

  const customerName = useMemo(
    () =>
      doc
        ? customerRepository.getById(doc.customerId)?.name ?? doc.customerId
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
        uom: item?.uom ?? "—",
      };
    });
  }, [lines]);

  const isDraft = doc?.status === "draft";
  const isConfirmed = doc?.status === "confirmed";
  const isEditable = isNew || isDraft;

  const activeCustomers = useMemo(
    () => customerRepository.list().filter((c) => c.isActive),
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
  const handleCreateShipment = () => {
    if (!id || isNew) return;
    const result = createShipment(id);
    if (result.success) navigate(`/shipments/${result.shipmentId}`);
    else alert(result.error);
  };

  const handleSave = () => {
    setSaveError(null);
    const linesToSave = form.lines
      .filter(
        (l) => l.itemId.trim() !== "" && typeof l.qty === "number" && l.qty > 0,
      )
      .map(({ itemId, qty }) => ({ itemId, qty }));
    const result = saveDraft(
      {
        date: normalizeDateForSO(form.date),
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        comment: form.comment || undefined,
        lines: linesToSave,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      navigate("/sales-orders");
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/sales-orders");
  };

  const addLine = () => {
    const lineId = nextLineIdRef.current++;
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemId: "", qty: 1, _lineId: lineId }],
    }));
  };
  const removeLineByLineId = (lineId: number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => l._lineId !== lineId),
    }));
  };
  const onItemIdChange = (lineId: number, itemId: string) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) =>
        l._lineId === lineId ? { ...l, itemId } : l,
      ),
    }));
  };
  const onLinesCellValueChanged = (e: CellValueChangedEvent<LineFormRow>) => {
    if (!e.data || e.colDef.field == null) return;
    const lineId = e.data._lineId;
    const field = e.colDef.field as keyof LineFormRow;
    const value = e.data[field];
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) =>
        l._lineId === lineId ? { ...l, [field]: value } : l,
      ),
    }));
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Sales order not found.</p>
      </div>
    );
  }

  if (!isNew && !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Sales order not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Sales", to: "/sales-orders" },
    { label: "Sales Orders", to: "/sales-orders" },
    { label: isNew ? "New" : doc!.number },
  ];

  const displayTitle = isNew ? "New Sales Order" : `Sales Order ${doc!.number}`;
  const displayNumber = isNew ? "—" : doc!.number;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/sales-orders" aria-label="Back to Sales Orders" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
            {!isNew && <StatusBadge status={doc!.status} />}
          </div>
          <div className="doc-header__actions">
            {isEditable && (
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
            )}
            {!isNew && isDraft && (
              <Button type="button" onClick={handleConfirm}>
                Confirm
              </Button>
            )}
            {!isNew && isConfirmed && (
              <Button type="button" onClick={handleCreateShipment}>
                Create Shipment
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
            <CardHeader className="p-4 pb-1">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="so-number">Number</Label>
                  <div id="so-number" className="flex h-10 items-center text-sm text-muted-foreground">
                    {displayNumber}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="so-date">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePickerField
                    id="so-date"
                    value={form.date}
                    onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="so-customer">
                    Customer <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="so-customer"
                    value={form.customerId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customerId: e.target.value }))
                    }
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    )}
                  >
                    <option value="">Select customer</option>
                    {activeCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="so-warehouse">
                    Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="so-warehouse"
                    value={form.warehouseId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, warehouseId: e.target.value }))
                    }
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="so-comment">Comment</Label>
                  <Input
                    id="so-comment"
                    type="text"
                    value={form.comment}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, comment: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="doc-lines mt-4">
            <div className="doc-lines__head">
              <h3 className="doc-lines__title">Lines</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                Add line
              </Button>
            </div>
            <div className="doc-lines__grid">
              <AgGridContainer themeClass="doc-lines-grid">
                <AgGridReact<LineFormRow>
                  rowData={form.lines}
                  columnDefs={soLinesEditableColumnDefs(activeItems, form.lines.length, removeLineByLineId, onItemIdChange)}
                  defaultColDef={agGridDefaultColDef}
                  getRowId={(p) => String(p.data._lineId)}
                  onCellValueChanged={onLinesCellValueChanged}
                  singleClickEdit
                  stopEditingWhenCellsLoseFocus
                  suppressRowClickSelection
                />
              </AgGridContainer>
            </div>
          </div>
        </>
      ) : (
        <>
          <Card className="max-w-2xl border-0 shadow-none">
            <CardHeader className="p-4 pb-1">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <dl className="doc-summary doc-summary--compact">
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Number</dt>
                  <dd className="doc-summary__value">{doc!.number}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Date</dt>
                  <dd className="doc-summary__value">{normalizeDateForSO(doc!.date)}</dd>
                </div>
                <div className="doc-summary__row">
                  <dt className="doc-summary__term">Customer</dt>
                  <dd className="doc-summary__value">{customerName}</dd>
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
          <div className="doc-lines mt-4">
            <h3 className="doc-lines__title">Lines</h3>
            {linesWithItem.length === 0 ? (
              <p className="doc-lines__empty">No lines.</p>
            ) : (
              <div className="doc-lines__grid">
                <AgGridContainer themeClass="doc-lines-grid">
                  <AgGridReact<LineWithItem>
                    rowData={linesWithItem}
                    columnDefs={soLinesReadOnlyColumnDefs()}
                    defaultColDef={agGridDefaultColDef}
                    getRowId={(p) => p.data.id}
                    suppressRowClickSelection
                  />
                </AgGridContainer>
              </div>
            )}
          </div>
        </>
      )}
    </DocumentPageLayout>
  );
}
