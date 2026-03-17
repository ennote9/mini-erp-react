import { useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { receiptRepository } from "../repository";
import { post, cancelDocument } from "../service";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import type { ReceiptLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer } from "../../../shared/ui/ag-grid/AgGridContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agGridDefaultColDef } from "../../../shared/ui/ag-grid/agGridDefaults";

type LineWithItem = ReceiptLine & { itemName: string; uom: string };

function receiptLinesColumnDefs(): ColDef<LineWithItem>[] {
  return [
    { field: "itemName", headerName: "Item", flex: 1, minWidth: 120 },
    { field: "qty", headerName: "Qty", width: 100 },
    { field: "uom", headerName: "UOM", width: 80 },
  ];
}

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [refresh, setRefresh] = useState(0);
  const doc = useMemo(
    () => (id ? receiptRepository.getById(id) : undefined),
    [id, refresh],
  );
  const lines = useMemo(
    () => (id ? receiptRepository.listLines(id) : []),
    [id, refresh],
  );
  const purchaseOrderNumber = useMemo(
    () =>
      doc
        ? purchaseOrderRepository.getById(doc.purchaseOrderId)?.number ??
          doc.purchaseOrderId
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
    const result = post(id);
    if (result.success) setRefresh((r) => r + 1);
  };
  const handleCancelDocument = () => {
    if (!id) return;
    const result = cancelDocument(id);
    if (result.success) setRefresh((r) => r + 1);
  };

  if (!id || !doc) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Receipt not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Purchasing", to: "/purchase-orders" },
    { label: "Receipts", to: "/receipts" },
    { label: doc.number },
  ];

  return (
    <DocumentPageLayout
      breadcrumbItems={breadcrumbItems}
      breadcrumbPrefix={<BackButton to="/receipts" aria-label="Back to Receipts" />}
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">Receipt {doc.number}</h2>
            <StatusBadge status={doc.status} />
          </div>
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
              <dt className="doc-summary__term">Related Purchase Order</dt>
              <dd className="doc-summary__value">{purchaseOrderNumber}</dd>
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
                columnDefs={receiptLinesColumnDefs()}
                defaultColDef={agGridDefaultColDef}
                getRowId={(p) => p.data.id}
                suppressRowClickSelection
              />
            </AgGridContainer>
          </div>
        )}
      </div>
    </DocumentPageLayout>
  );
}
