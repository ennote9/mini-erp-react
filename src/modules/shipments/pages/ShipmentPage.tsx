import { useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { shipmentRepository } from "../repository";
import { post, cancelDocument } from "../service";
import { salesOrderRepository } from "../../sales-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { ShipmentLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { DocumentIssueStrip } from "../../../shared/ui/feedback/DocumentIssueStrip";
import { actionIssue, getErrorAndWarningMessages, type Issue } from "../../../shared/issues";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agGridDefaultColDef, agGridSelectionColumnDef } from "../../../shared/ui/ag-grid/agGridDefaults";

type LineWithItem = ShipmentLine & { itemName: string; uom: string };

function shipmentLinesColumnDefs(): ColDef<LineWithItem>[] {
  return [
    {
      headerName: "№",
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
    },
    {
      headerName: "Item Code",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    { field: "itemName", headerName: "Item Name", flex: 1, minWidth: 180 },
    {
      headerName: "Brand",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      headerName: "Category",
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    { field: "qty", headerName: "Qty", width: 100 },
    { field: "uom", headerName: "UOM", width: 80 },
  ];
}

export function ShipmentPage() {
  const { id } = useParams<{ id: string }>();
  const [refresh, setRefresh] = useState(0);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);
  const doc = useMemo(
    () => (id ? shipmentRepository.getById(id) : undefined),
    [id, refresh],
  );
  const lines = useMemo(
    () => (id ? shipmentRepository.listLines(id) : []),
    [id, refresh],
  );
  const salesOrderNumber = useMemo(
    () =>
      doc
        ? salesOrderRepository.getById(doc.salesOrderId)?.number ??
          doc.salesOrderId
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

  const handlePost = () => {
    if (!id) return;
    setActionIssues([]);
    const result = post(id);
    if (result.success) setRefresh((r) => r + 1);
    else setActionIssues(result.issues);
  };
  const handleCancelDocument = () => {
    if (!id) return;
    setActionIssues([]);
    const result = cancelDocument(id);
    if (result.success) setRefresh((r) => r + 1);
    else setActionIssues([actionIssue(result.error)]);
  };

  if (!id || !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Shipment not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Sales", to: "/sales-orders" },
    { label: "Shipments", to: "/shipments" },
    { label: doc.number },
  ];

  const { errors: actionErrors, warnings: actionWarnings } =
    getErrorAndWarningMessages(actionIssues);
  const hasActionIssues = actionErrors.length > 0 || actionWarnings.length > 0;

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/shipments" aria-label="Back to Shipments" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">Shipment {doc.number}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <div className="doc-header__right">
            {hasActionIssues && (
              <DocumentIssueStrip errors={actionErrors} warnings={actionWarnings} />
            )}
            <div className="doc-header__actions">
              <Button type="button" disabled>
                Save
              </Button>
              {isDraft && (
                <Button type="button" onClick={handlePost}>
                  Post
                </Button>
              )}
              {isDraft && (
                <Button type="button" variant="outline" onClick={handleCancelDocument}>
                  Cancel document
                </Button>
              )}
            </div>
          </div>
        </div>
      }
      summary={null}
    >
      <Card className="max-w-2xl border-0 shadow-none">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-[0.9rem] font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <dl className="doc-summary doc-summary--compact">
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Number</dt>
              <dd className="doc-summary__value">{doc.number}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Date</dt>
              <dd className="doc-summary__value">{doc.date}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Related Sales Order</dt>
              <dd className="doc-summary__value">{salesOrderNumber}</dd>
            </div>
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Warehouse</dt>
              <dd className="doc-summary__value">{warehouseName}</dd>
            </div>
            {doc.comment != null && doc.comment !== "" && (
              <div className="doc-summary__row">
                <dt className="doc-summary__term">Comment</dt>
                <dd className="doc-summary__value">{doc.comment}</dd>
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
                columnDefs={shipmentLinesColumnDefs()}
                defaultColDef={agGridDefaultColDef}
                getRowId={(p) => p.data.id}
                rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
                selectionColumnDef={agGridSelectionColumnDef}
              />
            </AgGridContainer>
          </div>
        )}
      </div>
    </DocumentPageLayout>
  );
}
