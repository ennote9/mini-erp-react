import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { supplierRepository } from "../repository";
import { saveSupplier } from "../service";
import { Breadcrumb } from "../../../shared/ui/object/Breadcrumb";
import { BackButton } from "../../../shared/ui/list/BackButton";

type FormState = {
  code: string;
  name: string;
  isActive: boolean;
  phone: string;
  email: string;
  comment: string;
};

function defaultForm(): FormState {
  return {
    code: "",
    name: "",
    isActive: true,
    phone: "",
    email: "",
    comment: "",
  };
}

export function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const supplier = useMemo(
    () => (id && !isNew ? supplierRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (supplier) {
      setForm({
        code: supplier.code,
        name: supplier.name,
        isActive: supplier.isActive,
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        comment: supplier.comment ?? "",
      });
      setSaveError(null);
    }
  }, [id, isNew, supplier?.id, supplier?.code, supplier?.name, supplier?.isActive, supplier?.phone, supplier?.email, supplier?.comment, refresh]);

  const handleSave = () => {
    setSaveError(null);
    const result = saveSupplier(
      {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
        phone: form.phone || undefined,
        email: form.email || undefined,
        comment: form.comment || undefined,
      },
      isNew ? undefined : id ?? undefined,
    );
    if (result.success) {
      if (isNew) navigate(`/suppliers/${result.id}`);
      else setRefresh((r) => r + 1);
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/suppliers");
  };

  const handleDeactivate = () => {
    if (!id || isNew || !supplier) return;
    supplierRepository.update(id, { isActive: false });
    setRefresh((r) => r + 1);
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Supplier not found.</p>
      </div>
    );
  }

  if (!isNew && !supplier) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Supplier not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/suppliers" },
    { label: "Suppliers", to: "/suppliers" },
    { label: isNew ? "New" : supplier!.code },
  ];

  const displayTitle = isNew ? "New Supplier" : `Supplier ${supplier!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/suppliers" aria-label="Back to Suppliers" />
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
            {!isNew && supplier?.isActive && (
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
          <label className="doc-summary__term" htmlFor="supplier-code">
            Code *
          </label>
          <input
            id="supplier-code"
            type="text"
            className="doc-form__input"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="e.g. SUP-0001"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="supplier-name">
            Name *
          </label>
          <input
            id="supplier-name"
            type="text"
            className="doc-form__input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Supplier name"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="supplier-active">
            Active
          </label>
          <label className="doc-summary__value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="supplier-active"
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
          <label className="doc-summary__term" htmlFor="supplier-phone">
            Phone
          </label>
          <input
            id="supplier-phone"
            type="text"
            className="doc-form__input"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="supplier-email">
            Email
          </label>
          <input
            id="supplier-email"
            type="text"
            className="doc-form__input"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="supplier-comment">
            Comment
          </label>
          <input
            id="supplier-comment"
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
