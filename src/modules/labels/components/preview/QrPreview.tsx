import { useMemo } from "react";
import { useTranslation } from "@/shared/i18n";
import { renderQrSvg } from "../../lib/codeRenderer";
import type { LabelQrElement } from "../../model";
import { LABEL_PREVIEW_PX_PER_MM } from "./previewConstants";
import { PreviewCodeFallback } from "./PreviewCodeFallback";
import { PreviewSvgMarkup } from "./PreviewSvgMarkup";

type Props = {
  element: LabelQrElement;
  dataText: string | null;
};

export function QrPreview({ element, dataText }: Props) {
  const { t } = useTranslation();

  const result = useMemo(() => {
    if (dataText === null || dataText === "") {
      return null;
    }
    const scale = Math.max(2, Math.min(6, LABEL_PREVIEW_PX_PER_MM * 0.65));
    return renderQrSvg({
      text: dataText,
      scale,
      ecLevel: element.options?.errorCorrection,
    });
  }, [dataText, element.options?.errorCorrection]);

  const w = element.widthMm * LABEL_PREVIEW_PX_PER_MM;
  const h = element.heightMm * LABEL_PREVIEW_PX_PER_MM;

  if (result === null) {
    return (
      <PreviewCodeFallback
        className="h-full w-full"
        message={t("labels.workspace.preview.bindingEmpty")}
      />
    );
  }

  if (!result.ok) {
    return (
      <PreviewCodeFallback
        className="h-full w-full"
        message={result.message || t("labels.workspace.preview.renderFailed")}
      />
    );
  }

  return (
    <div className="h-full w-full" style={{ width: w, height: h, maxWidth: "100%", maxHeight: "100%" }}>
      <PreviewSvgMarkup svg={result.svg} title={dataText ?? undefined} />
    </div>
  );
}
