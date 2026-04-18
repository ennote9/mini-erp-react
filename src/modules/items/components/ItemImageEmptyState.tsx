import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n/context";

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
  const { t } = useTranslation();
  if (props.variant === "unsaved") {
    return (
      <div className="rounded-md border border-dashed border-input bg-muted/15 px-3 py-4 text-center text-xs leading-snug text-muted-foreground">
        <p className="font-medium text-foreground">{t("master.item.images.unsavedTitle")}</p>
        <p className="mt-1 text-[11px] leading-relaxed">{t("master.item.images.unsavedBody")}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-dashed border-input bg-muted/10 px-3 py-5 text-center">
      <p className="text-xs text-muted-foreground">{t("master.item.images.emptyTitle")}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2.5 h-7 text-xs"
        onClick={props.onUploadClick}
        disabled={props.disabled}
      >
        {t("master.item.images.uploadImage")}
      </Button>
    </div>
  );
}
