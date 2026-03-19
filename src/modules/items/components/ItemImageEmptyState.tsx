import { Button } from "@/components/ui/button";

type Props =
  | { variant: "unsaved" }
  | {
      variant: "ready";
      onUploadClick: () => void;
      disabled?: boolean;
    };

/**
 * Empty placeholder inside the Images card (new item vs existing item without file).
 */
export function ItemImageEmptyState(props: Props) {
  if (props.variant === "unsaved") {
    return (
      <div className="rounded-md border border-dashed border-input bg-muted/15 px-3 py-5 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Images unavailable</p>
        <p className="mt-1.5 text-xs leading-relaxed">
          Save this item once to upload product images. Files are stored in app data on this device.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-dashed border-input bg-muted/10 px-3 py-7 text-center">
      <p className="text-sm text-muted-foreground">No images</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 h-8"
        onClick={props.onUploadClick}
        disabled={props.disabled}
      >
        Upload image
      </Button>
    </div>
  );
}
