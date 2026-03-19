import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemImage } from "../model";
import { cn } from "@/lib/utils";

type Props = {
  images: ItemImage[];
  selectedId: string | null;
  thumbUrls: Record<string, string>;
  onSelect: (id: string) => void;
  /** Full id list in new order after a successful drag reorder. */
  onReorderIds: (orderedIds: string[]) => void;
  disabled?: boolean;
};

type SortableThumbProps = {
  img: ItemImage;
  selectedId: string | null;
  thumbUrls: Record<string, string>;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

function SortableThumb({ img, selectedId, thumbUrls, disabled, onSelect }: SortableThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const selected = img.id === selectedId;
  const url = thumbUrls[img.id];

  const { role: _dndRole, ...restAttributes } = attributes;

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      style={style}
      className={cn(
        "relative h-12 w-12 shrink-0 touch-none cursor-grab overflow-hidden rounded border bg-muted/30 transition-colors active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40",
        disabled && "cursor-not-allowed opacity-50",
        isDragging && "z-10 border-muted-foreground/60 opacity-90 shadow-sm",
      )}
      title={`${img.fileName} — drag to reorder`}
      {...restAttributes}
      {...listeners}
      onClick={() => {
        if (!disabled) onSelect(img.id);
      }}
    >
      {url ? (
        <img src={url} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
          …
        </span>
      )}
      {img.isPrimary && (
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-background/85 py-px text-center text-[8px] font-semibold leading-none text-foreground">
          P
        </span>
      )}
    </button>
  );
}

/**
 * Horizontal sortable thumbnail strip (@dnd-kit). Order follows `images` (sortOrder).
 */
export function ItemImageThumbnails({
  images,
  selectedId,
  thumbUrls,
  onSelect,
  onReorderIds,
  disabled,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = images.map((i) => i.id);

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onReorderIds(arrayMove(ids, oldIndex, newIndex));
  };

  if (images.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-1.5 pt-1" role="listbox" aria-label="Item images">
          {images.map((img) => (
            <SortableThumb
              key={img.id}
              img={img}
              selectedId={selectedId}
              thumbUrls={thumbUrls}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
