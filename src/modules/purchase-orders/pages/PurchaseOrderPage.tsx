import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { purchaseOrderRepository } from "../repository";
import { confirm, cancelDocument, createReceipt, saveDraft } from "../service";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import type { PurchaseOrderLine } from "../model";
import { DocumentPageLayout } from "../../../shared/ui/object/DocumentPageLayout";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { todayYYYYMMDD, normalizeDateForPO } from "../dateUtils";

type LineWithItem = PurchaseOrderLine & { itemName: string; uom: string };

type FormState = {
  date: string;
  supplierId: string;
  warehouseId: string;
  comment: string;
  lines: Array<{ itemId: string; qty: number }>;
};

function defaultForm(): FormState {
  return {
    date: todayYYYYMMDD(),
    supplierId: "",
    warehouseId: "",
    comment: "",
    lines: [{ itemId: "", qty: 0 }],
  };
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

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (doc?.status === "draft" && id) {
      const draftLines = purchaseOrderRepository.listLines(id);
      setForm({
        date: normalizeDateForPO(doc.date),
        supplierId: doc.supplierId,
        warehouseId: doc.warehouseId,
        comment: doc.comment ?? "",
        lines:
          draftLines.length > 0
            ? draftLines.map((l) => ({ itemId: l.itemId, qty: l.qty }))
            : [{ itemId: "", qty: 0 }],
      });
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
        uom: item?.uom ?? "—",
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
    const linesToSave = form.lines.filter(
      (l) => l.itemId.trim() !== "" && typeof l.qty === "number" && l.qty > 0,
    );
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
      if (isNew) navigate(`/purchase-orders/${result.id}`);
      else setRefresh((r) => r + 1);
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/purchase-orders");
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemId: "", qty: 0 }],
    }));
  };
  const removeLine = (index: number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }));
  };
  const updateLine = (
    index: number,
    patch: Partial<{ itemId: string; qty: number }>,
  ) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }));
  };

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
      header={
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
            {!isNew && <StatusBadge status={doc!.status} />}
          </div>
          <div className="doc-header__actions">
            {isEditable && (
              <button
                type="button"
                className="doc-header__btn"
                onClick={handleSave}
              >
                Save
              </button>
            )}
            {!isNew && isDraft && (
              <button
                type="button"
                className="doc-header__btn"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            )}
            {!isNew && isConfirmed && (
              <button
                type="button"
                className="doc-header__btn"
                onClick={handleCreateReceipt}
              >
                Create Receipt
              </button>
            )}
            {!isNew && (isDraft || isConfirmed) && (
              <button
                type="button"
                className="doc-header__btn doc-header__btn--secondary"
                onClick={handleCancelDocument}
              >
                Cancel document
              </button>
            )}
            {isEditable && (
              <button
                type="button"
                className="doc-header__btn doc-header__btn--secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      }
      summary={
        saveError ? (
          <div className="doc-form__error" role="alert">
            {saveError}
          </div>
        ) : null
      }
    >
      {isEditable ? (
        <>
          <div className="doc-summary doc-summary--form">
            <div className="doc-summary__row">
              <label className="doc-summary__term" htmlFor="po-number">
                Number
              </label>
              <span className="doc-summary__value" id="po-number">
                {displayNumber}
              </span>
            </div>
            <div className="doc-summary__row">
              <label className="doc-summary__term" htmlFor="po-date">
                Date *
              </label>
              <input
                id="po-date"
                type="date"
                className="doc-form__input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="doc-summary__row">
              <label className="doc-summary__term" htmlFor="po-supplier">
                Supplier *
              </label>
              <select
                id="po-supplier"
                className="doc-form__select"
                value={form.supplierId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplierId: e.target.value }))
                }
              >
                <option value="">Select supplier</option>
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="doc-summary__row">
              <label className="doc-summary__term" htmlFor="po-warehouse">
                Warehouse *
              </label>
              <select
                id="po-warehouse"
                className="doc-form__select"
                value={form.warehouseId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, warehouseId: e.target.value }))
                }
              >
                <option value="">Select warehouse</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            {!isNew && (
              <div className="doc-summary__row">
                <dt className="doc-summary__term">Status</dt>
                <dd className="doc-summary__value">
                  <StatusBadge status={doc!.status} />
                </dd>
              </div>
            )}
            <div className="doc-summary__row">
              <label className="doc-summary__term" htmlFor="po-comment">
                Comment
              </label>
              <input
                id="po-comment"
                type="text"
                className="doc-form__input"
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="doc-lines">
            <div className="doc-lines__head">
              <h3 className="doc-lines__title">Lines</h3>
              <button
                type="button"
                className="doc-header__btn doc-header__btn--secondary"
                onClick={addLine}
              >
                Add line
              </button>
            </div>
            <table className="list-table">
              <thead>
                <tr>
                  <th className="list-table__cell list-table__cell--item">
                    Item *
                  </th>
                  <th className="list-table__cell list-table__cell--qty">
                    Qty *
                  </th>
                  <th className="list-table__cell list-table__cell--uom">
                    UOM
                  </th>
                  <th className="list-table__cell list-table__cell--checkbox" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => {
                  const item = itemRepository.getById(line.itemId);
                  return (
                    <tr key={index} className="list-table__row">
                      <td className="list-table__cell list-table__cell--item">
                        <select
                          className="doc-form__select doc-form__select--cell"
                          value={line.itemId}
                          onChange={(e) =>
                            updateLine(index, { itemId: e.target.value })
                          }
                        >
                          <option value="">Select item</option>
                          {activeItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="list-table__cell list-table__cell--qty">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="doc-form__input doc-form__input--qty"
                          value={line.qty || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === "" ? 0 : parseInt(v, 10);
                            updateLine(index, { qty: isNaN(n) ? 0 : n });
                          }}
                        />
                      </td>
                      <td className="list-table__cell list-table__cell--uom">
                        {item?.uom ?? "—"}
                      </td>
                      <td className="list-table__cell list-table__cell--checkbox">
                        <button
                          type="button"
                          className="doc-header__btn doc-header__btn--secondary"
                          disabled={form.lines.length <= 1}
                          onClick={() => removeLine(index)}
                          aria-label="Remove line"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <dl className="doc-summary">
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
            <div className="doc-summary__row">
              <dt className="doc-summary__term">Status</dt>
              <dd className="doc-summary__value">
                <StatusBadge status={doc!.status} />
              </dd>
            </div>
            {doc!.comment != null && doc!.comment !== "" && (
              <div className="doc-summary__row">
                <dt className="doc-summary__term">Comment</dt>
                <dd className="doc-summary__value">{doc!.comment}</dd>
              </div>
            )}
          </dl>
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
                    <th className="list-table__cell list-table__cell--qty">
                      Qty
                    </th>
                    <th className="list-table__cell list-table__cell--uom">
                      UOM
                    </th>
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
        </>
      )}
    </DocumentPageLayout>
  );
}
