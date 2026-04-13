import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/shared/i18n/context";
import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterConfig } from "./AgGridColumnFilters";
import type { AgGridColumnSettingsItem, AgGridPersonalView } from "./columnSettings";
import {
  getSupportedOperatorsByFieldType,
  type ListViewDeepFilterRule,
  type ListViewDeepSortRule,
  type ListViewFieldDataType,
  type ListViewFieldRegistryEntry,
} from "./listViewConfig";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AgGridColumnSettingsItem[];
  onItemsChange: (next: AgGridColumnSettingsItem[]) => void;
  filterRules: ListViewDeepFilterRule[];
  onFilterRulesChange: (next: ListViewDeepFilterRule[]) => void;
  sortRules: ListViewDeepSortRule[];
  onSortRulesChange: (next: ListViewDeepSortRule[]) => void;
  registry: ListViewFieldRegistryEntry[];
  filterConfigs?: Record<string, AgGridColumnFilterConfig<unknown>>;
  includeHiddenInFilterSort?: boolean;
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
  activeViewName: string | null;
  hasUnsavedChanges: boolean;
  onActivateView: (viewId: string | null) => void;
  onCreateView: (name: string) => void;
  onSaveChangesToActiveView: () => void;
  onRenameActiveView: (name: string) => void;
  onDeleteActiveView: () => void;
  onSetActiveAsDefault: () => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
};

type ConfiguratorTab = "fields" | "filtering" | "sorting";

type RowProps = {
  item: AgGridColumnSettingsItem;
  selected: boolean;
  onToggleVisible: (id: string, checked: boolean) => void;
  onSelect: (id: string, ctrlToggle: boolean) => void;
};

