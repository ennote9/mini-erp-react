import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { itemRepository } from "../repository";
import { saveItem } from "../service";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";

type FormState = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    uom: "",
    isActive: true,
    description: "",
  };
}

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const item = useMemo(
    () => (id && !isNew ? itemRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (item) {
      setForm({
        code: item.code,
        name: item.name,
        uom: item.uom,
        isActive: item.isActive,
        description: item.description ?? "",
      });
      setSaveError(null);
    }
  }, [id, isNew, item?.id, item?.code, item?.name, item?.uom, item?.isActive, item?.description, refresh]);

  const handleSave = () => {
    setSaveError(null);
    const result = saveItem(
      {
        code: form.code,
        name: form.name,
        uom: form.uom,
        isActive: form.isActive,
        description: form.description || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      if (isNew) navigate(`/items/${result.id}`);
      else setRefresh((r) => r + 1);
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/items");
  };

  const handleDeactivate = () => {
    if (!id || isNew || !item) return;
    itemRepository.update(id, { isActive: false });
    setRefresh((r) => r + 1);
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
            {!isNew && item?.isActive && (
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
          <label className="doc-summary__term" htmlFor="item-code">
            Code *
          </label>
          <input
            id="item-code"
            type="text"
            className="doc-form__input"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="e.g. ITEM-001"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="item-name">
            Name *
          </label>
          <input
            id="item-name"
            type="text"
            className="doc-form__input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Item name"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="item-uom">
            UOM *
          </label>
          <input
            id="item-uom"
            type="text"
            className="doc-form__input doc-form__input--qty"
            value={form.uom}
            onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
            placeholder="e.g. EA"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="item-active">
            Active
          </label>
          <label className="doc-summary__value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="item-active"
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
          <label className="doc-summary__term" htmlFor="item-description">
            Description
          </label>
          <input
            id="item-description"
            type="text"
            className="doc-form__input"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}
