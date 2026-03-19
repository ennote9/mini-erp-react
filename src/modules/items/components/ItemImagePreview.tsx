import { useEffect, useState } from "react";
import type { ItemImage } from "../model";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Upload } from "lucide-react";

type LoadState = "idle" | "loading" | "ready" | "error";

type Props = {
  loadState: LoadState;
  previewUrl: string | null;
  absolutePath: string | null;
  image: ItemImage;
  onReplace: () => void;
  onRemove: () => void;
  onOpenFullSize: () => void;
  busy?: boolean;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ItemImagePreview({
  loadState,
  previewUrl,
  absolutePath,
  image,
  onReplace,
  onRemove,
  onOpenFullSize,
  busy,
}: Props) {
  const [imgDecodeFailed, setImgDecodeFailed] = useState(false);

  useEffect(() => {
    setImgDecodeFailed(false);
  }, [previewUrl]);

  const dim =
    image.width != null && image.height != null ? `${image.width} × ${image.height}` : null;

  const showDevDecodeHint = import.meta.env.DEV && imgDecodeFailed && previewUrl && absolutePath;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md border border-input bg-background aspect-[4/3] max-h-[220px] flex items-center justify-center">
        {(loadState === "loading" || loadState === "idle") && (
          <p className="text-xs text-muted-foreground px-2 text-center">Loading preview…</p>
        )}
        {loadState === "error" && (
          <p className="text-xs text-destructive px-2 text-center">Preview unavailable</p>
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
          <p className="text-xs text-muted-foreground px-2 text-center">No preview URL</p>
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
          {formatBytes(image.sizeBytes)}
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
          title="Replace image"
          aria-label="Replace image"
        >
          <Upload className="h-3.5 w-3.5" />
          Replace
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onOpenFullSize}
          disabled={busy}
          title="Open full size"
          aria-label="Open full size"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full size
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={busy}
          title="Remove image"
          aria-label="Remove image"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    </div>
  );
}
