import { useEffect, useMemo, useState } from "react";
import type { ColDef, IHeaderParams } from "ag-grid-community";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n/context";
import type {
  AgGridColumnFilterClause,
  AgGridColumnFilterModel,
  AgGridFilterKind,
  AgGridFilterOperator,
} from "@/shared/navigation/agGridColumnFilters";

type FilterPrimitive = string | number | boolean | null | undefined;

export type AgGridColumnFilterOption = {
  value: string;
  label: string;
};

export type AgGridColumnFilterConfig<T> = {
  kind: AgGridFilterKind;
  getValue?: (row: T) => FilterPrimitive | FilterPrimitive[];
  operators?: AgGridFilterOperator[];
  options?: AgGridColumnFilterOption[];
};

type DraftState = {
  operator: AgGridFilterOperator;
  value: string;
  valueTo: string;
  values: string[];
};

type HeaderParams = IHeaderParams & {
  filterConfig?: AgGridColumnFilterConfig<unknown>;
  filterClause?: AgGridColumnFilterClause | null;
  onApplyColumnFilter?: (colId: string, clause: AgGridColumnFilterClause) => void;
  onResetColumnFilter?: (colId: string) => void;
};

const FILTERABLE_KINDS = new Set<AgGridFilterKind>(["text", "enum", "number", "date", "datetime", "boolean"]);

export function defaultOperatorsForKind(kind: AgGridFilterKind): AgGridFilterOperator[] {
  switch (kind) {
    case "text":
      return [
        "contains",
        "not_contains",
        "equals",
        "not_equals",
        "starts_with",
        "ends_with",
        "in",
        "not_in",
        "is_empty",
        "is_not_empty",
      ];
    case "enum":
      return ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"];
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "not_between", "is_empty", "is_not_empty"];
    case "date":
      return [
        "equals",
        "not_equals",
        "before",
        "after",
        "on_or_before",
        "on_or_after",
        "between",
        "not_between",
        "is_empty",
        "is_not_empty",
      ];
    case "datetime":
      return ["equals", "not_equals", "before", "after", "between", "not_between", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false", "is_empty", "is_not_empty"];
  }
}

function isNoValueOperator(operator: AgGridFilterOperator): boolean {
  return (
    operator === "is_empty" ||
    operator === "is_not_empty" ||
    operator === "is_true" ||
    operator === "is_false"
  );
}

function isMultiValueOperator(operator: AgGridFilterOperator): boolean {
  return operator === "in" || operator === "not_in";
}

function isRangeOperator(operator: AgGridFilterOperator): boolean {
  return operator === "between" || operator === "not_between";
}

function getFilterColId<T>(colDef: ColDef<T>): string | null {
  return (typeof colDef.colId === "string" && colDef.colId.trim() !== ""
    ? colDef.colId
    : typeof colDef.field === "string" && colDef.field.trim() !== ""
      ? colDef.field
      : null);
}

function normalizeText(value: FilterPrimitive): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function normalizeTextArray(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeCandidates(value: FilterPrimitive | FilterPrimitive[]): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(normalizeText);
}

function parseNumberValue(value: FilterPrimitive): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: FilterPrimitive): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateTimeValue(value: FilterPrimitive): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function isEmptyCandidate(candidate: string): boolean {
  return candidate.trim() === "";
}

function evaluateText(values: string[], clause: AgGridColumnFilterClause): boolean {
  const normalizedValues = values.map((value) => value.toLowerCase());
  const rawValue = (clause.value ?? "").trim().toLowerCase();
  const rawValues = (clause.values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);

  switch (clause.operator) {
    case "contains":
      return normalizedValues.some((value) => value.includes(rawValue));
    case "not_contains":
      return normalizedValues.every((value) => !value.includes(rawValue));
    case "equals":
      return normalizedValues.some((value) => value === rawValue);
    case "not_equals":
      return normalizedValues.every((value) => value !== rawValue);
    case "starts_with":
      return normalizedValues.some((value) => value.startsWith(rawValue));
    case "ends_with":
      return normalizedValues.some((value) => value.endsWith(rawValue));
    case "in":
      return normalizedValues.some((value) => rawValues.includes(value));
    case "not_in":
      return normalizedValues.every((value) => !rawValues.includes(value));
    case "is_empty":
      return normalizedValues.every(isEmptyCandidate);
    case "is_not_empty":
      return normalizedValues.some((value) => !isEmptyCandidate(value));
    default:
      return true;
  }
}

function evaluateEnum(values: string[], clause: AgGridColumnFilterClause): boolean {
  return evaluateText(values, clause);
}

