import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemImage } from "../model";
import { itemRepository } from "../repository";
import {
  deleteStoredImageFile,
  getItemImagePreviewSources,
  resolveAbsoluteImagePath,
  saveItemImageFromFile,
} from "../lib/itemImageStorage";
import { ItemImageEmptyState } from "./ItemImageEmptyState";
import { ItemImagePreview } from "./ItemImagePreview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { openPath } from "@tauri-apps/plugin-opener";

function primaryImage(images: ItemImage[]): ItemImage | undefined {
  if (images.length === 0) return undefined;
  const marked = images.find((i) => i.isPrimary);
  if (marked) return marked;
  return [...images].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))[0];
}

type Props = {
  isNew: boolean;
  itemId: string | undefined;
  images: ItemImage[];
  onImagesChanged: () => void;
};

export function ItemImagesCard({ isNew, itemId, images, onImagesChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAbsolutePath, setPreviewAbsolutePath] = useState<string | null>(null);
  const [previewLoadState, setPreviewLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const img = primaryImage(images);

  useEffect(() => {
    let cancelled = false;
    if (!img) {
      setPreviewUrl(null);
      setPreviewAbsolutePath(null);
      setPreviewLoadState("idle");
      return;
    }
    setPreviewLoadState("loading");
    setPreviewUrl(null);
    setPreviewAbsolutePath(null);
    getItemImagePreviewSources(img.relativePath)
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
  }, [img?.id, img?.relativePath]);

  const triggerPick = useCallback(() => {
    setMessage(null);
    fileInputRef.current?.click();
  }, []);

  const applyFile = useCallback(
    async (file: File | null) => {
      if (!file || !itemId) return;
      setBusy(true);
      setMessage(null);
      try {
        const current = primaryImage(itemRepository.getById(itemId)?.images ?? []);
        if (current) {
          await deleteStoredImageFile(current.relativePath);
        }
        const result = await saveItemImageFromFile(itemId, file);
        if ("error" in result) {
          setMessage(result.error);
          return;
        }
        itemRepository.update(itemId, { images: [result.image] });
        onImagesChanged();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not save image. Use the desktop app.");
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [itemId, onImagesChanged],
  );

  const handleRemove = useCallback(async () => {
    if (!itemId || !img) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteStoredImageFile(img.relativePath);
      itemRepository.update(itemId, { images: [] });
      onImagesChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not remove image.");
    } finally {
      setBusy(false);
    }
  }, [itemId, img, onImagesChanged]);

  const handleOpenFullSize = useCallback(async () => {
    if (!img) return;
    try {
      const abs = await resolveAbsoluteImagePath(img.relativePath);
      await openPath(abs);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not open image.");
    }
  }, [img]);

  return (
    <Card className="border-0 shadow-none xl:sticky xl:top-2">
      <CardHeader className="p-2 pb-0.5">
        <CardTitle className="text-[0.9rem] font-semibold">Images</CardTitle>
        <CardDescription className="text-xs">
          One product image (stored locally). JPG, PNG, or WebP, up to 10 MB.
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
        ) : !img ? (
          <ItemImageEmptyState
            variant="ready"
            onUploadClick={triggerPick}
            disabled={busy}
          />
        ) : (
          <ItemImagePreview
            loadState={previewLoadState}
            previewUrl={previewUrl}
            absolutePath={previewAbsolutePath}
            image={img}
            onReplace={triggerPick}
            onRemove={() => void handleRemove()}
            onOpenFullSize={() => void handleOpenFullSize()}
            busy={busy}
          />
        )}
      </CardContent>
    </Card>
  );
}
