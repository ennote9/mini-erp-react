import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { warehouseRepository } from "../repository";
import { saveWarehouse } from "../service";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";

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

export function WarehousePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const warehouse = useMemo(
    () => (id && !isNew ? warehouseRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (warehouse) {
      setForm({
        code: warehouse.code,
        name: warehouse.name,
        isActive: warehouse.isActive,
        comment: warehouse.comment ?? "",
      });
      setSaveError(null);
    }
  }, [id, isNew, warehouse?.id, warehouse?.code, warehouse?.name, warehouse?.isActive, warehouse?.comment, refresh]);

  const handleSave = () => {
    setSaveError(null);
    const result = saveWarehouse(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        comment: form.comment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      if (isNew) navigate(`/warehouses/${result.id}`);
      else setRefresh((r) => r + 1);
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/warehouses");
  };

  const handleDeactivate = () => {
    if (!id || isNew || !warehouse) return;
    warehouseRepository.update(id, { isActive: false });
    setRefresh((r) => r + 1);
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
        <Breadcrumb items={breadcrumbItems} />
      </div>
      <div className="doc-page__header">
        <div className="doc-header">
          <div className="doc-header__title-row">
            <h2 className="doc-header__title">{displayTitle}</h2>
          </div>
          <div className="doc-header__actions">
            <button
              type="button"
              className="doc-header__btn"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="doc-header__btn doc-header__btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            {!isNew && warehouse?.isActive && (
              <button
                type="button"
                className="doc-header__btn doc-header__btn--secondary"
                onClick={handleDeactivate}
              >
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>
      {saveError && (
        <div className="doc-form__error" role="alert">
          {saveError}
        </div>
      )}
      <div className="doc-summary doc-summary--form">
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="warehouse-code">
            Code *
          </label>
          <input
            id="warehouse-code"
            type="text"
            className="doc-form__input"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="e.g. WH-001"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="warehouse-name">
            Name *
          </label>
          <input
            id="warehouse-name"
            type="text"
            className="doc-form__input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Warehouse name"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="warehouse-active">
            Active
          </label>
          <label className="doc-summary__value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="warehouse-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            {form.isActive ? "Active" : "Inactive"}
          </label>
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="warehouse-comment">
            Comment
          </label>
          <input
            id="warehouse-comment"
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
    </div>
  );
}
