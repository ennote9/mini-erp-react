import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/shared/i18n/context";
import type { AgGridColumnSettingsItem } from "./columnSettings";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AgGridColumnSettingsItem[];
  onItemsChange: (next: AgGridColumnSettingsItem[]) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
};

type RowProps = {
  item: AgGridColumnSettingsItem;
  index: number;
  total: number;
  onToggleVisible: (id: string, checked: boolean) => void;
  onMove: (id: string, direction: -1 | 1) => void;
};

function SortableColumnRow({ item, index, total, onToggleVisible, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: item.lockedOrder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 ${isDragging ? "opacity-75" : ""}`.trim()}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={item.lockedOrder}
        aria-label={item.lockedOrder ? "Locked position" : "Drag to reorder"}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        id={`grid-col-visible-${item.id}`}
        checked={item.visible}
        disabled={item.lockedVisible}
        onCheckedChange={(checked) => onToggleVisible(item.id, checked === true)}
      />
      <label
        htmlFor={`grid-col-visible-${item.id}`}
        className={`min-w-0 flex-1 truncate text-sm ${item.lockedVisible ? "text-muted-foreground" : "text-foreground"}`.trim()}
      >
        {item.label}
      </label>
      {item.lockedVisible && (
        <span className="inline-flex items-center gap-1 rounded-md border border-input px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Lock className="h-3 w-3" />
          Fixed
        </span>
      )}
      {!item.lockedOrder && (
        <div className="ml-1 inline-flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onMove(item.id, -1)}
            disabled={index <= 0}
            aria-label="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onMove(item.id, 1)}
            disabled={index >= total - 1}
            aria-label="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function AgGridColumnSettingsModal({
  open,
  onOpenChange,
  items,
  onItemsChange,
  onApply,
  onCancel,
  onReset,
}: Props) {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const orderedIds = useMemo(() => items.map((x) => x.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = items[oldIndex];
    if (moved.lockedOrder) return;
    const target = items[newIndex];
    if (target.lockedOrder) return;
    onItemsChange(arrayMove(items, oldIndex, newIndex));
  };

  const handleToggleVisible = (id: string, checked: boolean) => {
    onItemsChange(items.map((x) => (x.id === id ? { ...x, visible: x.lockedVisible ? true : checked } : x)));
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((x) => x.id === id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const target = items[targetIndex];
    if (target.lockedOrder) return;
    onItemsChange(arrayMove(items, index, targetIndex));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(42rem,92vw)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-input bg-background p-4 shadow-lg">
          <Dialog.Title className="text-base font-semibold">{t("doc.list.columnSettingsTitle")}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {t("doc.list.columnSettingsDescription")}
          </Dialog.Description>

          <div className="mt-3 max-h-[58vh] space-y-1.5 overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {items.map((item, index) => (
                  <SortableColumnRow
                    key={item.id}
                    item={item}
                    index={index}
                    total={items.length}
                    onToggleVisible={handleToggleVisible}
                    onMove={handleMove}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              {t("doc.list.columnSettingsReset")}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={onApply}>
                {t("common.apply")}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
