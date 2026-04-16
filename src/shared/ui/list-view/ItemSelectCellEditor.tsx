import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "@/shared/i18n/context";

export type ItemOption = { id: string; code: string; name: string };

type ItemSelectCellEditorProps = {
  value?: string;
  initialValue?: string | null;
  itemId?: string;
  items: ItemOption[];
  onValueChange?: (value: string | null) => void;
  /** Row data - used to get _lineId for immediate form sync */
  data?: { _lineId?: number };
  /** Called when user selects an item so the parent can update state before editing stops */
  onItemSelected?: (lineId: number, itemId: string) => void;
};

function getInitialValue(props: ItemSelectCellEditorProps): string {
  return props.value ?? props.initialValue ?? props.itemId ?? "";
}

export const ItemSelectCellEditor = forwardRef<
  { getValue: () => string },
  ItemSelectCellEditorProps
>(function ItemSelectCellEditor(props, ref) {
  const { t } = useTranslation();
  const { items, onValueChange } = props;
  const initial = getInitialValue(props);
  const [selected, setSelected] = useState(initial);
  const selectRef = useRef<HTMLSelectElement>(null);
  const valueRef = useRef(initial);

  valueRef.current = selected;

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current;
    },
  }));

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    valueRef.current = v;
    setSelected(v);
    onValueChange?.(v || null);
    const lineId = props.data?._lineId;
    if (v && typeof lineId === "number") props.onItemSelected?.(lineId, v);
  };

  const displayValue = props.value ?? props.initialValue ?? props.itemId ?? selected;

  return (
    <select
      ref={selectRef}
      className="doc-form__select doc-form__select--cell"
      style={{ width: "100%", height: "100%", minHeight: 32 }}
      value={displayValue}
      onChange={handleChange}
    >
      <option value="">{t("doc.grid.selectItem")}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.code} - {i.name}
        </option>
      ))}
    </select>
  );
});
