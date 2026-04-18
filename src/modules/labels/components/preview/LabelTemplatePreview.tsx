import type { CSSProperties } from "react";
import { useTranslation } from "@/shared/i18n";
import type {
  LabelElement,
  LabelTemplate,
  LabelTextElement,
} from "../../model";
import type { LabelPreviewBindingContext } from "../../lib/previewContext";
import { resolveLabelBindingValue } from "../../lib/previewContext";
import { LABEL_PREVIEW_PX_PER_MM } from "./previewConstants";
import { BarcodePreview } from "./BarcodePreview";
import { QrPreview } from "./QrPreview";

type Props = {
  template: LabelTemplate;
  context: LabelPreviewBindingContext;
  /** When false, hide the demo-data caption (e.g. real item context uses workspace banner instead). */
  showDemoHint?: boolean;
};

function resolveTextContent(el: LabelTextElement, ctx: LabelPreviewBindingContext): string {
  if (el.binding) {
    const v = resolveLabelBindingValue(el.binding, ctx);
    if (v !== null) return v;
  }
  return el.text ?? "";
}

function renderElement(el: LabelElement, ctx: LabelPreviewBindingContext, key: string) {
  const left = el.xMm * LABEL_PREVIEW_PX_PER_MM;
  const top = el.yMm * LABEL_PREVIEW_PX_PER_MM;
  const w = el.widthMm * LABEL_PREVIEW_PX_PER_MM;
  const h = el.heightMm * LABEL_PREVIEW_PX_PER_MM;
  const rot = el.rotation ?? 0;
  const baseStyle: CSSProperties = {
    position: "absolute",
    left,
    top,
    width: w,
    height: h,
    transform: rot !== 0 ? `rotate(${rot}deg)` : undefined,
    transformOrigin: "top left",
  };

  if (el.type === "text") {
    const fs = (el.style?.fontSizeMm ?? 2.5) * LABEL_PREVIEW_PX_PER_MM * 0.92;
    const fw = el.style?.fontWeight === "bold" ? 600 : 400;
    const ta = el.style?.textAlign ?? "left";
    const content = resolveTextContent(el, ctx);
    return (
      <div
        key={key}
        style={{
          ...baseStyle,
          fontSize: Math.max(8, fs),
          fontWeight: fw,
          textAlign: ta,
          lineHeight: 1.15,
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {content || "—"}
      </div>
    );
  }

  if (el.type === "barcode") {
    const raw = resolveLabelBindingValue(el.binding, ctx);
    return (
      <div key={key} style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BarcodePreview element={el} dataText={raw} />
      </div>
    );
  }

  if (el.type === "qr") {
    const raw = resolveLabelBindingValue(el.binding, ctx);
    return (
      <div key={key} style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <QrPreview element={el} dataText={raw} />
      </div>
    );
  }

  if (el.type === "image") {
    return (
      <div
        key={key}
        style={{
          ...baseStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "rgba(0,0,0,0.45)",
          border: "1px dashed rgba(0,0,0,0.2)",
        }}
      >
        Image
      </div>
    );
  }

  if (el.type === "shape") {
    const stroke = el.style?.stroke ?? "rgba(0,0,0,0.35)";
    const sw = el.style?.strokeMm ? el.style.strokeMm * LABEL_PREVIEW_PX_PER_MM : 1;
    if (el.shapeKind === "rect") {
      return (
        <div
          key={key}
          style={{
            ...baseStyle,
            border: `${Math.max(0.5, sw)}px solid ${stroke}`,
            borderRadius: 1,
            boxSizing: "border-box",
          }}
        />
      );
    }
    if (el.shapeKind === "ellipse") {
      return (
        <div
          key={key}
          style={{
            ...baseStyle,
            border: `${Math.max(0.5, sw)}px dashed ${stroke}`,
            borderRadius: 9999,
            boxSizing: "border-box",
          }}
        />
      );
    }
    return (
      <div
        key={key}
        style={{
          ...baseStyle,
          borderBottom: `${Math.max(0.5, sw)}px solid ${stroke}`,
        }}
      />
    );
  }

  const _never: never = el;
  return _never;
}

export function LabelTemplatePreview({ template, context, showDemoHint = true }: Props) {
  const { t } = useTranslation();
  const w = template.sizeMm.width * LABEL_PREVIEW_PX_PER_MM;
  const h = template.sizeMm.height * LABEL_PREVIEW_PX_PER_MM;

  return (
    <div className="flex flex-col gap-2">
      {showDemoHint ? (
        <p className="text-[11px] text-muted-foreground">{t("labels.workspace.preview.demoHint")}</p>
      ) : null}
      <div
        className="relative overflow-hidden rounded border border-border bg-white text-black shadow-sm"
        style={{ width: w, height: h, maxWidth: "100%" }}
      >
        {template.elements.map((el) => renderElement(el, context, el.id))}
      </div>
    </div>
  );
}
