import { useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { receiptRepository } from "../repository";
import { post, cancelDocument } from "../service";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import type { ReceiptLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";

type LineWithItem = ReceiptLine & { itemName: string; uom: string };

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [refresh, setRefresh] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setActionError(null);
    const result = post(id);
    if (result.success) {
      setRefresh((r) => r + 1);
    } else {
      setActionError(result.error);
    }
  };
  const handleCancelDocument = () => {
    if (!id) return;
    setActionError(null);
    const result = cancelDocument(id);
    if (result.success) {
      setRefresh((r) => r + 1);
    } else {
      setActionError(result.error);
    }
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
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">Receipt {doc.number}</h2>
            <StatusBadge status={doc.status} />
          </div>
          <div className="doc-header__actions">
            <button type="button" className="doc-header__btn" disabled>
              Save
            </button>
            {isDraft && (
              <button
                type="button"
                className="doc-header__btn"
                onClick={handlePost}
              >
                Post
              </button>
            )}
            {isDraft && (
              <button
                type="button"
                className="doc-header__btn doc-header__btn--secondary"
                onClick={handleCancelDocument}
              >
                Cancel document
              </button>
            )}
          </div>
        </div>
      }
      summary={
        <>
          {actionError && (
            <div className="doc-form__error" role="alert">
              {actionError}
            </div>
          )}
          <dl className="doc-summary">
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
          <div className="doc-summary__row">
            <dt className="doc-summary__term">Status</dt>
            <dd className="doc-summary__value">
              <StatusBadge status={doc.status} />
            </dd>
          </div>
          {doc.comment != null && doc.comment !== "" && (
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Comment</dt>
              <dd className="doc-summary__value">{doc.comment}</dd>
            </div>
          )}
          </dl>
        </>
      }
    >
      <div className="doc-lines">
        <h3 className="doc-lines__title">Lines</h3>
        {linesWithItem.length === 0 ? (
          <p className="doc-lines__empty">No lines.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th className="list-table__cell list-table__cell--item">
                  Item
                </th>
                <th className="list-table__cell list-table__cell--qty">Qty</th>
                <th className="list-table__cell list-table__cell--uom">UOM</th>
              </tr>
            </thead>
            <tbody>
              {linesWithItem.map((line) => (
                <tr key={line.id} className="list-table__row">
                  <td className="list-table__cell list-table__cell--item">
                    {line.itemName}
                  </td>
                  <td className="list-table__cell list-table__cell--qty">
                    {line.qty}
                  </td>
                  <td className="list-table__cell list-table__cell--uom">
                    {line.uom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DocumentPageLayout>
  );
}
