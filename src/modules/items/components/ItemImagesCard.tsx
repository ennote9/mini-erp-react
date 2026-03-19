import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemImage } from "../model";
import { itemRepository, flushPendingItemsPersist } from "../repository";
import {
  deleteStoredImageFile,
  getItemImagePreviewSources,
  resolveAbsoluteImagePath,
  saveItemImageFromFile,
} from "../lib/itemImageStorage";
import {
  getPrimaryImage,
  normalizeItemImages,
  reorderItemImagesByIdOrder,
  setPrimaryImage,
} from "../lib/itemImagesNormalize";
import {
  validateItemImageFile,
  validateItemImageSlotAvailable,
  ITEM_IMAGE_MAX_COUNT,
} from "../lib/itemImageValidation";
import { ItemImageEmptyState } from "./ItemImageEmptyState";
import { ItemImagePreview } from "./ItemImagePreview";
import { ItemImageThumbnails } from "./ItemImageThumbnails";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openPath } from "@tauri-apps/plugin-opener";
import { Upload } from "lucide-react";

type Props = {
  isNew: boolean;
  itemId: string | undefined;
  images: ItemImage[];
  onImagesChanged: () => void;
};

type UploadIntent = "add" | "replace";

export function ItemImagesCard({ isNew, itemId, images, onImagesChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIntentRef = useRef<UploadIntent>("add");

  /** Order: sortOrder only. Primary does not affect ordering. */
  const orderedImages = useMemo(() => normalizeItemImages(images), [images]);
  const imagesFingerprint = useMemo(
    () => orderedImages.map((i) => `${i.id}:${i.relativePath}:${i.sortOrder}:${i.isPrimary}`).join("|"),
    [orderedImages],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAbsolutePath, setPreviewAbsolutePath] = useState<string | null>(null);
  const [previewLoadState, setPreviewLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [cardMessage, setCardMessage] = useState<{ text: string; variant: "error" | "info" } | null>(null);

  useEffect(() => {
    if (orderedImages.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && orderedImages.some((i) => i.id === prev)) return prev;
      return orderedImages[0]!.id;
    });
  }, [imagesFingerprint, orderedImages]);

  /** Preview follows selection (sort-order first item only as fallback while syncing). */
  const displayImage = useMemo(() => {
    if (orderedImages.length === 0) return undefined;
    if (selectedId) {
      const hit = orderedImages.find((i) => i.id === selectedId);
      if (hit) return hit;
    }
    return orderedImages[0];
  }, [orderedImages, selectedId]);

  const selectedIndex =
    selectedId != null ? orderedImages.findIndex((i) => i.id === selectedId) : -1;

  useEffect(() => {
    let cancelled = false;
    if (!displayImage) {
      setPreviewUrl(null);
      setPreviewAbsolutePath(null);
      setPreviewLoadState("idle");
      return;
    }
    setPreviewLoadState("loading");
    setPreviewUrl(null);
    setPreviewAbsolutePath(null);
    getItemImagePreviewSources(displayImage.relativePath)
      .then(({ absolutePath, previewUrl: url }) => {
        if (!cancelled) {
          setPreviewAbsolutePath(absolutePath);
          setPreviewUrl(url);
          setPreviewLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewAbsolutePath(null);
          setPreviewLoadState("error");
          setCardMessage({ text: "Could not load image preview.", variant: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [displayImage?.id, displayImage?.relativePath]);

  useEffect(() => {
    let cancelled = false;
    if (orderedImages.length === 0) {
      setThumbUrls({});
      return;
    }
    void (async () => {
      const entries = await Promise.all(
        orderedImages.map(async (img) => {
          try {
            const { previewUrl: url } = await getItemImagePreviewSources(img.relativePath);
            return [img.id, url] as const;
          } catch {
            return [img.id, ""] as const;
          }
        }),
      );
      if (!cancelled) {
        setThumbUrls(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imagesFingerprint, orderedImages]);

  const persistImages = useCallback(
    async (next: ItemImage[]) => {
      if (!itemId) return;
      const normalized = normalizeItemImages(next);
      itemRepository.update(itemId, { images: normalized });
      try {
        await flushPendingItemsPersist();
      } catch (pe) {
        setCardMessage({
          text: pe instanceof Error ? pe.message : "Could not save item metadata to disk.",
          variant: "error",
        });
        onImagesChanged();
        throw pe;
      }
      onImagesChanged();
    },
    [itemId, onImagesChanged],
  );

  const triggerPickAdd = useCallback(() => {
    setCardMessage(null);
    const slotErr = validateItemImageSlotAvailable(orderedImages.length);
    if (slotErr) {
      setCardMessage({ text: slotErr, variant: "error" });
      return;
    }
    uploadIntentRef.current = "add";
    fileInputRef.current?.click();
  }, [orderedImages.length]);

  const triggerPickReplace = useCallback(() => {
    setCardMessage(null);
    uploadIntentRef.current = "replace";
    fileInputRef.current?.click();
  }, []);

  const applyReplaceFile = useCallback(
    async (file: File | null) => {
      if (!file || !itemId) return;
      setBusy(true);
      setCardMessage(null);
      try {
        const target =
          orderedImages.find((x) => x.id === selectedId) ??
          getPrimaryImage(orderedImages) ??
          orderedImages[0];
        if (!target) {
          setCardMessage({ text: "No image to replace.", variant: "error" });
          return;
        }
        const previous = normalizeItemImages(orderedImages);
        const result = await saveItemImageFromFile(itemId, file, {
          sortOrder: target.sortOrder,
          isPrimary: target.isPrimary,
        });
        if ("error" in result) {
          setCardMessage({ text: result.error, variant: "error" });
          return;
        }
        const oldPath = target.relativePath;
        const merged = normalizeItemImages(
          orderedImages.map((img) => (img.id === target.id ? result.image : img)),
        );
        itemRepository.update(itemId, { images: merged });
        try {
          await flushPendingItemsPersist();
        } catch (pe) {
          setCardMessage({
            text: pe instanceof Error ? pe.message : "Could not save item metadata to disk.",
            variant: "error",
          });
          await deleteStoredImageFile(result.image.relativePath);
          itemRepository.update(itemId, { images: previous });
          onImagesChanged();
          return;
        }
        await deleteStoredImageFile(oldPath);
        onImagesChanged();
        setSelectedId(result.image.id);
      } catch (e) {
        setCardMessage({
          text: e instanceof Error ? e.message : "Could not save image. Use the desktop app.",
          variant: "error",
        });
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [itemId, onImagesChanged, orderedImages, selectedId],
  );

  const applyAddFiles = useCallback(
    async (files: File[]) => {
      if (!itemId || files.length === 0) return;
      const fileArr = files;

      const slotErr = validateItemImageSlotAvailable(orderedImages.length);
      if (slotErr) {
        setCardMessage({ text: slotErr, variant: "error" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setBusy(true);
      setCardMessage(null);

      const hadImagesBefore = orderedImages.length > 0;

      let slotsRemaining = ITEM_IMAGE_MAX_COUNT - orderedImages.length;
      const skipped: string[] = [];
      let droppedDueToCap = 0;

      let working = [...orderedImages];
      const newFilesWritten: ItemImage[] = [];

      for (const file of fileArr) {
        if (slotsRemaining <= 0) {
          droppedDueToCap++;
          continue;
        }
        const val = validateItemImageFile(file);
        if (val) {
          skipped.push(`${file.name}: ${val}`);
          continue;
        }
        const placement = {
          sortOrder: working.length,
          isPrimary: working.length === 0,
        };
        const result = await saveItemImageFromFile(itemId, file, placement);
        if ("error" in result) {
          skipped.push(`${file.name}: ${result.error}`);
          continue;
        }
        newFilesWritten.push(result.image);
        working = [...working, result.image];
        slotsRemaining--;
      }

      if (newFilesWritten.length === 0) {
        const parts: string[] = [];
        if (skipped.length) parts.push(`Skipped: ${skipped.join("; ")}`);
        if (droppedDueToCap > 0) {
          parts.push(`Only 0 images were added. Maximum per item is ${ITEM_IMAGE_MAX_COUNT}.`);
        }
        setCardMessage({
          text: parts.join(" ") || "No images could be added.",
          variant: "error",
        });
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      try {
        await persistImages(working);
        const added = newFilesWritten.length;
        const summary: string[] = [];
        if (droppedDueToCap > 0) {
          summary.push(
            `Only ${added} image${added === 1 ? "" : "s"} were added. Maximum per item is ${ITEM_IMAGE_MAX_COUNT}.`,
          );
        } else {
          summary.push(`Added ${added} image${added === 1 ? "" : "s"}.`);
        }
        if (skipped.length > 0) {
          const maxShow = 4;
          const shown = skipped.slice(0, maxShow).join("; ");
          summary.push(`Skipped: ${shown}${skipped.length > maxShow ? " …" : ""}`);
        }
        setCardMessage({ text: summary.join(" "), variant: "info" });
        if (!hadImagesBefore) {
          setSelectedId(newFilesWritten[0]!.id);
        }
      } catch {
        for (const img of newFilesWritten) {
          await deleteStoredImageFile(img.relativePath);
        }
        itemRepository.update(itemId, { images: normalizeItemImages(orderedImages) });
        onImagesChanged();
        setCardMessage({ text: "Could not save images to disk.", variant: "error" });
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [itemId, onImagesChanged, orderedImages, persistImages],
  );

  const applyFileInputChange = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      if (uploadIntentRef.current === "replace") {
        void applyReplaceFile(files[0] ?? null);
      } else {
        void applyAddFiles(files);
      }
    },
    [applyAddFiles, applyReplaceFile],
  );

  const handleRemove = useCallback(async () => {
    if (!itemId || selectedId == null) return;
    const toRemove = orderedImages.find((x) => x.id === selectedId);
    if (!toRemove) return;

    setBusy(true);
    setCardMessage(null);
    const previous = normalizeItemImages(orderedImages);
    const filtered = orderedImages.filter((x) => x.id !== toRemove.id);
    const next = normalizeItemImages(filtered);
    const pathToDelete = toRemove.relativePath;
    try {
      itemRepository.update(itemId, { images: next });
      try {
        await flushPendingItemsPersist();
      } catch (pe) {
        setCardMessage({
          text: pe instanceof Error ? pe.message : "Could not save item metadata to disk.",
          variant: "error",
        });
        itemRepository.update(itemId, { images: previous });
        onImagesChanged();
        return;
      }
      await deleteStoredImageFile(pathToDelete);
      onImagesChanged();
    } catch (e) {
      setCardMessage({
        text: e instanceof Error ? e.message : "Could not remove image.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [itemId, onImagesChanged, orderedImages, selectedId]);

  const handleOpenFullSize = useCallback(async () => {
    if (!displayImage) return;
    setCardMessage(null);
    let absolutePathForOpen: string | undefined;
    try {
      absolutePathForOpen = await resolveAbsoluteImagePath(displayImage.relativePath);
      await openPath(absolutePathForOpen);
    } catch (e) {
      const base =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Could not open image.";
      if (import.meta.env.DEV) {
        console.error("[ItemImagesCard] Open full size failed", {
          relativePath: displayImage.relativePath,
          absolutePath: absolutePathForOpen,
          error: e,
        });
      }
      const withPath =
        import.meta.env.DEV && absolutePathForOpen
          ? `${base} — path: ${absolutePathForOpen}`
          : base;
      setCardMessage({ text: withPath, variant: "error" });
    }
  }, [displayImage]);

  const handleSetPrimary = useCallback(async () => {
    if (!itemId || selectedId == null) return;
    setBusy(true);
    setCardMessage(null);
    try {
      await persistImages(setPrimaryImage(orderedImages, selectedId));
    } catch {
      /* message set in persistImages */
    } finally {
      setBusy(false);
    }
  }, [itemId, orderedImages, persistImages, selectedId]);

  const handleSelectPrevious = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedId(orderedImages[selectedIndex - 1]!.id);
  }, [orderedImages, selectedIndex]);

  const handleSelectNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= orderedImages.length - 1) return;
    setSelectedId(orderedImages[selectedIndex + 1]!.id);
  }, [orderedImages, selectedIndex]);

  const handleReorderIds = useCallback(
    async (newOrderIds: string[]) => {
      if (!itemId) return;
      setBusy(true);
      setCardMessage(null);
      try {
        const next = reorderItemImagesByIdOrder(orderedImages, newOrderIds);
        await persistImages(next);
      } catch {
        /* persistImages */
      } finally {
        setBusy(false);
      }
    },
    [itemId, orderedImages, persistImages],
  );

  const canAddMore = orderedImages.length < ITEM_IMAGE_MAX_COUNT;

  return (
    <Card className="border-0 shadow-none xl:sticky xl:top-2">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">Images</CardTitle>
        <CardDescription className="text-xs">
          Up to {ITEM_IMAGE_MAX_COUNT} images (JPG, PNG, WebP, 10 MB each). Upload accepts multiple files.
          Arrows change selection; drag thumbnails to reorder. Stored locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const list = e.target.files;
            const picked = list ? Array.from(list) : [];
            e.target.value = "";
            applyFileInputChange(picked);
          }}
        />
        {cardMessage && (
          <p
            className={
              cardMessage.variant === "error"
                ? "mb-2 text-xs text-destructive"
                : "mb-2 text-xs text-muted-foreground"
            }
            role={cardMessage.variant === "error" ? "alert" : "status"}
          >
            {cardMessage.text}
          </p>
        )}
        {isNew || !itemId ? (
          <ItemImageEmptyState variant="unsaved" />
        ) : orderedImages.length === 0 ? (
          <ItemImageEmptyState variant="ready" onUploadClick={triggerPickAdd} disabled={busy} />
        ) : (
          <div className="flex flex-col gap-2">
            {displayImage && (
              <ItemImagePreview
                loadState={previewLoadState}
                previewUrl={previewUrl}
                absolutePath={previewAbsolutePath}
                image={displayImage}
                onReplace={triggerPickReplace}
                onRemove={() => void handleRemove()}
                onOpenFullSize={() => void handleOpenFullSize()}
                onSetPrimary={handleSetPrimary}
                canSetPrimary={selectedId != null}
                onSelectPrevious={handleSelectPrevious}
                onSelectNext={handleSelectNext}
                canSelectPrevious={selectedIndex > 0}
                canSelectNext={selectedIndex >= 0 && selectedIndex < orderedImages.length - 1}
                busy={busy}
              />
            )}
            <ItemImageThumbnails
              images={orderedImages}
              selectedId={selectedId}
              thumbUrls={thumbUrls}
              onSelect={setSelectedId}
              onReorderIds={(ids) => void handleReorderIds(ids)}
              disabled={busy}
            />
            {canAddMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full gap-1.5"
                onClick={triggerPickAdd}
                disabled={busy}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload image
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground">Maximum {ITEM_IMAGE_MAX_COUNT} images reached.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
