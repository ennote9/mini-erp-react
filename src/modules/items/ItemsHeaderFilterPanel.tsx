import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n/context";
import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterConfig } from "@/shared/ui/ag-grid";
import {
  getSupportedOperatorsByFieldType,
  type ListViewDeepFilterRule,
  type ListViewFieldDataType,
  type ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid/listViewConfig";

type AnchorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  open: boolean;
  anchorRect: AnchorRect | null;
  field: ListViewFieldRegistryEntry | null;
  filterConfig?: AgGridColumnFilterConfig<unknown>;
  rule: ListViewDeepFilterRule | null;
  onOpenChange: (open: boolean) => void;
  onApply: (rule: ListViewDeepFilterRule) => void;
  onReset: () => void;
};

type DraftState = {
  operator: AgGridFilterOperator;
  value: string;
  valueTo: string;
  valuesText: string;
};

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

function firstOperatorForField(field: ListViewFieldRegistryEntry | null): AgGridFilterOperator | null {
  if (!field) return null;
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

function buildDraft(field: ListViewFieldRegistryEntry | null, rule: ListViewDeepFilterRule | null): DraftState | null {
  const fallbackOperator = firstOperatorForField(field);
  if (!field || !fallbackOperator) return null;
  const supportedOperators = getSupportedOperatorsByFieldType(field.dataType);
  const operator =
    rule && supportedOperators.includes(rule.operator) ? rule.operator : fallbackOperator;
  return {
    operator,
    value: rule?.value ?? "",
    valueTo: rule?.valueTo ?? "",
    valuesText: Array.isArray(rule?.values) ? rule!.values!.join(", ") : "",
  };
}

function canApplyDraft(draft: DraftState | null): boolean {
  if (!draft) return false;
  if (isNoValueOperator(draft.operator)) return true;
  if (isRangeOperator(draft.operator)) return draft.value.trim() !== "" && draft.valueTo.trim() !== "";
  if (isMultiValueOperator(draft.operator)) {
    return draft.valuesText
      .split(",")
      .map((value) => value.trim())
      .some(Boolean);
  }
  return draft.value.trim() !== "";
}

export function ItemsHeaderFilterPanel(props: Props) {
  const { open, anchorRect, field, filterConfig, rule, onOpenChange, onApply, onReset } = props;
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftState | null>(() => buildDraft(field, rule));

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(field, rule));
  }, [open, field, rule]);

  const operators = useMemo(
    () => (field ? getSupportedOperatorsByFieldType(field.dataType) : []),
    [field],
  );
  const options = filterConfig?.options ?? [];
  const canApply = canApplyDraft(draft);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchorRect ? (
        <PopoverAnchor asChild>
          <div
            className="pointer-events-none fixed z-40"
            style={{
              left: anchorRect.left,
              top: anchorRect.top,
              width: anchorRect.width,
              height: anchorRect.height,
            }}
            aria-hidden
          />
        </PopoverAnchor>
      ) : null}
      <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80">
        <PopoverHeader className="mb-3">
          <PopoverTitle>{field?.label ?? t("doc.list.viewTabFiltering")}</PopoverTitle>
          <PopoverDescription>{t("doc.list.viewTabFiltering")}</PopoverDescription>
        </PopoverHeader>

        {!field || !draft ? (
          <div className="text-sm text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("gridFilters.operatorLabel")}</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={draft.operator}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          operator: event.target.value as AgGridFilterOperator,
                          value: "",
                          valueTo: "",
                          valuesText: "",
                        }
                      : current,
                  )
                }
              >
                {operators.map((operator) => (
                  <option key={operator} value={operator}>
                    {operatorLabel(t, operator)}
                  </option>
                ))}
              </select>
            </div>

            {isNoValueOperator(draft.operator) ? null : field.dataType === "enum" && !isMultiValueOperator(draft.operator) && options.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("doc.list.viewFilterValue")}</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={draft.value}
                  onChange={(event) => setDraft((current) => (current ? { ...current, value: event.target.value } : current))}
                >
                  <option value="">{t("doc.list.viewSelectValue")}</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : isRangeOperator(draft.operator) ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("doc.list.viewFilterValueFrom")}</Label>
                  <Input
                    type={mapFieldDataTypeToInputType(field.dataType)}
                    value={draft.value}
                    onChange={(event) => setDraft((current) => (current ? { ...current, value: event.target.value } : current))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("doc.list.viewFilterValueTo")}</Label>
                  <Input
                    type={mapFieldDataTypeToInputType(field.dataType)}
                    value={draft.valueTo}
                    onChange={(event) => setDraft((current) => (current ? { ...current, valueTo: event.target.value } : current))}
                  />
                </div>
              </div>
            ) : isMultiValueOperator(draft.operator) ? (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("doc.list.viewFilterValues")}</Label>
                <Textarea
                  className="min-h-24 text-sm"
                  placeholder={t("doc.list.viewFilterValues")}
                  value={draft.valuesText}
                  onChange={(event) => setDraft((current) => (current ? { ...current, valuesText: event.target.value } : current))}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("doc.list.viewFilterValue")}</Label>
                <Input
                  type={mapFieldDataTypeToInputType(field.dataType)}
                  value={draft.value}
                  onChange={(event) => setDraft((current) => (current ? { ...current, value: event.target.value } : current))}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={t("doc.list.columnSettingsReset")}
                aria-label={t("doc.list.columnSettingsReset")}
                onClick={onReset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t("common.cancel")}
                  aria-label={t("common.cancel")}
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  title={t("common.apply")}
                  aria-label={t("common.apply")}
                  disabled={!canApply}
                  onClick={() => {
                    if (!field || !draft) return;
                    const nextRule: ListViewDeepFilterRule = {
                      fieldKey: field.fieldKey,
                      operator: draft.operator,
                      value: isNoValueOperator(draft.operator) || isMultiValueOperator(draft.operator) ? undefined : draft.value.trim() || undefined,
                      valueTo: isRangeOperator(draft.operator) ? draft.valueTo.trim() || undefined : undefined,
                      values: isMultiValueOperator(draft.operator)
                        ? draft.valuesText
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                        : undefined,
                      enabled: true,
                      priority: rule?.priority ?? 0,
                    };
                    onApply(nextRule);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
