import type { ItemImage } from "../model";
import { cn } from "@/lib/utils";

type Props = {
  images: ItemImage[];
  selectedId: string | null;
  thumbUrls: Record<string, string>;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

/**
 * Compact thumbnail strip for item images (ERP-style, not a consumer gallery).
 */
export function ItemImageThumbnails({
  images,
  selectedId,
  thumbUrls,
  onSelect,
  disabled,
}: Props) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1" role="listbox" aria-label="Item images">
      {images.map((img) => {
        const selected = img.id === selectedId;
        const url = thumbUrls[img.id];
        return (
          <button
            key={img.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onSelect(img.id)}
            className={cn(
              "relative h-12 w-12 shrink-0 overflow-hidden rounded border bg-muted/30 transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              selected ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            title={img.fileName}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                …
              </span>
            )}
            {img.isPrimary && (
              <span className="absolute bottom-0 left-0 right-0 bg-background/85 py-px text-center text-[8px] font-semibold leading-none text-foreground">
                P
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
