import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { MarkdownJournalStatus } from "./model";
import type { JournalRow, MarkdownCodeRow } from "./markdownJournalListRowModel";
import type { MarkdownJournalTanstackColumnSchema } from "./markdownJournalTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

function journalStatusLabel(status: MarkdownJournalStatus, t: TFunction): string {
  switch (status) {
    case "draft":
      return t("status.factual.draft");
    case "posted":
      return t("status.factual.posted");
    case "cancelled":
      return t("status.factual.cancelled");
    default:
      return status;
  }
}

function getColumnAlign(column: MarkdownJournalTanstackColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export type FormatMarkdownMoney = (value: number, fractionDigits: number, suffix: string) => string;

export function formatMarkdownJournalTableValue(input: {
  column: MarkdownJournalTanstackColumnSchema;
  value: unknown;
  t: TFunction;
  rowIndex?: number;
}): string {
  const { column, value, t, rowIndex } = input;
  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);
  if (column.formatKind === "journal-status" && value != null && value !== "") {
    return journalStatusLabel(value as MarkdownJournalStatus, t);
  }
  if (value == null) return "";
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

export function formatMarkdownCodeTableValue(input: {
  column: MarkdownJournalTanstackColumnSchema;
  value: unknown;
  t: TFunction;
  formatMoney: FormatMarkdownMoney;
  rowIndex?: number;
}): string {
  const { column, value, t, formatMoney, rowIndex } = input;
  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);
  if (column.formatKind === "markdown-price") {
    return typeof value === "number" ? formatMoney(value, 2, "") : "";
  }
  if (value == null) return "";
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

export type BuildMarkdownJournalsTanstackColumnsInput = {
  schema: MarkdownJournalTanstackColumnSchema[];
  t: TFunction;
};

const journalHelper = createColumnHelper<JournalRow>();

export function buildMarkdownJournalsTanstackColumns(
  input: BuildMarkdownJournalsTanstackColumnsInput,
): ColumnDef<JournalRow, unknown>[] {
  const { schema, t } = input;
  return schema.map((column) => {
    const meta: ColumnMeta = { align: getColumnAlign(column) };

    if (column.id === "lineNo") {
      return journalHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) => String(ctx.row.index + 1),
        enableSorting: false,
        enableHiding: false,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "status") {
      return journalHelper.accessor("status", {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span>{journalStatusLabel(ctx.getValue() as MarkdownJournalStatus, t)}</span>
        ),
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return journalHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? column.id) as keyof JournalRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span className={meta.align === "right" ? "tabular-nums" : undefined}>
            {formatMarkdownJournalTableValue({
              column,
              value: ctx.getValue(),
              t,
              rowIndex: ctx.row.index,
            })}
          </span>
        ),
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      },
    );
  }) as ColumnDef<JournalRow, unknown>[];
}

export type BuildMarkdownCodesTanstackColumnsInput = {
  schema: MarkdownJournalTanstackColumnSchema[];
  t: TFunction;
  formatMoney: FormatMarkdownMoney;
};

const codeHelper = createColumnHelper<MarkdownCodeRow>();

export function buildMarkdownCodesTanstackColumns(
  input: BuildMarkdownCodesTanstackColumnsInput,
): ColumnDef<MarkdownCodeRow, unknown>[] {
  const { schema, t, formatMoney } = input;
  return schema.map((column) => {
    const meta: ColumnMeta = { align: getColumnAlign(column) };

    if (column.id === "lineNo") {
      return codeHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) => String(ctx.row.index + 1),
        enableSorting: false,
        enableHiding: false,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "markdownPrice") {
      return codeHelper.accessor("markdownPrice", {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span className="tabular-nums">
            {formatMoney(ctx.getValue() as number, 2, "")}
          </span>
        ),
        sortingFn: "basic",
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return codeHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? column.id) as keyof MarkdownCodeRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span className={meta.align === "right" ? "tabular-nums" : undefined}>
            {formatMarkdownCodeTableValue({
              column,
              value: ctx.getValue(),
              t,
              formatMoney,
              rowIndex: ctx.row.index,
            })}
          </span>
        ),
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      },
    );
  }) as ColumnDef<MarkdownCodeRow, unknown>[];
}