function evaluateNumber(value: FilterPrimitive, clause: AgGridColumnFilterClause): boolean {
  const candidate = parseNumberValue(value);
  const left = parseNumberValue(clause.value ?? "");
  const right = parseNumberValue(clause.valueTo ?? "");

  switch (clause.operator) {
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    case "eq":
      return candidate != null && left != null && candidate === left;
    case "neq":
      return candidate != null && left != null && candidate !== left;
    case "gt":
      return candidate != null && left != null && candidate > left;
    case "gte":
      return candidate != null && left != null && candidate >= left;
    case "lt":
      return candidate != null && left != null && candidate < left;
    case "lte":
      return candidate != null && left != null && candidate <= left;
    case "between":
      return candidate != null && left != null && right != null && candidate >= left && candidate <= right;
    case "not_between":
      return candidate != null && left != null && right != null && (candidate < left || candidate > right);
    default:
      return true;
  }
}

function evaluateDateLike(
  kind: "date" | "datetime",
  value: FilterPrimitive,
  clause: AgGridColumnFilterClause,
): boolean {
  const parser = kind === "date" ? parseDateValue : parseDateTimeValue;
  const candidate = parser(value);
  const left = parser(clause.value ?? "");
  const right = parser(clause.valueTo ?? "");

  switch (clause.operator) {
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    case "equals":
      return candidate != null && left != null && candidate === left;
    case "not_equals":
      return candidate != null && left != null && candidate !== left;
    case "before":
      return candidate != null && left != null && candidate < left;
    case "after":
      return candidate != null && left != null && candidate > left;
    case "on_or_before":
      return candidate != null && left != null && candidate <= left;
    case "on_or_after":
      return candidate != null && left != null && candidate >= left;
    case "between":
      return candidate != null && left != null && right != null && candidate >= left && candidate <= right;
    case "not_between":
      return candidate != null && left != null && right != null && (candidate < left || candidate > right);
    default:
      return true;
  }
}

function evaluateBoolean(value: FilterPrimitive, clause: AgGridColumnFilterClause): boolean {
  const candidate =
    typeof value === "boolean" ? value : normalizeText(value) === "" ? null : normalizeText(value).toLowerCase() === "true";
  switch (clause.operator) {
    case "is_true":
      return candidate === true;
    case "is_false":
      return candidate === false;
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    default:
      return true;
  }
}

function isValidClause<T>(clause: AgGridColumnFilterClause | null | undefined, config?: AgGridColumnFilterConfig<T>): clause is AgGridColumnFilterClause {
  if (!clause || !config || !FILTERABLE_KINDS.has(config.kind)) return false;
  const operators = config.operators ?? defaultOperatorsForKind(config.kind);
  if (!operators.includes(clause.operator)) return false;
  if (isNoValueOperator(clause.operator)) return true;
  if (isRangeOperator(clause.operator)) {
    return !!(clause.value?.trim() && clause.valueTo?.trim());
  }
  if (isMultiValueOperator(clause.operator)) {
    return Array.isArray(clause.values) && clause.values.some((value) => value.trim() !== "");
  }
  return !!clause.value?.trim();
}

