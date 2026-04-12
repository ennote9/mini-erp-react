import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  const fallback: Record<AgGridFilterOperator, string> = {
    contains: "Contains",
    not_contains: "Does not contain",
    equals: "Equals",
    not_equals: "Does not equal",
    starts_with: "Starts with",
    ends_with: "Ends with",
    in: "In list",
    not_in: "Not in list",
    is_empty: "Is empty",
    is_not_empty: "Is not empty",
    eq: "=",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    between: "Between",
    not_between: "Not between",
    before: "Before",
    after: "After",
    on_or_before: "On or before",
    on_or_after: "On or after",
    is_true: "Is true",
    is_false: "Is false",
  };
  const key = `gridFilters.operators.${operator}`;
  const translated = t(key);
  return translated === key ? fallback[operator] : translated;
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
  const filterableFields = useMemo(
    () => registry.filter((entry) => entry.filterable && visibleFieldKeys.has(entry.fieldKey)),
    [registry, visibleFieldKeys],
  );
  const sortableFields = useMemo(
    () => registry.filter((entry) => entry.sortable && visibleFieldKeys.has(entry.fieldKey)),
    [registry, visibleFieldKeys],
  );
  const usedSortFields = useMemo(() => new Set(sortRules.map((rule) => rule.fieldKey)), [sortRules]);
  const activeView = useMemo(
    () => personalViews.find((view) => view.viewId === activeViewId) ?? null,
    [personalViews, activeViewId],
  );
  const [pendingSwitchViewId, setPendingSwitchViewId] = useState<string | null>(null);
  const [confirmingSaveChanges, setConfirmingSaveChanges] = useState(false);
  const [confirmingDeleteView, setConfirmingDeleteView] = useState(false);

  const tx = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const summary = useMemo(() => {
    const visibleFields = items.filter((item) => item.visible).length;
    const activeFilters = filterRules.filter((rule) => rule.enabled).length;
    const activeSorts = sortRules.filter((rule) => rule.enabled).length;
    return `${visibleFields} ${tx("doc.list.viewSummaryFields", "fields")} · ${activeFilters} ${tx("doc.list.viewSummaryFilters", "filters")} · ${activeSorts} ${tx("doc.list.viewSummarySorts", "sorts")}`;
  }, [items, filterRules, sortRules]);

  const handleCreateView = () => {
    const name = window.prompt(
      tx("doc.list.viewActionSaveAsPrompt", "Enter a name for the new view"),
      "",
    );
    if (name == null) return;
    const trimmed = name.trim();
    if (trimmed === "") return;
    onCreateView(trimmed);
  };

  const handleRenameView = () => {
    if (!activeView) return;
    const name = window.prompt(
      tx("doc.list.viewActionRenamePrompt", "Enter a new name"),
      activeView.name,
    );
    if (name == null) return;
    const trimmed = name.trim();
    if (trimmed === "") return;
    onRenameActiveView(trimmed);
  };

  const handleDeleteView = () => {
    if (!activeView) return;
    setConfirmingDeleteView(true);
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

  const handleMove = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((x) => x.id === id);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const target = items[targetIndex];
    if (target.lockedOrder) return;
    onItemsChange(arrayMove(items, index, targetIndex));
  };

  const handleAddFilterRule = () => {
    const field = filterableFields[0];
    if (!field) return;
    const operator = firstOperatorForField(field);
    if (!operator) return;
    onFilterRulesChange([
      ...filterRules,
      {
        fieldKey: field.fieldKey,
        operator,
        enabled: false,
        priority: filterRules.length,
      },
    ]);
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

  const handleRemoveFilterRule = (index: number) => {
    onFilterRulesChange(filterRules.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleAddSortRule = () => {
    const field = sortableFields.find((entry) => !usedSortFields.has(entry.fieldKey)) ?? sortableFields[0];
    if (!field) return;
    onSortRulesChange([
      ...sortRules,
      {
        fieldKey: field.fieldKey,
        direction: "asc",
        enabled: true,
        priority: sortRules.length,
      },
    ]);
  };

  const handleChangeSortRule = (index: number, patch: Partial<ListViewDeepSortRule>) => {
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
  };

  const handleMoveSortRule = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortRules.length) return;
    onSortRulesChange(arrayMove(sortRules, index, targetIndex));
  };

  const handleRemoveSortRule = (index: number) => {
    onSortRulesChange(sortRules.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(52rem,94vw)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-input bg-background p-4 shadow-lg">
          <Dialog.Title className="text-base font-semibold">{t("doc.list.viewSettingsTitle")}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {t("doc.list.viewSettingsDescription")}
          </Dialog.Description>

          <div className="mt-3 rounded-md border border-input bg-muted/15 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[14rem] flex-1">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {tx("doc.list.viewCurrentLabel", "Current view")}
                </div>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  value={activeViewId ?? ""}
                  onChange={(event) => handleViewSelectChange(event.target.value || null)}
                >
                  <option value="">{tx("doc.list.viewWorkingState", "Working state")}</option>
                  {personalViews.map((view) => (
                    <option key={view.viewId} value={view.viewId}>
                      {view.isDefault ? `${view.name} (${tx("doc.list.viewDefaultBadge", "Default")})` : view.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleCreateView}>
                  {tx("doc.list.viewActionSaveAs", "Save as new")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setConfirmingSaveChanges(true)}
                  disabled={!activeView || !hasUnsavedChanges}
                >
                  {tx("doc.list.viewActionSaveChanges", "Save changes")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleRenameView}
                  disabled={!activeView}
                >
                  {tx("doc.list.viewActionRename", "Rename")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteView}
                  disabled={!activeView}
                >
                  {tx("doc.list.viewActionDelete", "Delete")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onSetActiveAsDefault}
                  disabled={!activeView || activeView.isDefault}
                >
                  {tx("doc.list.viewActionSetDefault", "Set default")}
                </Button>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {summary}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {activeView
                ? `${tx("doc.list.viewCurrentSaved", "Active saved view")}: ${activeViewName ?? activeView.name}${activeView.isDefault ? ` · ${tx("doc.list.viewDefaultBadge", "Default")}` : ""}`
                : tx("doc.list.viewUsingSystemBaseline", "You are using the system/working baseline.")}
            </div>
            {personalViews.length === 0 ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {tx("doc.list.viewEmptyHint", "No saved views yet. Save current configuration as a new view.")}
              </div>
            ) : null}
            {activeView && hasUnsavedChanges ? (
              <div className="mt-1.5 text-xs text-amber-300">
                {tx("doc.list.viewUnsavedChanges", "Current working state differs from the saved active view.")}
              </div>
            ) : null}
            {pendingSwitchViewId !== null ? (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs">
                <div className="text-amber-200">
                  {tx("doc.list.viewSwitchUnsavedPrompt", "You have unsaved changes. Save before switching view?")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("save")}>
                    {tx("doc.list.viewSwitchSaveAndSwitch", "Save and switch")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("discard")}>
                    {tx("doc.list.viewSwitchDontSave", "Don't save")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => resolvePendingSwitch("cancel")}>
                    {tx("common.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
            {confirmingSaveChanges ? (
              <div className="mt-2 rounded-md border border-input bg-muted/20 px-2 py-2 text-xs">
                <div className="text-muted-foreground">
                  {tx("doc.list.viewSaveChangesConfirm", "Overwrite the active saved view with current working state?")}
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
                    {tx("doc.list.viewActionSaveChanges", "Save changes")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmingSaveChanges(false)}
                  >
                    {tx("common.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
            {confirmingDeleteView ? (
              <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-xs">
                <div className="text-destructive/90">
                  {tx("doc.list.viewActionDeleteConfirm", "Delete current personal view?")}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      onDeleteActiveView();
                      setConfirmingDeleteView(false);
                    }}
                  >
                    {tx("doc.list.viewActionDelete", "Delete")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmingDeleteView(false)}
                  >
                    {tx("common.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 inline-flex rounded-md border border-input bg-muted/20 p-0.5">
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

          <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {activeTab === "fields" ? (
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
            ) : null}

            {activeTab === "filtering" ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{tx("doc.list.viewFilteringHint", "Rules are applied with AND logic.")}</div>
                {filterRules.length === 0 ? (
                  <div className="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                    {tx("doc.list.viewNoFilterRules", "No filter rules")}
                  </div>
                ) : (
                  filterRules.map((rule, index) => {
                    const field = registryByFieldKey.get(rule.fieldKey);
                    const operators = field ? getSupportedOperatorsByFieldType(field.dataType) : [];
                    const selectedOperator = operators.includes(rule.operator) ? rule.operator : operators[0];
                    const options = filterConfigs?.[rule.fieldKey]?.options ?? [];
                    const renderValueInput = () => {
                      if (!field || !selectedOperator || isNoValueOperator(selectedOperator)) return null;
                      if (field.dataType === "enum" && !isMultiValueOperator(selectedOperator) && options.length > 0) {
                        return (
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            value={rule.value ?? ""}
                            onChange={(event) =>
                              handleChangeFilterRule(index, { value: event.target.value, valueTo: undefined, values: undefined })
                            }
                          >
                            <option value="">{tx("doc.list.viewSelectValue", "Select value")}</option>
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
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type={inputType}
                              className="h-8 text-xs"
                              placeholder={tx("doc.list.viewFilterValueFrom", "From")}
                              value={rule.value ?? ""}
                              onChange={(event) =>
                                handleChangeFilterRule(index, { value: event.target.value, values: undefined })
                              }
                            />
                            <Input
                              type={inputType}
                              className="h-8 text-xs"
                              placeholder={tx("doc.list.viewFilterValueTo", "To")}
                              value={rule.valueTo ?? ""}
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
                            placeholder={tx("doc.list.viewFilterValues", "Values separated by commas")}
                            value={Array.isArray(rule.values) ? rule.values.join(", ") : ""}
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
                          placeholder={tx("doc.list.viewFilterValue", "Value")}
                          value={rule.value ?? ""}
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
                      <div key={`${rule.fieldKey}-${index}`} className="rounded-md border border-input bg-background px-2 py-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {tx("doc.list.viewRuleNumber", "Rule")} #{index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Checkbox
                                checked={rule.enabled}
                                onCheckedChange={(checked) => handleChangeFilterRule(index, { enabled: checked === true })}
                              />
                              {tx("doc.list.viewRuleEnabled", "Enabled")}
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemoveFilterRule(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.25fr,1fr]">
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            value={rule.fieldKey}
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
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            value={selectedOperator}
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
                        </div>
                        <div className="mt-2">{renderValueInput()}</div>
                      </div>
                    );
                  })
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddFilterRule}
                  disabled={filterableFields.length === 0}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {tx("doc.list.viewAddFilterRule", "Add filter rule")}
                </Button>
              </div>
            ) : null}

            {activeTab === "sorting" ? (
              <div className="space-y-2">
                {sortRules.length === 0 ? (
                  <div className="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                    {tx("doc.list.viewNoSortRules", "No sort rules")}
                  </div>
                ) : (
                  sortRules.map((rule, index) => (
                    <div key={`${rule.fieldKey}-${index}`} className="rounded-md border border-input bg-background px-2 py-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {tx("doc.list.viewSortPriority", "Priority")} #{index + 1}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleMoveSortRule(index, -1)}
                            disabled={index <= 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleMoveSortRule(index, 1)}
                            disabled={index >= sortRules.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleRemoveSortRule(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr,0.9fr,0.7fr]">
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={rule.fieldKey}
                          onChange={(event) => handleChangeSortRule(index, { fieldKey: event.target.value })}
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
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={rule.direction}
                          onChange={(event) =>
                            handleChangeSortRule(index, { direction: event.target.value as "asc" | "desc" })
                          }
                        >
                          <option value="asc">{tx("doc.list.viewSortAsc", "Ascending")}</option>
                          <option value="desc">{tx("doc.list.viewSortDesc", "Descending")}</option>
                        </select>
                        <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Checkbox
                            checked={rule.enabled}
                            onCheckedChange={(checked) => handleChangeSortRule(index, { enabled: checked === true })}
                          />
                          {tx("doc.list.viewRuleEnabled", "Enabled")}
                        </label>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSortRule}
                  disabled={sortableFields.length === 0}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {tx("doc.list.viewAddSortRule", "Add sort rule")}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                {t("doc.list.columnSettingsReset")}
              </Button>
              <div className="text-[11px] text-muted-foreground">
                {tx(
                  "doc.list.viewResetHint",
                  "Reset returns to active view baseline, or system baseline when no saved view is active.",
                )}
              </div>
            </div>
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
