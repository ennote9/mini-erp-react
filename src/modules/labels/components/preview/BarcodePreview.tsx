import { useMemo } from "react";
import { useTranslation } from "@/shared/i18n";
import { renderBarcodeFromElementOptions } from "../../lib/codeRenderer";
import type { LabelBarcodeElement } from "../../model";
import { LABEL_PREVIEW_PX_PER_MM } from "./previewConstants";
import { PreviewCodeFallback } from "./PreviewCodeFallback";
import { PreviewSvgMarkup } from "./PreviewSvgMarkup";

type Props = {
  element: LabelBarcodeElement;
  dataText: string | null;
};

export function BarcodePreview({ element, dataText }: Props) {
  const { t } = useTranslation();

  const result = useMemo(() => {
    if (dataText === null || dataText === "") {
      return "empty" as const;
    }
    const scale = Math.max(1.5, Math.min(4, LABEL_PREVIEW_PX_PER_MM * 0.45));
    return renderBarcodeFromElementOptions({
      text: dataText,
      symbologyHint: element.options?.symbologyHint,
      scale,
      showHumanReadableText: element.options?.showHumanReadableText,
    });
  }, [dataText, element.options?.showHumanReadableText, element.options?.symbologyHint]);

  const w = element.widthMm * LABEL_PREVIEW_PX_PER_MM;
  const h = element.heightMm * LABEL_PREVIEW_PX_PER_MM;

  if (result === "empty") {
    return (
      <PreviewCodeFallback
        className="h-full w-full"
        message={t("labels.workspace.preview.bindingEmpty")}
      />
    );
  }

  if (!result.ok) {
    const msg =
      result.code === "unsupported"
        ? t("labels.workspace.preview.symbologyUnsupported")
        : result.message || t("labels.workspace.preview.renderFailed");
    return <PreviewCodeFallback className="h-full w-full" message={msg} />;
  }

  return (
    <div className="h-full w-full" style={{ width: w, height: h, maxWidth: "100%", maxHeight: "100%" }}>
      <PreviewSvgMarkup svg={result.svg} title={dataText ?? undefined} />
    </div>
  );
}
