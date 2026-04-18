import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import type { LabelElement } from "../../model";
import type { NewLabelElementType } from "../../lib/createDefaultLabelElement";

type Props = {
  elements: LabelElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddTypeChange: (type: NewLabelElementType) => void;
  addType: NewLabelElementType;
  onAdd: () => void;
  disabled?: boolean;
};

function elementSummary(el: LabelElement): string {
  switch (el.type) {
    case "text":
      if (el.binding?.kind === "field") return el.binding.path;
      if (el.binding) return el.binding.kind;
      return (el.text ?? "").slice(0, 40);
    case "barcode":
      return el.binding.kind;
    case "qr":
      return el.binding.kind;
    case "image":
      return el.src?.trim() ? el.src.trim().slice(0, 40) : "—";
    case "shape":
      return el.shapeKind;
    default:
      return "";
  }
}

export function LabelTemplateElementsList({
  elements,
  selectedId,
  onSelect,
  onRemove,
  onAddTypeChange,
  addType,
  onAdd,
  disabled,
}: Props) {
  const { t } = useTranslation();

  const typeOptions: { value: NewLabelElementType; label: string }[] = [
    { value: "text", label: t("labels.editor.elementTypes.text") },
    { value: "barcode", label: t("labels.editor.elementTypes.barcode") },
    { value: "qr", label: t("labels.editor.elementTypes.qr") },
    { value: "image", label: t("labels.editor.elementTypes.image") },
    { value: "shape", label: t("labels.editor.elementTypes.shape") },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.editor.elements.addTitle")}
          </p>
          <SelectField
            value={addType}
            onChange={(v) => onAddTypeChange(v as NewLabelElementType)}
            options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder=""
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.elements.addTypeAria")}
          />
        </div>
        <Button type="button" size="sm" onClick={onAdd} disabled={disabled}>
          {t("labels.editor.elements.addButton")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/70">
        {elements.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t("labels.editor.elements.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {elements.map((el, index) => {
              const active = el.id === selectedId;
              return (
                <li
                  key={el.id}
                  className={`flex items-start gap-2 px-2 py-2 text-sm ${active ? "bg-muted/40" : ""}`}
                >
                  <div className="w-6 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{t(`labels.editor.elementTypes.${el.type}`)}</div>
                    <div className="truncate text-xs text-muted-foreground" title={elementSummary(el)}>
                      {elementSummary(el)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => onSelect(el.id)}
                      disabled={disabled}
                    >
                      {t("labels.editor.elements.select")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => onRemove(el.id)}
                      disabled={disabled}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
