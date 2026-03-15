import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ItemOption = { id: string; code: string; name: string };

type ItemSelectCellEditorProps = {
  value: string;
  items: ItemOption[];
};

export const ItemSelectCellEditor = forwardRef<
  { getValue: () => string },
  ItemSelectCellEditorProps
>(function ItemSelectCellEditor({ value, items }, ref) {
  const [selected, setSelected] = useState(value);
  const selectRef = useRef<HTMLSelectElement>(null);
  const valueRef = useRef(value);

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
  };

  return (
    <select
      ref={selectRef}
      className="doc-form__select doc-form__select--cell"
      style={{ width: "100%", height: "100%", minHeight: 32 }}
      value={selected}
      onChange={handleChange}
    >
      <option value="">Select item</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name} ({i.code})
        </option>
      ))}
    </select>
  );
});
