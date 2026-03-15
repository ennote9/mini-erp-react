import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { customerRepository } from "../repository";
import { saveCustomer } from "../service";
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

export function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = id === "new";
  const customer = useMemo(
    () => (id && !isNew ? customerRepository.getById(id) : undefined),
    [id, isNew, refresh],
  );

  const [form, setForm] = useState<FormState>(defaultForm);

  useEffect(() => {
    if (isNew) {
      setForm(defaultForm());
      setSaveError(null);
      return;
    }
    if (customer) {
      setForm({
        code: customer.code,
        name: customer.name,
        isActive: customer.isActive,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        comment: customer.comment ?? "",
      });
      setSaveError(null);
    }
  }, [id, isNew, customer?.id, customer?.code, customer?.name, customer?.isActive, customer?.phone, customer?.email, customer?.comment, refresh]);

  const handleSave = () => {
    setSaveError(null);
    const result = saveCustomer(
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
      if (isNew) navigate(`/customers/${result.id}`);
      else setRefresh((r) => r + 1);
    } else {
      setSaveError(result.error);
    }
  };

  const handleCancel = () => {
    navigate("/customers");
  };

  const handleDeactivate = () => {
    if (!id || isNew || !customer) return;
    customerRepository.update(id, { isActive: false });
    setRefresh((r) => r + 1);
  };

  if (!id) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Customer not found.</p>
      </div>
    );
  }

  if (!isNew && !customer) {
    return (
      <div className="doc-page doc-page--not-found">
        <p>Customer not found.</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Master Data", to: "/customers" },
    { label: "Customers", to: "/customers" },
    { label: isNew ? "New" : customer!.code },
  ];

  const displayTitle = isNew ? "New Customer" : `Customer ${customer!.code}`;

  return (
    <div className="doc-page">
      <div className="doc-page__breadcrumb">
        <BackButton to="/customers" aria-label="Back to Customers" />
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
            {!isNew && customer?.isActive && (
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
          <label className="doc-summary__term" htmlFor="customer-code">
            Code *
          </label>
          <input
            id="customer-code"
            type="text"
            className="doc-form__input"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="e.g. CUS-0001"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="customer-name">
            Name *
          </label>
          <input
            id="customer-name"
            type="text"
            className="doc-form__input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Customer name"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="customer-active">
            Active
          </label>
          <label className="doc-summary__value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="customer-active"
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
          <label className="doc-summary__term" htmlFor="customer-phone">
            Phone
          </label>
          <input
            id="customer-phone"
            type="text"
            className="doc-form__input"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="customer-email">
            Email
          </label>
          <input
            id="customer-email"
            type="text"
            className="doc-form__input"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="doc-summary__row">
          <label className="doc-summary__term" htmlFor="customer-comment">
            Comment
          </label>
          <input
            id="customer-comment"
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
