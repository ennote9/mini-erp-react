import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import type {
  LabelBarcodeElement,
  LabelElement,
  LabelImageElement,
  LabelQrElement,
  LabelShapeElement,
  LabelTextElement,
} from "../../model";
import { LabelBindingEditor } from "./LabelBindingEditor";

type Props = {
  element: LabelElement | null;
  onChange: (next: LabelElement) => void;
  disabled?: boolean;
};

function numOr(v: string, fallback: number): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function LabelElementPropertiesPanel({ element, onChange, disabled }: Props) {
  const { t } = useTranslation();

  if (!element) {
    return (
      <p className="text-sm text-muted-foreground">{t("labels.editor.properties.noSelection")}</p>
    );
  }

  const geo = (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("labels.editor.properties.geometry")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">x (mm)</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8"
            disabled={disabled}
            value={element.xMm}
            onChange={(e) => onChange({ ...element, xMm: numOr(e.target.value, element.xMm) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">y (mm)</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8"
            disabled={disabled}
            value={element.yMm}
            onChange={(e) => onChange({ ...element, yMm: numOr(e.target.value, element.yMm) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.widthMm")}</Label>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            className="h-8"
            disabled={disabled}
            value={element.widthMm}
            onChange={(e) => onChange({ ...element, widthMm: numOr(e.target.value, element.widthMm) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.heightMm")}</Label>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            className="h-8"
            disabled={disabled}
            value={element.heightMm}
            onChange={(e) => onChange({ ...element, heightMm: numOr(e.target.value, element.heightMm) })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.rotation")}</Label>
          <Input
            type="number"
            step="1"
            className="h-8"
            disabled={disabled}
            value={element.rotation ?? 0}
            onChange={(e) =>
              onChange({ ...element, rotation: numOr(e.target.value, element.rotation ?? 0) })
            }
          />
        </div>
      </div>
    </div>
  );

  if (element.type === "text") {
    const el = element as LabelTextElement;
    return (
      <div className="space-y-3">
        {geo}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.textContent")}</Label>
          <Input
            className="h-8"
            disabled={disabled}
            value={el.text ?? ""}
            onChange={(e) => onChange({ ...el, text: e.target.value })}
          />
        </div>
        <LabelBindingEditor
          optional
          disabled={disabled}
          value={el.binding}
          onChange={(b) => onChange({ ...el, binding: b })}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.fontSizeMm")}</Label>
            <Input
              type="number"
              step="0.1"
              min={0.5}
              className="h-8"
              disabled={disabled}
              value={el.style?.fontSizeMm ?? 2.5}
              onChange={(e) =>
                onChange({
                  ...el,
                  style: { ...el.style, fontSizeMm: numOr(e.target.value, el.style?.fontSizeMm ?? 2.5) },
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.fontWeight")}</Label>
            <SelectField
              value={el.style?.fontWeight ?? "normal"}
              onChange={(v) =>
                onChange({
                  ...el,
                  style: { ...el.style, fontWeight: v as "normal" | "bold" },
                })
              }
              options={[
                { value: "normal", label: t("labels.editor.properties.fontWeightNormal") },
                { value: "bold", label: t("labels.editor.properties.fontWeightBold") },
              ]}
              placeholder=""
              disabled={disabled}
              className="w-full max-w-full"
              aria-label={t("labels.editor.properties.fontWeight")}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.align")}</Label>
          <SelectField
            value={el.style?.textAlign ?? "left"}
            onChange={(v) =>
              onChange({
                ...el,
                style: { ...el.style, textAlign: v as "left" | "center" | "right" },
              })
            }
            options={[
              { value: "left", label: t("labels.editor.properties.alignLeft") },
              { value: "center", label: t("labels.editor.properties.alignCenter") },
              { value: "right", label: t("labels.editor.properties.alignRight") },
            ]}
            placeholder=""
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.properties.align")}
          />
        </div>
      </div>
    );
  }

  if (element.type === "barcode") {
    const el = element as LabelBarcodeElement;
    return (
      <div className="space-y-3">
        {geo}
        <LabelBindingEditor
          value={el.binding}
          onChange={(b) => {
            if (b) onChange({ ...el, binding: b });
          }}
          disabled={disabled}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.symbologyHint")}</Label>
          <Input
            className="h-8"
            disabled={disabled}
            value={el.options?.symbologyHint ?? ""}
            placeholder="CODE_128"
            onChange={(e) =>
              onChange({
                ...el,
                options: { ...el.options, symbologyHint: e.target.value.trim() || undefined },
              })
            }
            aria-label={t("labels.editor.properties.symbologyHint")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={el.options?.showHumanReadableText === true}
            onCheckedChange={(c) =>
              onChange({
                ...el,
                options: { ...el.options, showHumanReadableText: c === true },
              })
            }
            disabled={disabled}
          />
          <span>{t("labels.editor.properties.showHumanReadable")}</span>
        </label>
      </div>
    );
  }

  if (element.type === "qr") {
    const el = element as LabelQrElement;
    return (
      <div className="space-y-3">
        {geo}
        <LabelBindingEditor
          value={el.binding}
          onChange={(b) => {
            if (b) onChange({ ...el, binding: b });
          }}
          disabled={disabled}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.qrErrorCorrection")}</Label>
          <SelectField
            value={el.options?.errorCorrection ?? "M"}
            onChange={(v) =>
              onChange({
                ...el,
                options: { ...el.options, errorCorrection: v as "L" | "M" | "Q" | "H" },
              })
            }
            options={[
              { value: "L", label: "L" },
              { value: "M", label: "M" },
              { value: "Q", label: "Q" },
              { value: "H", label: "H" },
            ]}
            placeholder=""
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.properties.qrErrorCorrection")}
          />
        </div>
      </div>
    );
  }

  if (element.type === "image") {
    const el = element as LabelImageElement;
    return (
      <div className="space-y-3">
        {geo}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.imageSrc")}</Label>
          <Input
            className="h-8"
            disabled={disabled}
            value={el.src ?? ""}
            onChange={(e) => onChange({ ...el, src: e.target.value })}
          />
        </div>
        <LabelBindingEditor
          optional
          disabled={disabled}
          value={el.binding}
          onChange={(b) => onChange({ ...el, binding: b })}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.imageFit")}</Label>
          <SelectField
            value={el.fit ?? "contain"}
            onChange={(v) =>
              onChange({
                ...el,
                fit: v as LabelImageElement["fit"],
              })
            }
            options={[
              { value: "contain", label: "contain" },
              { value: "cover", label: "cover" },
              { value: "fill", label: "fill" },
            ]}
            placeholder=""
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.properties.imageFit")}
          />
        </div>
      </div>
    );
  }

  if (element.type === "shape") {
    const el = element as LabelShapeElement;
    return (
      <div className="space-y-3">
        {geo}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.shapeKind")}</Label>
          <SelectField
            value={el.shapeKind}
            onChange={(v) =>
              onChange({
                ...el,
                shapeKind: v as LabelShapeElement["shapeKind"],
              })
            }
            options={[
              { value: "rect", label: "rect" },
              { value: "line", label: "line" },
              { value: "ellipse", label: "ellipse" },
            ]}
            placeholder=""
            disabled={disabled}
            className="w-full max-w-full"
            aria-label={t("labels.editor.properties.shapeKind")}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.strokeMm")}</Label>
            <Input
              type="number"
              step="0.05"
              min={0}
              className="h-8"
              disabled={disabled}
              value={el.style?.strokeMm ?? 0.2}
              onChange={(e) =>
                onChange({
                  ...el,
                  style: { ...el.style, strokeMm: numOr(e.target.value, el.style?.strokeMm ?? 0.2) },
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.strokeColor")}</Label>
            <Input
              className="h-8"
              disabled={disabled}
              value={el.style?.stroke ?? "#333333"}
              onChange={(e) => onChange({ ...el, style: { ...el.style, stroke: e.target.value } })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("labels.editor.properties.fillColor")}</Label>
          <Input
            className="h-8"
            disabled={disabled}
            value={el.style?.fill ?? ""}
            placeholder="—"
            onChange={(e) => onChange({ ...el, style: { ...el.style, fill: e.target.value || undefined } })}
          />
        </div>
      </div>
    );
  }

  return null;
}
