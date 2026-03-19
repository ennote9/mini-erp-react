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
  moveImageInOrder,
  normalizeItemImages,
  setPrimaryImage,
} from "../lib/itemImagesNormalize";
import { validateItemImageSlotAvailable, ITEM_IMAGE_MAX_COUNT } from "../lib/itemImageValidation";
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

  const sorted = useMemo(() => normalizeItemImages(images), [images]);
  const imagesFingerprint = useMemo(
    () => sorted.map((i) => `${i.id}:${i.relativePath}:${i.sortOrder}:${i.isPrimary}`).join("|"),
    [sorted],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAbsolutePath, setPreviewAbsolutePath] = useState<string | null>(null);
  const [previewLoadState, setPreviewLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sorted.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && sorted.some((i) => i.id === prev)) return prev;
      const primary = sorted.find((x) => x.isPrimary) ?? sorted[0];
      return primary.id;
    });
  }, [imagesFingerprint, sorted]);

  const displayImage = useMemo(() => {
    if (sorted.length === 0) return undefined;
    if (selectedId) {
      const hit = sorted.find((i) => i.id === selectedId);
      if (hit) return hit;
    }
    return getPrimaryImage(sorted) ?? sorted[0];
  }, [sorted, selectedId]);

  const displayIndex = displayImage ? sorted.findIndex((i) => i.id === displayImage.id) : -1;

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
          setMessage("Could not load image preview.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [displayImage?.id, displayImage?.relativePath]);

  useEffect(() => {
    let cancelled = false;
    if (sorted.length === 0) {
      setThumbUrls({});
      return;
    }
    void (async () => {
      const entries = await Promise.all(
        sorted.map(async (img) => {
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
  }, [imagesFingerprint, sorted]);

  const persistImages = useCallback(
    async (next: ItemImage[]) => {
      if (!itemId) return;
      const normalized = normalizeItemImages(next);
      itemRepository.update(itemId, { images: normalized });
      try {
        await flushPendingItemsPersist();
      } catch (pe) {
        setMessage(pe instanceof Error ? pe.message : "Could not save item metadata to disk.");
        onImagesChanged();
        throw pe;
      }
      onImagesChanged();
    },
    [itemId, onImagesChanged],
  );

  const triggerPickAdd = useCallback(() => {
    setMessage(null);
    const slotErr = validateItemImageSlotAvailable(sorted.length);
    if (slotErr) {
      setMessage(slotErr);
      return;
    }
    uploadIntentRef.current = "add";
    fileInputRef.current?.click();
  }, [sorted.length]);

  const triggerPickReplace = useCallback(() => {
    setMessage(null);
    uploadIntentRef.current = "replace";
    fileInputRef.current?.click();
  }, []);

  const applyFile = useCallback(
    async (file: File | null) => {
      if (!file || !itemId) return;
      setBusy(true);
      setMessage(null);
      const intent = uploadIntentRef.current;
      try {
        if (intent === "add") {
          const slotErr = validateItemImageSlotAvailable(sorted.length);
          if (slotErr) {
            setMessage(slotErr);
            return;
          }
          const placement = {
            sortOrder: sorted.length,
            isPrimary: sorted.length === 0,
          };
          const result = await saveItemImageFromFile(itemId, file, placement);
          if ("error" in result) {
            setMessage(result.error);
            return;
          }
          try {
            await persistImages([...sorted, result.image]);
            setSelectedId(result.image.id);
          } catch {
            await deleteStoredImageFile(result.image.relativePath);
            itemRepository.update(itemId, { images: normalizeItemImages(sorted) });
            onImagesChanged();
          }
        } else {
          const target =
            sorted.find((x) => x.id === selectedId) ?? getPrimaryImage(sorted) ?? sorted[0];
          if (!target) {
            setMessage("No image to replace.");
            return;
          }
          const previous = normalizeItemImages(sorted);
          const result = await saveItemImageFromFile(itemId, file, {
            sortOrder: target.sortOrder,
            isPrimary: target.isPrimary,
          });
          if ("error" in result) {
            setMessage(result.error);
            return;
          }
          const oldPath = target.relativePath;
          const merged = normalizeItemImages(
            sorted.map((img) => (img.id === target.id ? result.image : img)),
          );
          itemRepository.update(itemId, { images: merged });
          try {
            await flushPendingItemsPersist();
          } catch (pe) {
            setMessage(pe instanceof Error ? pe.message : "Could not save item metadata to disk.");
            await deleteStoredImageFile(result.image.relativePath);
            itemRepository.update(itemId, { images: previous });
            onImagesChanged();
            return;
          }
          await deleteStoredImageFile(oldPath);
          onImagesChanged();
          setSelectedId(result.image.id);
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not save image. Use the desktop app.");
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [itemId, persistImages, selectedId, sorted],
  );

  const handleRemove = useCallback(async () => {
    if (!itemId || !displayImage) return;
    setBusy(true);
    setMessage(null);
    const previous = normalizeItemImages(sorted);
    const filtered = sorted.filter((x) => x.id !== displayImage.id);
    const next = normalizeItemImages(filtered);
    const pathToDelete = displayImage.relativePath;
    try {
      itemRepository.update(itemId, { images: next });
      try {
        await flushPendingItemsPersist();
      } catch (pe) {
        setMessage(pe instanceof Error ? pe.message : "Could not save item metadata to disk.");
        itemRepository.update(itemId, { images: previous });
        onImagesChanged();
        return;
      }
      await deleteStoredImageFile(pathToDelete);
      onImagesChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not remove image.");
    } finally {
      setBusy(false);
    }
  }, [displayImage, itemId, onImagesChanged, sorted]);

  const handleOpenFullSize = useCallback(async () => {
    if (!displayImage) return;
    setMessage(null);
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
      setMessage(withPath);
    }
  }, [displayImage]);

  const handleSetPrimary = useCallback(async () => {
    if (!itemId || !displayImage) return;
    setBusy(true);
    setMessage(null);
    try {
      await persistImages(setPrimaryImage(sorted, displayImage.id));
    } catch {
      /* message set in persistImages */
    } finally {
      setBusy(false);
    }
  }, [displayImage, itemId, persistImages, sorted]);

  const handleMoveLeft = useCallback(async () => {
    if (!itemId || !displayImage) return;
    setBusy(true);
    setMessage(null);
    try {
      await persistImages(moveImageInOrder(sorted, displayImage.id, -1));
    } catch {
      /* persistImages surfaced message */
    } finally {
      setBusy(false);
    }
  }, [displayImage, itemId, persistImages, sorted]);

  const handleMoveRight = useCallback(async () => {
    if (!itemId || !displayImage) return;
    setBusy(true);
    setMessage(null);
    try {
      await persistImages(moveImageInOrder(sorted, displayImage.id, 1));
    } catch {
      /* persistImages surfaced message */
    } finally {
      setBusy(false);
    }
  }, [displayImage, itemId, persistImages, sorted]);

  const canAddMore = sorted.length < ITEM_IMAGE_MAX_COUNT;

  return (
    <Card className="border-0 shadow-none xl:sticky xl:top-2">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">Images</CardTitle>
        <CardDescription className="text-xs">
          Up to {ITEM_IMAGE_MAX_COUNT} images per item (JPG, PNG, WebP, 10 MB each). Stored locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void applyFile(e.target.files?.[0] ?? null)}
        />
        {message && (
          <p className="mb-2 text-xs text-destructive" role="alert">
            {message}
          </p>
        )}
        {isNew || !itemId ? (
          <ItemImageEmptyState variant="unsaved" />
        ) : sorted.length === 0 ? (
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
                onMoveLeft={handleMoveLeft}
                onMoveRight={handleMoveRight}
                canMoveLeft={displayIndex > 0}
                canMoveRight={displayIndex >= 0 && displayIndex < sorted.length - 1}
                busy={busy}
              />
            )}
            <ItemImageThumbnails
              images={sorted}
              selectedId={selectedId}
              thumbUrls={thumbUrls}
              onSelect={setSelectedId}
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
