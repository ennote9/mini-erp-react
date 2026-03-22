import { useEffect, useState } from "react";
import type { ItemImage } from "../model";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, Star, Trash2, Upload } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";

type LoadState = "idle" | "loading" | "ready" | "error";

type Props = {
  loadState: LoadState;
  previewUrl: string | null;
  absolutePath: string | null;
  image: ItemImage;
  onReplace: () => void;
  onRemove: () => void;
  onOpenFullSize: () => void;
  onSetPrimary?: () => void;
  /** When false, Primary is disabled (e.g. no explicit selection). */
  canSetPrimary?: boolean;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
  canSelectPrevious: boolean;
  canSelectNext: boolean;
  busy?: boolean;
};

function formatBytes(
  n: number,
  t: (path: string, params?: Record<string, string | number | undefined>) => string,
): string {
  if (n < 1024) return t("master.item.images.bytesB", { n });
  if (n < 1024 * 1024) return t("master.item.images.bytesKb", { n: Number((n / 1024).toFixed(1)) });
  return t("master.item.images.bytesMb", { n: Number((n / (1024 * 1024)).toFixed(1)) });
}

export function ItemImagePreview({
  loadState,
  previewUrl,
  absolutePath,
  image,
  onReplace,
  onRemove,
  onOpenFullSize,
  onSetPrimary,
  canSetPrimary = true,
  onSelectPrevious,
  onSelectNext,
  canSelectPrevious,
  canSelectNext,
  busy,
}: Props) {
  const { t } = useTranslation();
  const [imgDecodeFailed, setImgDecodeFailed] = useState(false);

  useEffect(() => {
    setImgDecodeFailed(false);
  }, [previewUrl]);

  const dim =
    image.width != null && image.height != null ? `${image.width} × ${image.height}` : null;

  const showDevDecodeHint = import.meta.env.DEV && imgDecodeFailed && previewUrl && absolutePath;

  const primaryDisabled =
    busy || image.isPrimary || !onSetPrimary || !canSetPrimary;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md border border-input bg-background aspect-[4/3] max-h-[220px] flex items-center justify-center">
        {image.isPrimary && (
          <span className="absolute left-1.5 top-1.5 z-[1] rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            {t("master.item.images.badgePrimary")}
          </span>
        )}
        {(loadState === "loading" || loadState === "idle") && (
          <p className="text-xs text-muted-foreground px-2 text-center">{t("master.item.images.loadingPreview")}</p>
        )}
        {loadState === "error" && (
          <p className="text-xs text-destructive px-2 text-center">{t("master.item.images.previewUnavailable")}</p>
        )}
        {loadState === "ready" && previewUrl && (
          <img
            src={previewUrl}
            alt={image.fileName}
            className="max-h-full max-w-full object-contain"
            onError={() => setImgDecodeFailed(true)}
          />
        )}
        {loadState === "ready" && !previewUrl && (
          <p className="text-xs text-muted-foreground px-2 text-center">{t("master.item.images.noPreviewUrl")}</p>
        )}
      </div>
      {showDevDecodeHint && (
        <div className="rounded border border-dashed border-input bg-muted/30 px-2 py-1.5 text-[10px] leading-snug font-mono text-muted-foreground break-all space-y-1">
          <p>
            <span className="text-foreground/80">[dev] img error — file:</span> {absolutePath}
          </p>
          <p>
            <span className="text-foreground/80">[dev] asset URL:</span> {previewUrl}
          </p>
        </div>
      )}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p className="truncate font-medium text-foreground" title={image.fileName}>
          {image.fileName}
        </p>
        <p>
          {formatBytes(image.sizeBytes, t)}
          {dim ? ` · ${dim}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onReplace}
          disabled={busy}
          title={t("master.item.images.replaceTitle")}
          aria-label={t("master.item.images.replaceTitle")}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("master.item.images.replace")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onOpenFullSize}
          disabled={busy}
          title={t("master.item.images.openFullSizeTitle")}
          aria-label={t("master.item.images.openFullSizeTitle")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("master.item.images.openFullSize")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={busy}
          title={t("master.item.images.removeTitle")}
          aria-label={t("master.item.images.removeTitle")}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("master.item.images.remove")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={() => onSetPrimary?.()}
          disabled={primaryDisabled}
          title={
            !canSetPrimary
              ? t("master.item.images.setPrimaryTitleDisabledNoSelection")
              : image.isPrimary
                ? t("master.item.images.setPrimaryTitleAlready")
                : t("master.item.images.setPrimaryTitle")
          }
          aria-label={
            image.isPrimary
              ? t("master.item.images.setPrimaryAriaAlready")
              : t("master.item.images.setPrimaryTitle")
          }
        >
          <Star className="h-3.5 w-3.5" />
          {t("master.item.images.setPrimary")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onSelectPrevious}
          disabled={busy || !canSelectPrevious}
          title={t("master.item.images.previousImage")}
          aria-label={t("master.item.images.previousImage")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onSelectNext}
          disabled={busy || !canSelectNext}
          title={t("master.item.images.nextImage")}
          aria-label={t("master.item.images.nextImage")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
