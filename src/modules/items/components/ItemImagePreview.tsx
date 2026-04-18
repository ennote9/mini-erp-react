import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ItemImage } from "../model";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, MoreVertical, Upload } from "lucide-react";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";

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
  /** Add-upload control sits in the bottom row with arrows and the menu. */
  onUploadClick: () => void;
  /** When false, upload button is hidden and max-count hint is shown in the row area. */
  canAddMore: boolean;
  maxImagesCount: number;
};

function formatBytes(
  n: number,
  t: (path: string, params?: Record<string, string | number | undefined>) => string,
  formatNumber: (
    value: number | null | undefined,
    options?: { minFractionDigits?: number; maxFractionDigits?: number; empty?: string },
  ) => string,
): string {
  if (n < 1024) return t("master.item.images.bytesB", { n });
  if (n < 1024 * 1024)
    return t("master.item.images.bytesKb", { n: formatNumber(n / 1024, { maxFractionDigits: 1, empty: "0" }) });
  return t("master.item.images.bytesMb", {
    n: formatNumber(n / (1024 * 1024), { maxFractionDigits: 1, empty: "0" }),
  });
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
  onUploadClick,
  canAddMore,
  maxImagesCount,
}: Props) {
  const { t } = useTranslation();
  const { formatNumber } = useAppDisplayFormatters();
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
    <div className="flex flex-col gap-1.5">
      <div className="relative flex aspect-square w-full max-h-[320px] max-w-[320px] min-w-0 self-start items-center justify-center overflow-hidden rounded-md border border-input bg-background">
        {image.isPrimary && (
          <span className="absolute left-1.5 top-1.5 z-[1] rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            {t("master.item.images.badgePrimary")}
          </span>
        )}
        {(loadState === "loading" || loadState === "idle") && (
          <p className="px-2 text-center text-[11px] text-muted-foreground">{t("master.item.images.loadingPreview")}</p>
        )}
        {loadState === "error" && (
          <p className="px-2 text-center text-[11px] text-destructive">{t("master.item.images.previewUnavailable")}</p>
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
          <p className="px-2 text-center text-[11px] text-muted-foreground">{t("master.item.images.noPreviewUrl")}</p>
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
      <div className="space-y-0.5 text-[11px] text-muted-foreground">
        <p className="truncate font-medium text-foreground" title={image.fileName}>
          {image.fileName}
        </p>
        <p>
          {formatBytes(image.sizeBytes, t, formatNumber)}
          {dim ? ` · ${dim}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={onSelectPrevious}
          disabled={busy || !canSelectPrevious}
          title={t("master.item.images.previousImage")}
          aria-label={t("master.item.images.previousImage")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={onSelectNext}
          disabled={busy || !canSelectNext}
          title={t("master.item.images.nextImage")}
          aria-label={t("master.item.images.nextImage")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        {canAddMore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={onUploadClick}
            disabled={busy}
            title={t("master.item.images.uploadImage")}
            aria-label={t("master.item.images.uploadImage")}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t("master.item.images.uploadImageShort")}</span>
          </Button>
        ) : (
          <span className="min-w-0 shrink text-[11px] text-muted-foreground sm:max-w-[14rem]">
            {t("master.item.images.maxReached", { max: maxImagesCount })}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          onClick={() => void onOpenFullSize()}
          disabled={busy}
          title={t("master.item.images.openFullSize")}
          aria-label={t("master.item.images.openFullSize")}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t("master.item.images.openImageShort")}</span>
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 shrink-0 p-0"
              disabled={busy}
              title={`${t("common.actions")} — ${image.fileName}`}
              aria-label={`${t("common.actions")} — ${image.fileName}`}
            >
              <MoreVertical className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[120] min-w-[12rem] rounded-md border border-input bg-popover p-1 shadow-md"
            >
              <DropdownMenu.Item
                className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                disabled={primaryDisabled}
                onSelect={() => onSetPrimary?.()}
              >
                {t("master.item.images.setPrimary")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                disabled={busy}
                onSelect={() => onReplace()}
              >
                {t("master.item.images.replace")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-destructive outline-none hover:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                disabled={busy}
                onSelect={() => void onRemove()}
              >
                {t("master.item.images.remove")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