function SortableColumnRow({ item, selected, onToggleVisible, onSelect }: RowProps) {
  const { t } = useTranslation();
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
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
        selected ? "border-primary/60 bg-primary/10" : "border-input bg-background"
      } ${isDragging ? "opacity-75" : ""}`.trim()}
      onClick={(event) => onSelect(item.id, event.ctrlKey || event.metaKey)}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={item.lockedOrder}
        aria-label={item.lockedOrder ? t("doc.list.viewFieldLockedPosition") : t("doc.list.viewFieldDragHandle")}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Switch
        checked={item.visible}
        disabled={item.lockedVisible}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) => onToggleVisible(item.id, checked === true)}
      />
      <label
        className={`min-w-0 flex-1 truncate text-sm ${item.lockedVisible ? "text-muted-foreground" : "text-foreground"}`.trim()}
      >
        {item.label}
      </label>
      {item.lockedVisible && (
        <span className="inline-flex items-center gap-1 rounded-md border border-input px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Lock className="h-3 w-3" />
          {t("doc.list.viewFieldFixed")}
        </span>
      )}
    </div>
  );
}

type SortableSortRuleRowProps = {
  rule: ListViewDeepSortRule;
  index: number;
  dndId: string;
  selected: boolean;
  sortableFields: ListViewFieldRegistryEntry[];
  usedSortFields: Set<string>;
  tx: (key: string) => string;
  onSelect: (ctrlToggle: boolean) => void;
  onChange: (patch: Partial<ListViewDeepSortRule>) => void;
};

function SortableSortRuleRow({
  rule,
  index,
  dndId,
  selected,
  sortableFields,
  usedSortFields,
  tx,
  onSelect,
  onChange,
}: SortableSortRuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEditControlPointerDown = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    ctrlToggle: boolean,
  ) => {
    if (ctrlToggle) {
      event.preventDefault();
      event.stopPropagation();
      onSelect(true);
      return;
    }
    if (!selected) {
      event.preventDefault();
      event.stopPropagation();
      onSelect(false);
      return;
    }
    event.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-input bg-background hover:border-border/90"
      } ${isDragging ? "opacity-75" : ""}`.trim()}
      onClick={(event) => onSelect(event.ctrlKey || event.metaKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(false);
        }
      }}
      aria-pressed={selected}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(false);
        }}
        aria-label={tx("doc.list.viewSortDragHandle")}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Switch
        checked={rule.enabled}
        aria-label={`${tx("doc.list.viewRuleEnabled")} #${index + 1}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(false);
        }}
        onCheckedChange={(checked) => {
          onSelect(false);
          onChange({ enabled: checked === true });
        }}
      />
      <span className="inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-muted/20 text-[11px] font-medium text-muted-foreground">
        #{index + 1}
      </span>
      <select
        className="h-8 min-w-[10rem] flex-[1_1_15rem] rounded-md border border-input bg-background px-2 text-xs text-foreground"
        value={rule.fieldKey}
        onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onChange({ fieldKey: event.target.value });
        }}
      >
        {sortableFields.map((entry) => (
          <option
            key={entry.fieldKey}
            value={entry.fieldKey}
            disabled={entry.fieldKey !== rule.fieldKey && usedSortFields.has(entry.fieldKey)}
          >
            {entry.label}
          </option>
        ))}
      </select>
      <select
        className="h-8 w-[9rem] shrink-0 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        value={rule.direction}
        onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onChange({ direction: event.target.value as "asc" | "desc" });
        }}
      >
        <option value="asc">{tx("doc.list.viewSortAsc")}</option>
        <option value="desc">{tx("doc.list.viewSortDesc")}</option>
      </select>
    </div>
  );
}

const NO_VALUE_OPERATORS = new Set<AgGridFilterOperator>(["is_empty", "is_not_empty", "is_true", "is_false"]);
const RANGE_OPERATORS = new Set<AgGridFilterOperator>(["between", "not_between"]);
const MULTI_OPERATORS = new Set<AgGridFilterOperator>(["in", "not_in"]);

function isNoValueOperator(operator: AgGridFilterOperator): boolean {
  return NO_VALUE_OPERATORS.has(operator);
}

function isRangeOperator(operator: AgGridFilterOperator): boolean {
  return RANGE_OPERATORS.has(operator);
}

function isMultiValueOperator(operator: AgGridFilterOperator): boolean {
  return MULTI_OPERATORS.has(operator);
}

function firstOperatorForField(field: ListViewFieldRegistryEntry): AgGridFilterOperator | null {
  const operators = getSupportedOperatorsByFieldType(field.dataType);
  return operators.length > 0 ? operators[0] : null;
}

function operatorLabel(t: (key: string) => string, operator: AgGridFilterOperator): string {
  return t(`gridFilters.operators.${operator}`);
}

function mapFieldDataTypeToInputType(dataType: ListViewFieldDataType): "text" | "number" | "date" | "datetime-local" {
  switch (dataType) {
    case "number":
    case "money":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    default:
      return "text";
  }
}

export function AgGridColumnSettingsModal({
  open,
  onOpenChange,
  items,
  onItemsChange,
  filterRules,
  onFilterRulesChange,
  sortRules,
  onSortRulesChange,
  registry,
  filterConfigs,
  includeHiddenInFilterSort = false,
  personalViews,
  activeViewId,
  activeViewName,
  hasUnsavedChanges,
  onActivateView,
  onCreateView,
  onSaveChangesToActiveView,
  onRenameActiveView,
  onDeleteActiveView,
  onSetActiveAsDefault,
  onApply,
  onCancel,
  onReset,
}: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfiguratorTab>("fields");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const orderedIds = useMemo(() => items.map((x) => x.id), [items]);
  const visibleFieldKeys = useMemo(() => new Set(items.filter((item) => item.visible).map((item) => item.id)), [items]);
  const registryByFieldKey = useMemo(() => new Map(registry.map((entry) => [entry.fieldKey, entry])), [registry]);
  const filterableFields = useMemo(() => {
    if (includeHiddenInFilterSort) {
      return registry.filter((entry) => entry.filterable);
    }
    return registry.filter((entry) => entry.filterable && visibleFieldKeys.has(entry.fieldKey));
  }, [includeHiddenInFilterSort, registry, visibleFieldKeys]);
  const sortableFields = useMemo(() => {
    if (includeHiddenInFilterSort) {
      return registry.filter((entry) => entry.sortable);
    }
    return registry.filter((entry) => entry.sortable && visibleFieldKeys.has(entry.fieldKey));
  }, [includeHiddenInFilterSort, registry, visibleFieldKeys]);
  const usedSortFields = useMemo(() => new Set(sortRules.map((rule) => rule.fieldKey)), [sortRules]);
  const activeView = useMemo(
    () => personalViews.find((view) => view.viewId === activeViewId) ?? null,
    [personalViews, activeViewId],
  );
  const [pendingSwitchViewId, setPendingSwitchViewId] = useState<string | null>(null);
  const [confirmingSaveChanges, setConfirmingSaveChanges] = useState(false);
  const [createViewDialogOpen, setCreateViewDialogOpen] = useState(false);
  const [renameViewDialogOpen, setRenameViewDialogOpen] = useState(false);
  const [deleteViewDialogOpen, setDeleteViewDialogOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState("");
  const [renameViewName, setRenameViewName] = useState("");
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [selectedFilterIndexes, setSelectedFilterIndexes] = useState<number[]>([]);
  const [selectedSortFieldKeys, setSelectedSortFieldKeys] = useState<string[]>([]);

  const tx = (key: string): string => t(key);

  const toggleSelection = <T,>(current: T[], value: T, ctrlToggle: boolean): T[] => {
    if (!ctrlToggle) return [value];
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  };

  const moveSelectionByOne = <T,>(
    list: T[],
    selectedIndices: number[],
    direction: -1 | 1,
    canSwap?: (fromIndex: number, toIndex: number, snapshot: T[]) => boolean,
  ) => {
    const next = [...list];
    const selectedFlags = list.map((_, index) => selectedIndices.includes(index));
    let moved = false;

    if (direction === -1) {
      for (let index = 1; index < next.length; index += 1) {
        if (!selectedFlags[index] || selectedFlags[index - 1]) continue;
        if (canSwap && !canSwap(index, index - 1, next)) continue;
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        [selectedFlags[index - 1], selectedFlags[index]] = [selectedFlags[index], selectedFlags[index - 1]];
        moved = true;
      }
    } else {
      for (let index = next.length - 2; index >= 0; index -= 1) {
        if (!selectedFlags[index] || selectedFlags[index + 1]) continue;
        if (canSwap && !canSwap(index, index + 1, next)) continue;
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        [selectedFlags[index], selectedFlags[index + 1]] = [selectedFlags[index + 1], selectedFlags[index]];
        moved = true;
      }
    }

    const nextSelectedIndices = selectedFlags.reduce<number[]>((acc, selected, index) => {
      if (selected) acc.push(index);
      return acc;
    }, []);

    return { next, nextSelectedIndices, moved };
  };

  const summary = useMemo(() => {
    const visibleFields = items.filter((item) => item.visible).length;
    const activeFilters = filterRules.filter((rule) => rule.enabled).length;
    const activeSorts = sortRules.filter((rule) => rule.enabled).length;
    return `${visibleFields} ${tx("doc.list.viewSummaryFields")} · ${activeFilters} ${tx("doc.list.viewSummaryFilters")} · ${activeSorts} ${tx("doc.list.viewSummarySorts")}`;
  }, [items, filterRules, sortRules]);

  const handleCreateView = () => {
    const trimmed = createViewName.trim();
    if (trimmed === "") return;
    onCreateView(trimmed);
    setCreateViewDialogOpen(false);
    setCreateViewName("");
  };

  const handleRenameView = () => {
    if (!activeView) return;
    const trimmed = renameViewName.trim();
    if (trimmed === "" || trimmed === activeView.name.trim()) return;
    onRenameActiveView(trimmed);
    setRenameViewDialogOpen(false);
  };

  const handleDeleteView = () => {
    if (!activeView) return;
    onDeleteActiveView();
    setDeleteViewDialogOpen(false);
  };

  const openCreateViewDialog = () => {
    setCreateViewName("");
    setCreateViewDialogOpen(true);
  };

  const openRenameViewDialog = () => {
    if (!activeView) return;
    setRenameViewName(activeView.name);
    setRenameViewDialogOpen(true);
  };

  const openDeleteViewDialog = () => {
    if (!activeView) return;
    setDeleteViewDialogOpen(true);
  };

  const handleViewSelectChange = (nextViewId: string | null) => {
    if (nextViewId === activeViewId) return;
    if (hasUnsavedChanges) {
      setPendingSwitchViewId(nextViewId);
      return;
    }
    onActivateView(nextViewId);
  };

  const resolvePendingSwitch = (mode: "save" | "discard" | "cancel") => {
    if (mode === "cancel") {
      setPendingSwitchViewId(null);
      return;
    }
    if (mode === "save") {
      onSaveChangesToActiveView();
    }
    if (pendingSwitchViewId !== null || mode === "discard") {
      onActivateView(pendingSwitchViewId);
    }
    setPendingSwitchViewId(null);
  };

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

  const handleAddFilterRule = () => {
    const field = filterableFields[0];
    if (!field) return;
    const operator = firstOperatorForField(field);
    if (!operator) return;
    const nextRules = [
      ...filterRules,
      {
        fieldKey: field.fieldKey,
        operator,
        enabled: false,
        priority: filterRules.length,
      },
    ];
    onFilterRulesChange(nextRules);
    setSelectedFilterIndexes([nextRules.length - 1]);
  };

  const handleChangeFilterRule = (index: number, patch: Partial<ListViewDeepFilterRule>) => {
    onFilterRulesChange(
      filterRules.map((rule, currentIndex) =>
        currentIndex === index
          ? {
              ...rule,
              ...patch,
              priority: currentIndex,
            }
          : { ...rule, priority: currentIndex },
      ),
    );
  };

  const handleRemoveFilterRules = (indexesToRemove: number[]) => {
    if (indexesToRemove.length === 0) return;
    const removeSet = new Set(indexesToRemove);
    const next = filterRules.filter((_, currentIndex) => !removeSet.has(currentIndex)).map((rule, currentIndex) => ({
      ...rule,
      priority: currentIndex,
    }));
    onFilterRulesChange(next);
    if (next.length === 0) {
      setSelectedFilterIndexes([]);
      return;
    }
    const anchor = Math.min(...indexesToRemove);
    setSelectedFilterIndexes([Math.min(anchor, next.length - 1)]);
  };

  const handleMoveFilterRules = (selectedIndices: number[], direction: -1 | 1) => {
    const { next, nextSelectedIndices, moved } = moveSelectionByOne(filterRules, selectedIndices, direction);
    if (!moved) return;
    const normalized = next.map((rule, nextIndex) => ({
      ...rule,
      priority: nextIndex,
    }));
    onFilterRulesChange(normalized);
    setSelectedFilterIndexes(nextSelectedIndices);
  };

  const handleAddSortRule = () => {
    const field = sortableFields.find((entry) => !usedSortFields.has(entry.fieldKey));
    if (!field) return;
    const next: ListViewDeepSortRule[] = [
      ...sortRules,
      {
        fieldKey: field.fieldKey,
        direction: "asc",
        enabled: true,
        priority: sortRules.length,
      },
    ];
    onSortRulesChange(next);
    setSelectedSortFieldKeys([field.fieldKey]);
  };

  const handleChangeSortRule = (index: number, patch: Partial<ListViewDeepSortRule>) => {
    const currentFieldKey = sortRules[index]?.fieldKey ?? null;
    const nextSelectedFieldKey = patch.fieldKey ?? currentFieldKey;
    onSortRulesChange(
      sortRules.map((rule, currentIndex) =>
        currentIndex === index
          ? {
              ...rule,
              ...patch,
              priority: currentIndex,
            }
          : { ...rule, priority: currentIndex },
      ),
    );
    if (currentFieldKey && nextSelectedFieldKey) {
      setSelectedSortFieldKeys((currentSelection) =>
        currentSelection.includes(currentFieldKey)
          ? currentSelection.map((key) => (key === currentFieldKey ? nextSelectedFieldKey : key))
          : currentSelection,
      );
    }
  };

  const handleSortDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortRules.findIndex((rule) => rule.fieldKey === active.id);
    const newIndex = sortRules.findIndex((rule) => rule.fieldKey === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const moved = arrayMove(sortRules, oldIndex, newIndex).map((rule, nextIndex) => ({
      ...rule,
      priority: nextIndex,
    }));
    onSortRulesChange(moved);
    setSelectedSortFieldKeys([String(active.id)]);
  };

  const handleMoveSortRules = (selectedIndices: number[], direction: -1 | 1) => {
    const { next, nextSelectedIndices, moved } = moveSelectionByOne(sortRules, selectedIndices, direction);
    if (!moved) return;
    const normalized = next.map((rule, nextIndex) => ({
      ...rule,
      priority: nextIndex,
    }));
    onSortRulesChange(normalized);
    setSelectedSortFieldKeys(nextSelectedIndices.map((index) => normalized[index]?.fieldKey).filter(Boolean));
  };

  const handleRemoveSortRules = (indexesToRemove: number[]) => {
    if (indexesToRemove.length === 0) return;
    const removeSet = new Set(indexesToRemove);
    const nextRules = sortRules.filter((_, currentIndex) => !removeSet.has(currentIndex)).map((rule, currentIndex) => ({
      ...rule,
      priority: currentIndex,
    }));
    onSortRulesChange(nextRules);

    if (nextRules.length === 0) {
      setSelectedSortFieldKeys([]);
      return;
    }

    const anchor = Math.min(...indexesToRemove);
    const nextSelection = nextRules[Math.min(anchor, nextRules.length - 1)] ?? null;
    setSelectedSortFieldKeys(nextSelection?.fieldKey ? [nextSelection.fieldKey] : []);
  };

  const selectedFieldIdSet = useMemo(() => new Set(selectedFieldIds), [selectedFieldIds]);
  const selectedFieldIndices = useMemo(
    () => items.map((item, index) => (selectedFieldIdSet.has(item.id) ? index : -1)).filter((index) => index >= 0),
    [items, selectedFieldIdSet],
  );
  const selectedFieldIndexSet = useMemo(() => new Set(selectedFieldIndices), [selectedFieldIndices]);

  const selectedFilterIndices = useMemo(
    () =>
      [...new Set(selectedFilterIndexes)]
        .filter((index) => index >= 0 && index < filterRules.length)
        .sort((left, right) => left - right),
    [selectedFilterIndexes, filterRules.length],
  );
  const selectedFilterIndexSet = useMemo(() => new Set(selectedFilterIndices), [selectedFilterIndices]);

  const selectedSortFieldKeySet = useMemo(() => new Set(selectedSortFieldKeys), [selectedSortFieldKeys]);
  const selectedSortIndices = useMemo(
    () => sortRules.map((rule, index) => (selectedSortFieldKeySet.has(rule.fieldKey) ? index : -1)).filter((index) => index >= 0),
    [sortRules, selectedSortFieldKeySet],
  );
  const selectedSortIndexSet = useMemo(() => new Set(selectedSortIndices), [selectedSortIndices]);

  useEffect(() => {
    setSelectedFieldIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  useEffect(() => {
    setSelectedFilterIndexes((current) =>
      [...new Set(current)].filter((index) => index >= 0 && index < filterRules.length).sort((left, right) => left - right),
    );
  }, [filterRules.length]);

  useEffect(() => {
    setSelectedSortFieldKeys((current) => current.filter((key) => sortRules.some((rule) => rule.fieldKey === key)));
  }, [sortRules]);

  const canMoveUp =
    activeTab === "fields"
      ? selectedFieldIndices.some(
          (index) =>
            index > 0 &&
            !selectedFieldIndexSet.has(index - 1) &&
            !items[index]?.lockedOrder &&
            !items[index - 1]?.lockedOrder,
        )
      : activeTab === "filtering"
        ? selectedFilterIndices.some((index) => index > 0 && !selectedFilterIndexSet.has(index - 1))
        : selectedSortIndices.some((index) => index > 0 && !selectedSortIndexSet.has(index - 1));

  const canMoveDown =
    activeTab === "fields"
      ? selectedFieldIndices.some(
          (index) =>
            index < items.length - 1 &&
            !selectedFieldIndexSet.has(index + 1) &&
            !items[index]?.lockedOrder &&
            !items[index + 1]?.lockedOrder,
        )
      : activeTab === "filtering"
        ? selectedFilterIndices.some((index) => index < filterRules.length - 1 && !selectedFilterIndexSet.has(index + 1))
        : selectedSortIndices.some((index) => index < sortRules.length - 1 && !selectedSortIndexSet.has(index + 1));

  const canAdd =
    activeTab === "fields"
      ? false
      : activeTab === "filtering"
        ? filterableFields.length > 0
        : sortableFields.length > 0 && usedSortFields.size < sortableFields.length;

  const canDelete =
    activeTab === "fields"
      ? false
      : activeTab === "filtering"
        ? selectedFilterIndices.length > 0
        : selectedSortIndices.length > 0;

  const handleContextAdd = () => {
    if (activeTab === "filtering") {
      handleAddFilterRule();
      return;
    }
    if (activeTab === "sorting") {
      handleAddSortRule();
    }
  };

  const handleContextMove = (direction: -1 | 1) => {
    if (activeTab === "fields" && selectedFieldIndices.length > 0) {
      const { next, nextSelectedIndices, moved } = moveSelectionByOne(
        items,
        selectedFieldIndices,
        direction,
        (fromIndex, toIndex, snapshot) => !snapshot[fromIndex]?.lockedOrder && !snapshot[toIndex]?.lockedOrder,
      );
      if (!moved) return;
      onItemsChange(next);
      setSelectedFieldIds(nextSelectedIndices.map((index) => next[index]?.id).filter(Boolean));
      return;
    }
    if (activeTab === "filtering" && selectedFilterIndices.length > 0) {
      handleMoveFilterRules(selectedFilterIndices, direction);
      return;
    }
    if (activeTab === "sorting" && selectedSortIndices.length > 0) {
      handleMoveSortRules(selectedSortIndices, direction);
    }
  };

  const handleContextDelete = () => {
    if (activeTab === "fields") {
      return;
    }
    if (activeTab === "filtering" && selectedFilterIndices.length > 0) {
      handleRemoveFilterRules(selectedFilterIndices);
      return;
    }
    if (activeTab === "sorting" && selectedSortIndices.length > 0) {
      handleRemoveSortRules(selectedSortIndices);
    }
  };

  const handleFieldRowSelect = (fieldId: string, ctrlToggle: boolean) => {
    setSelectedFieldIds((current) => toggleSelection(current, fieldId, ctrlToggle));
  };

  const handleFilterRowSelect = (index: number, ctrlToggle: boolean) => {
    setSelectedFilterIndexes((current) => toggleSelection(current, index, ctrlToggle));
  };

  const handleSortRowSelect = (fieldKey: string, ctrlToggle: boolean) => {
    setSelectedSortFieldKeys((current) => toggleSelection(current, fieldKey, ctrlToggle));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex h-[min(90vh,46rem)] w-[min(52rem,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-input bg-background p-4 shadow-lg">
          <Dialog.Title className="text-base font-semibold">{t("doc.list.viewSettingsTitle")}</Dialog.Title>

          <div className="mt-3 shrink-0 rounded-md border border-input bg-muted/15 p-2.5">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {tx("doc.list.viewCurrentLabel")}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-8 min-w-[14rem] flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  value={activeViewId ?? ""}
                  onChange={(event) => handleViewSelectChange(event.target.value || null)}
                >
                  <option value="">{tx("doc.list.viewWorkingState")}</option>
                  {personalViews.map((view) => (
                    <option key={view.viewId} value={view.viewId}>
                      {view.isDefault ? `${view.name} (${tx("doc.list.viewDefaultBadge")})` : view.name}
                    </option>
                  ))}
                </select>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={tx("doc.list.viewActions")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-[120] min-w-[14rem] rounded-md border border-input bg-popover p-1 shadow-md"
                    >
                      <DropdownMenu.Item
                        className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground"
                        onSelect={openCreateViewDialog}
                      >
                        {tx("doc.list.viewActionSaveAs")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                        disabled={!activeView || !hasUnsavedChanges}
                        onSelect={(event) => {
                          event.preventDefault();
                          setConfirmingSaveChanges(true);
                        }}
                      >
                        {tx("doc.list.viewActionSaveChanges")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                        disabled={!activeView}
                        onSelect={openRenameViewDialog}
                      >
                        {tx("doc.list.viewActionRename")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-popover-foreground outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                        disabled={!activeView || activeView.isDefault}
                        onSelect={(event) => {
                          event.preventDefault();
                          onSetActiveAsDefault();
                        }}
                      >
                        {tx("doc.list.viewActionSetDefault")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-destructive outline-none hover:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                        disabled={!activeView}
                        onSelect={openDeleteViewDialog}
                      >
                        {tx("doc.list.viewActionDelete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {summary}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {activeView
                ? `${tx("doc.list.viewCurrentSaved")}: ${activeViewName ?? activeView.name}${activeView.isDefault ? ` · ${tx("doc.list.viewDefaultBadge")}` : ""}`
                : null}
            </div>
            {activeView && hasUnsavedChanges ? (
              <div className="mt-1.5 text-xs text-amber-300">
                {tx("doc.list.viewUnsavedChanges")}
              </div>
            ) : null}
            {pendingSwitchViewId !== null ? (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs">
                <div className="text-amber-200">
                  {tx("doc.list.viewSwitchUnsavedPrompt")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("save")}>
                    {tx("doc.list.viewSwitchSaveAndSwitch")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("discard")}>
                    {tx("doc.list.viewSwitchDontSave")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("cancel")}>
                    {tx("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
            {confirmingSaveChanges ? (
              <div className="mt-2 rounded-md border border-input bg-muted/20 px-2 py-2 text-xs">
                <div className="text-muted-foreground">
                  {tx("doc.list.viewSaveChangesConfirm")}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      onSaveChangesToActiveView();
                      setConfirmingSaveChanges(false);
                    }}
                  >
                    {tx("doc.list.viewActionSaveChanges")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmingSaveChanges(false)}
                  >
                    {tx("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 shrink-0 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-input bg-muted/20 p-0.5">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  activeTab === "fields" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("fields")}
              >
                {t("doc.list.viewTabFields")}
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  activeTab === "filtering" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("filtering")}
              >
                {t("doc.list.viewTabFiltering")}
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  activeTab === "sorting" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("sorting")}
              >
                {t("doc.list.viewTabSorting")}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!canAdd}
                onClick={handleContextAdd}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!canMoveUp}
                onClick={() => handleContextMove(-1)}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={!canMoveDown}
                onClick={() => handleContextMove(1)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!canDelete}
                onClick={handleContextDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="list-view-configurator__scroll mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {activeTab === "fields" ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <SortableColumnRow
                        key={item.id}
                        item={item}
                        selected={selectedFieldIdSet.has(item.id)}
                        onToggleVisible={handleToggleVisible}
                        onSelect={handleFieldRowSelect}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}

            {activeTab === "filtering" ? (
              <div className="space-y-2">
                {filterRules.length === 0 ? (
                  <div className="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                    {tx("doc.list.viewNoFilterRules")}
                  </div>
                ) : (
                  filterRules.map((rule, index) => {
                    const isSelected = selectedFilterIndexSet.has(index);
                    const field = registryByFieldKey.get(rule.fieldKey);
                    const operators = field ? getSupportedOperatorsByFieldType(field.dataType) : [];
                    const selectedOperator = operators.includes(rule.operator) ? rule.operator : operators[0];
                    const options = filterConfigs?.[rule.fieldKey]?.options ?? [];
                    const handleEditControlPointerDown = (
                      event: { preventDefault: () => void; stopPropagation: () => void },
                      ctrlToggle: boolean,
                    ) => {
                      if (ctrlToggle) {
                        event.preventDefault();
                        event.stopPropagation();
                        handleFilterRowSelect(index, true);
                        return;
                      }
                      if (!isSelected) {
                        event.preventDefault();
                        event.stopPropagation();
                        handleFilterRowSelect(index, false);
                        return;
                      }
                      event.stopPropagation();
                    };
                    const renderValueInput = () => {
                      if (!field || !selectedOperator || isNoValueOperator(selectedOperator)) {
                        return <div className="h-8" aria-hidden />;
                      }
                      if (field.dataType === "enum" && !isMultiValueOperator(selectedOperator) && options.length > 0) {
                        return (
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            value={rule.value ?? ""}
                            onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              handleChangeFilterRule(index, { value: event.target.value, valueTo: undefined, values: undefined })
                            }
                          >
                            <option value="">{tx("doc.list.viewSelectValue")}</option>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        );
                      }

                      if (isRangeOperator(selectedOperator)) {
                        const inputType = mapFieldDataTypeToInputType(field.dataType);
                        return (
                          <div className="flex min-w-0 items-center gap-2">
                            <Input
                              type={inputType}
                              className="h-8 min-w-0 flex-1 text-xs"
                              placeholder={tx("doc.list.viewFilterValueFrom")}
                              value={rule.value ?? ""}
                              onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                handleChangeFilterRule(index, { value: event.target.value, values: undefined })
                              }
                            />
                            <Input
                              type={inputType}
                              className="h-8 min-w-0 flex-1 text-xs"
                              placeholder={tx("doc.list.viewFilterValueTo")}
                              value={rule.valueTo ?? ""}
                              onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                handleChangeFilterRule(index, { valueTo: event.target.value, values: undefined })
                              }
                            />
                          </div>
                        );
                      }

                      if (isMultiValueOperator(selectedOperator)) {
                        return (
                          <Input
                            type="text"
                            className="h-8 text-xs"
                            placeholder={tx("doc.list.viewFilterValues")}
                            value={Array.isArray(rule.values) ? rule.values.join(", ") : ""}
                            onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              handleChangeFilterRule(index, {
                                values: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                                value: undefined,
                                valueTo: undefined,
                              })
                            }
                          />
                        );
                      }

                      return (
                        <Input
                          type={mapFieldDataTypeToInputType(field.dataType)}
                          className="h-8 text-xs"
                          placeholder={tx("doc.list.viewFilterValue")}
                          value={rule.value ?? ""}
                          onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            handleChangeFilterRule(index, {
                              value: event.target.value,
                              valueTo: undefined,
                              values: undefined,
                            })
                          }
                        />
                      );
                    };

                    return (
                      <div
                        key={`${rule.fieldKey}-${index}`}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                          isSelected ? "border-primary/60 bg-primary/10" : "border-input bg-background"
                        }`}
                        onClick={(event) => handleFilterRowSelect(index, event.ctrlKey || event.metaKey)}
                      >
                        <Switch
                          checked={rule.enabled}
                          aria-label={`${tx("doc.list.viewRuleEnabled")} #${index + 1}`}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(checked) => handleChangeFilterRule(index, { enabled: checked === true })}
                        />
                        <select
                          className="h-8 min-w-[9.5rem] max-w-[13rem] rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={rule.fieldKey}
                          onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const nextField = registryByFieldKey.get(event.target.value);
                            const nextOperator = nextField ? firstOperatorForField(nextField) : null;
                            handleChangeFilterRule(index, {
                              fieldKey: event.target.value,
                              operator: nextOperator ?? rule.operator,
                              value: undefined,
                              valueTo: undefined,
                              values: undefined,
                            });
                          }}
                        >
                          {filterableFields.map((entry) => (
                            <option key={entry.fieldKey} value={entry.fieldKey}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-8 w-[9.5rem] shrink-0 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={selectedOperator}
                          onPointerDown={(event) => handleEditControlPointerDown(event, event.ctrlKey || event.metaKey)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            handleChangeFilterRule(index, {
                              operator: event.target.value as AgGridFilterOperator,
                              value: undefined,
                              valueTo: undefined,
                              values: undefined,
                            })
                          }
                        >
                          {operators.map((operator) => (
                            <option key={operator} value={operator}>
                              {operatorLabel(t, operator)}
                            </option>
                          ))}
                        </select>
                        <div className="min-w-0 flex-1">{renderValueInput()}</div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            {activeTab === "sorting" ? (
              <div className="space-y-2">
                {sortRules.length === 0 ? (
                  <div className="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                    {tx("doc.list.viewNoSortRules")}
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortDragEnd}>
                    <SortableContext items={sortRules.map((rule) => rule.fieldKey)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sortRules.map((rule, index) => (
                          <SortableSortRuleRow
                            key={rule.fieldKey}
                            dndId={rule.fieldKey}
                            rule={rule}
                            index={index}
                            selected={selectedSortFieldKeySet.has(rule.fieldKey)}
                            sortableFields={sortableFields}
                            usedSortFields={usedSortFields}
                            tx={tx}
                            onSelect={(ctrlToggle) => handleSortRowSelect(rule.fieldKey, ctrlToggle)}
                            onChange={(patch) => handleChangeSortRule(index, patch)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 shrink-0 flex items-center justify-between gap-2">
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

      <Dialog.Root open={createViewDialogOpen} onOpenChange={setCreateViewDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/65" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[min(26rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-input bg-background p-4 shadow-xl">
            <Dialog.Title className="text-sm font-semibold">
              {tx("doc.list.viewActionSaveAsDialogTitle")}
            </Dialog.Title>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateView();
              }}
            >
              <Input
                autoFocus
                className="h-9 text-sm"
                value={createViewName}
                onChange={(event) => setCreateViewName(event.target.value)}
                placeholder={tx("doc.list.viewNamePlaceholder")}
              />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateViewDialogOpen(false)}>
                  {tx("common.cancel")}
                </Button>
                <Button type="submit" disabled={createViewName.trim() === ""}>
                  {tx("doc.list.viewActionSaveAs")}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={renameViewDialogOpen} onOpenChange={setRenameViewDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/65" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[min(26rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-input bg-background p-4 shadow-xl">
            <Dialog.Title className="text-sm font-semibold">
              {tx("doc.list.viewActionRenameDialogTitle")}
            </Dialog.Title>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleRenameView();
              }}
            >
              <Input
                autoFocus
                className="h-9 text-sm"
                value={renameViewName}
                onChange={(event) => setRenameViewName(event.target.value)}
                placeholder={tx("doc.list.viewNamePlaceholder")}
              />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRenameViewDialogOpen(false)}>
                  {tx("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !activeView ||
                    renameViewName.trim() === "" ||
                    renameViewName.trim() === activeView.name.trim()
                  }
                >
                  {tx("doc.list.viewActionRename")}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteViewDialogOpen} onOpenChange={setDeleteViewDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/65" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[min(24rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-destructive/40 bg-background p-4 shadow-xl">
            <Dialog.Title className="text-sm font-semibold text-foreground">
              {tx("doc.list.viewActionDeleteConfirmTitle")}
            </Dialog.Title>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx("doc.list.viewActionDeleteConfirm")}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteViewDialogOpen(false)}>
                {tx("common.cancel")}
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteView}>
                {tx("doc.list.viewActionDelete")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}