export function applyAgGridColumnFilters<T>(
  rows: T[],
  model: AgGridColumnFilterModel,
  configs: Record<string, AgGridColumnFilterConfig<T>>,
): T[] {
  const activeEntries = Object.entries(model).filter(([colId, clause]) => isValidClause(clause, configs[colId]));
  if (activeEntries.length === 0) return rows;
  return rows.filter((row) =>
    activeEntries.every(([colId, clause]) => {
      const config = configs[colId];
      const value: FilterPrimitive | FilterPrimitive[] = config.getValue
        ? config.getValue(row)
        : ((row as Record<string, unknown>)[colId] as FilterPrimitive | FilterPrimitive[]);
      switch (config.kind) {
        case "text":
          return evaluateText(normalizeCandidates(value), clause);
        case "enum":
          return evaluateEnum(normalizeCandidates(value), clause);
        case "number":
          return evaluateNumber(Array.isArray(value) ? value[0] : value, clause);
        case "date":
          return evaluateDateLike("date", Array.isArray(value) ? value[0] : value, clause);
        case "datetime":
          return evaluateDateLike("datetime", Array.isArray(value) ? value[0] : value, clause);
        case "boolean":
          return evaluateBoolean(Array.isArray(value) ? value[0] : value, clause);
        default:
          return true;
      }
    }),
  );
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

function uiLabel(t: (key: string) => string, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function sortActionLabel(
  t: (key: string) => string,
  action: "asc" | "desc" | "clear",
): string {
  const key =
    action === "asc"
      ? "gridFilters.sortAscending"
      : action === "desc"
        ? "gridFilters.sortDescending"
        : "gridFilters.clearSort";
  const fallback =
    action === "asc"
      ? "Sort ascending"
      : action === "desc"
        ? "Sort descending"
        : "Clear sort";
  return uiLabel(t, key, fallback);
}

function draftFromClause(
  config: AgGridColumnFilterConfig<unknown>,
  clause?: AgGridColumnFilterClause | null,
): DraftState {
  const operator =
    clause?.operator && (config.operators ?? defaultOperatorsForKind(config.kind)).includes(clause.operator)
      ? clause.operator
      : (config.operators ?? defaultOperatorsForKind(config.kind))[0];
  return {
    operator,
    value: clause?.value ?? "",
    valueTo: clause?.valueTo ?? "",
    values: clause?.values ?? [],
  };
}

function clauseFromDraft(draft: DraftState): AgGridColumnFilterClause {
  if (isNoValueOperator(draft.operator)) {
    return { operator: draft.operator };
  }
  if (isRangeOperator(draft.operator)) {
    return { operator: draft.operator, value: draft.value, valueTo: draft.valueTo };
  }
  if (isMultiValueOperator(draft.operator)) {
    return { operator: draft.operator, values: draft.values };
  }
  return { operator: draft.operator, value: draft.value };
}

function isDraftComplete(draft: DraftState): boolean {
  if (isNoValueOperator(draft.operator)) return true;
  if (isRangeOperator(draft.operator)) return draft.value.trim() !== "" && draft.valueTo.trim() !== "";
  if (isMultiValueOperator(draft.operator)) return draft.values.some((value) => value.trim() !== "");
  return draft.value.trim() !== "";
}

function parseMultiValueInput(raw: string): string[] {
  return normalizeTextArray(raw);
}

function AgGridColumnFilterHeader(props: HeaderParams) {
  const { t } = useTranslation();
  const config = props.filterConfig;
  const filterClause = props.filterClause ?? null;
  const filterColId = props.column.getColId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() =>
    draftFromClause(config ?? { kind: "text" }, filterClause),
  );
  const [optionSearch, setOptionSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    (props.column.getSort() as "asc" | "desc" | null) ?? null,
  );

  useEffect(() => {
    const sync = () => setSortDirection((props.column.getSort() as "asc" | "desc" | null) ?? null);
    props.column.addEventListener("sortChanged", sync);
    return () => props.column.removeEventListener("sortChanged", sync);
  }, [props.column]);

  useEffect(() => {
    if (!open && config) {
      setDraft(draftFromClause(config, filterClause));
      setOptionSearch("");
    }
  }, [open, config, filterClause]);

  const options = useMemo(() => config?.options ?? [], [config]);
  const visibleOptions = useMemo(() => {
    const q = optionSearch.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, optionSearch]);

  if (!config) {
    return <span className="truncate">{props.displayName}</span>;
  }

  const operators = config.operators ?? defaultOperatorsForKind(config.kind);
  const active = isValidClause(filterClause, config);
  const sortActive = sortDirection !== null;

  const applyDraft = () => {
    if (!props.onApplyColumnFilter || !isDraftComplete(draft)) return;
    props.onApplyColumnFilter(filterColId, clauseFromDraft(draft));
    setOpen(false);
  };

  const resetDraft = () => {
    props.onResetColumnFilter?.(filterColId);
    setOpen(false);
  };

  const applySort = (sort: "asc" | "desc" | null) => {
    props.api.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: filterColId, sort }],
      applyOrder: false,
    });
  };

  const valueInputType =
    config.kind === "number"
      ? "number"
      : config.kind === "date"
        ? "date"
        : config.kind === "datetime"
          ? "datetime-local"
          : "text";

  const renderValueInputs = () => {
    if (isNoValueOperator(draft.operator) || config.kind === "boolean") return null;

    if (config.kind === "enum") {
      if (isMultiValueOperator(draft.operator)) {
        return (
          <div className="space-y-2">
            <Input
              value={optionSearch}
              onChange={(event) => setOptionSearch(event.target.value)}
              placeholder={uiLabel(t, "gridFilters.searchOptions", "Search values")}
              className="h-7 text-xs"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-input p-1.5">
              {visibleOptions.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {visibleOptions.map((option) => {
                    const checked = draft.values.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              values: checked
                                ? current.values.filter((value) => value !== option.value)
                                : [...current.values, option.value],
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {uiLabel(t, "gridFilters.noMatchingOptions", "No matching values")}
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <select
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
          value={draft.value}
          onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
        >
          <option value="">{uiLabel(t, "gridFilters.selectSingleValue", "Select value")}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (config.kind === "text" && isMultiValueOperator(draft.operator)) {
      return (
        <Textarea
          value={draft.values.join(", ")}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              values: parseMultiValueInput(event.target.value),
            }))
          }
          rows={3}
          placeholder={uiLabel(t, "gridFilters.multiValuePlaceholder", "One value per line or separated by commas")}
          className="min-h-[56px] text-xs"
        />
      );
    }

    if (isRangeOperator(draft.operator)) {
      return (
        <div className="grid grid-cols-1 gap-1.5">
          <Input
            type={valueInputType}
            value={draft.value}
            onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
            placeholder={uiLabel(t, "gridFilters.valueFrom", "From")}
            className="h-7 text-xs"
          />
          <Input
            type={valueInputType}
            value={draft.valueTo}
            onChange={(event) => setDraft((current) => ({ ...current, valueTo: event.target.value }))}
            placeholder={uiLabel(t, "gridFilters.valueTo", "To")}
            className="h-7 text-xs"
          />
        </div>
      );
    }

    return (
      <Input
        type={valueInputType}
        value={draft.value}
        onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
        placeholder={uiLabel(t, "gridFilters.value", "Value")}
        className="h-7 text-xs"
      />
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && config) setDraft(draftFromClause(config, filterClause));
        setOpen(nextOpen);
        if (!nextOpen) setOptionSearch("");
      }}
    >
      <PopoverAnchor asChild>
        <div className="flex h-full w-full items-center justify-between gap-0.5">
          <span className={`truncate pr-1 text-xs font-medium ${active ? "text-primary" : "text-foreground"}`}>
            {props.displayName}
          </span>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`relative flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded transition-colors ${
                active || sortActive
                  ? "text-primary hover:bg-accent hover:text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              aria-label={uiLabel(t, "gridFilters.columnMenu", "Column menu")}
            >
              <ChevronDown className="h-3 w-3" />
              {active ? <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={2}
        className="w-[17.5rem] space-y-2 p-2.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-0.5">
          <div className="text-sm font-semibold leading-none">{props.displayName}</div>
          <div className="text-[11px] leading-snug text-muted-foreground">
            {uiLabel(t, "gridFilters.columnMenuDescription", "Sort and filter this column")}
          </div>
        </div>
        <div className="space-y-1.5 border-b border-border pb-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            {uiLabel(t, "gridFilters.sortSection", "Sort")}
          </div>
          <div className="grid grid-cols-1 gap-1">
            <Button
              type="button"
              variant={sortDirection === "asc" ? "default" : "outline"}
              size="sm"
              className="h-7 justify-start px-2 text-xs"
              onClick={() => applySort("asc")}
            >
              <ArrowUp className="mr-1.5 h-3 w-3" />
              {sortActionLabel(t, "asc")}
            </Button>
            <Button
              type="button"
              variant={sortDirection === "desc" ? "default" : "outline"}
              size="sm"
              className="h-7 justify-start px-2 text-xs"
              onClick={() => applySort("desc")}
            >
              <ArrowDown className="mr-1.5 h-3 w-3" />
              {sortActionLabel(t, "desc")}
            </Button>
            <Button
              type="button"
              variant={sortDirection === null ? "default" : "outline"}
              size="sm"
              className="h-7 justify-start px-2 text-xs"
              onClick={() => applySort(null)}
            >
              <ArrowUpDown className="mr-1.5 h-3 w-3" />
              {sortActionLabel(t, "clear")}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            {uiLabel(t, "gridFilters.filterSection", "Filter")}
          </div>
          <Label className="text-[11px]">{uiLabel(t, "gridFilters.operatorLabel", "Operator")}</Label>
          <select
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
            value={draft.operator}
            onChange={(event) =>
              setDraft({
                operator: event.target.value as AgGridFilterOperator,
                value: "",
                valueTo: "",
                values: [],
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
        {renderValueInputs()}
        <div className="flex items-center justify-end gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={resetDraft}>
            {uiLabel(t, "gridFilters.reset", "Reset")}
          </Button>
          <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={!isDraftComplete(draft)} onClick={applyDraft}>
            <Check className="mr-1 h-3 w-3" />
            {uiLabel(t, "gridFilters.ok", "OK")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function decorateAgGridColumnDefsWithFilters<T>(
  columnDefs: ColDef<T>[],
  filterConfigs: Record<string, AgGridColumnFilterConfig<T>>,
  filterModel: AgGridColumnFilterModel,
  onApplyColumnFilter: (colId: string, clause: AgGridColumnFilterClause) => void,
  onResetColumnFilter: (colId: string) => void,
): ColDef<T>[] {
  return columnDefs.map((columnDef) => {
    const colId = getFilterColId(columnDef);
    if (!colId) return columnDef;
    const filterConfig = filterConfigs[colId];
    if (!filterConfig) return columnDef;
    return {
      ...columnDef,
      headerComponent: AgGridColumnFilterHeader,
      headerComponentParams: {
        filterConfig,
        filterClause: filterModel[colId] ?? null,
        onApplyColumnFilter,
        onResetColumnFilter,
      },
    };
  });
}
