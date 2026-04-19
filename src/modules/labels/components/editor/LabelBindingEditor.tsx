import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import {
  ITEM_BARCODE_PACKAGING_LEVELS,
  ITEM_BARCODE_ROLES,
} from "@/modules/items/lib/itemBarcodes";
import type { LabelBinding } from "../../model";

type Props = {
  value: LabelBinding | undefined;
  onChange: (next: LabelBinding | undefined) => void;
  /** When true, allows clearing the binding (text / image). Barcode/QR always require a binding. */
  optional?: boolean;
  disabled?: boolean;
};

function defaultBindingForKind(kind: LabelBinding["kind"]): LabelBinding {
  switch (kind) {
    case "field":
      return { kind: "field", path: "item.name" };
    case "selected_barcode":
      return { kind: "selected_barcode" };
    case "primary_barcode":
      return { kind: "primary_barcode" };
    case "barcode_by_packaging":
      return { kind: "barcode_by_packaging", packagingLevel: "UNIT" };
    case "barcode_by_role":
      return { kind: "barcode_by_role", role: "SELLABLE" };
    case "selected_marking_payload":
      return { kind: "selected_marking_payload" };
    case "selected_marking_human_label":
      return { kind: "selected_marking_human_label" };
    default: {
      const _n: never = kind;
      return _n;
    }
  }
}

export function LabelBindingEditor({ value, onChange, optional = false, disabled }: Props) {
  const { t } = useTranslation();

  const kindOptions = [
    ...(optional ? [{ value: "__none__", label: t("labels.editor.binding.kindNone") }] : []),
    { value: "field", label: t("labels.editor.binding.kind.field") },
    { value: "selected_barcode", label: t("labels.editor.binding.kind.selected_barcode") },
    { value: "primary_barcode", label: t("labels.editor.binding.kind.primary_barcode") },
    { value: "barcode_by_packaging", label: t("labels.editor.binding.kind.barcode_by_packaging") },
    { value: "barcode_by_role", label: t("labels.editor.binding.kind.barcode_by_role") },
    { value: "selected_marking_payload", label: t("labels.editor.binding.kind.selected_marking_payload") },
    { value: "selected_marking_human_label", label: t("labels.editor.binding.kind.selected_marking_human_label") },
  ];

  const selectKindValue =
    optional && !value ? "__none__" : value ? value.kind : "field";

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("labels.editor.binding.kindLabel")}</Label>
        <SelectField
          value={selectKindValue}
          onChange={(v) => {
            if (v === "__none__") {
              onChange(undefined);
              return;
            }
            onChange(defaultBindingForKind(v as LabelBinding["kind"]));
          }}
          options={kindOptions}
          placeholder={t("labels.editor.binding.kindLabel")}
          disabled={disabled}
          className="w-full max-w-full"
          aria-label={t("labels.editor.binding.kindLabel")}
        />
      </div>

      {!value ? null : value.kind === "field" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.binding.fieldPath")}</Label>
          <Input
            value={value.path}
            onChange={(e) => onChange({ kind: "field", path: e.target.value })}
            disabled={disabled}
            className="h-8"
          />
        </div>
      ) : null}

      {!value ? null : value.kind === "barcode_by_packaging" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.binding.packagingLevel")}</Label>
          <SelectField
            value={value.packagingLevel}
            onChange={(v) => onChange({ kind: "barcode_by_packaging", packagingLevel: v })}
            options={ITEM_BARCODE_PACKAGING_LEVELS.map((lvl) => ({
              value: lvl,
              label: lvl,
            }))}
            placeholder={t("labels.editor.binding.packagingLevel")}
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.binding.packagingLevel")}
          />
        </div>
      ) : null}

      {!value ? null : value.kind === "barcode_by_role" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.binding.barcodeRole")}</Label>
          <SelectField
            value={value.role}
            onChange={(v) => onChange({ kind: "barcode_by_role", role: v })}
            options={ITEM_BARCODE_ROLES.map((role) => ({
              value: role,
              label: role,
            }))}
            placeholder={t("labels.editor.binding.barcodeRole")}
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.binding.barcodeRole")}
          />
        </div>
      ) : null}
    </div>
  );
}
