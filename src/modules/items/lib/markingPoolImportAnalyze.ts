import type { Item } from "../model";
import type { ItemMarkingRecord, ItemMarkingRecordKind } from "../model/itemMarkingRecord";
import { buildBarcodeToItemsMap, buildItemLookup, matchSingleImportRow } from "./parseLabelDataImport";
import { markingRowToMatchImportRow, type ParsedMarkingPoolRow } from "./parseMarkingPoolImport";

export type MarkingPoolReviewStatus =
  | "applicable"
  | "not_found"
  | "ambiguous"
  | "invalid_kind"
  | "missing_payload"
  | "duplicate_in_file"
  | "duplicate_existing"
  | "conflict_payload_other_item";

export type MarkingPoolReviewRow = {
  lineIndex: number;
  status: MarkingPoolReviewStatus;
  rawCode?: string;
  rawBarcode?: string;
  payload: string;
  kind: ItemMarkingRecordKind | null;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  candidateIds?: string[];
  reason?: string;
  resolvedItemId?: string;
};

export type MarkingPoolImportAnalysisOptions = {
  ambiguousResolution: Record<number, string | undefined>;
  allowDuplicatePayloadInFile: boolean;
};

export type MarkingPoolImportAnalysis = {
  reviewRows: MarkingPoolReviewRow[];
  applicableRows: ParsedMarkingPoolRow[];
  applicableResolvedItemIds: Map<number, string>;
  stats: {
    totalRows: number;
    applicableCount: number;
    notFound: number;
    ambiguous: number;
    invalidKind: number;
    missingPayload: number;
    duplicateInFile: number;
    duplicateExisting: number;
    conflictOtherItem: number;
  };
};

function normPayload(p: string): string {
  return p.trim();
}

/** payload (trimmed) -> itemIds that already hold this payload (non-VOID records). */
function buildExistingPayloadToItemIds(records: readonly ItemMarkingRecord[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.status === "VOID") continue;
    const k = normPayload(r.payload);
    if (!k) continue;
    const set = m.get(k) ?? new Set<string>();
    set.add(r.itemId);
    m.set(k, set);
  }
  return m;
}

function baseReview(
  row: ParsedMarkingPoolRow,
  partial: Partial<Omit<MarkingPoolReviewRow, "lineIndex" | "payload">>,
): MarkingPoolReviewRow {
  return {
    lineIndex: row.lineIndex,
    payload: row.payload,
    kind: row.markingKind,
    rawCode: row.rawCode,
    rawBarcode: row.rawBarcode,
    ...partial,
  } as MarkingPoolReviewRow;
}

export function analyzeMarkingPoolImport(
  rows: readonly ParsedMarkingPoolRow[],
  items: readonly Item[],
  existingRecords: readonly ItemMarkingRecord[],
  options: MarkingPoolImportAnalysisOptions,
): MarkingPoolImportAnalysis {
  const { byCode, byBarcode: _byBarcode } = buildItemLookup(items);
  void _byBarcode;
  const barcodeToItems = buildBarcodeToItemsMap(items);
  const existingByPayload = buildExistingPayloadToItemIds(existingRecords);

  const payloadKey = (r: ParsedMarkingPoolRow) => normPayload(r.payload);
  const filePayloadCounts = new Map<string, number>();
  for (const row of rows) {
    const k = payloadKey(row);
    if (!k) continue;
    filePayloadCounts.set(k, (filePayloadCounts.get(k) ?? 0) + 1);
  }

  const reviewRows: MarkingPoolReviewRow[] = [];
  const applicableRows: ParsedMarkingPoolRow[] = [];
  const applicableResolvedItemIds = new Map<number, string>();

  const stats = {
    totalRows: rows.length,
    applicableCount: 0,
    notFound: 0,
    ambiguous: 0,
    invalidKind: 0,
    missingPayload: 0,
    duplicateInFile: 0,
    duplicateExisting: 0,
    conflictOtherItem: 0,
  };

  for (const row of rows) {
    const kind = row.markingKind;
    const payloadN = normPayload(row.payload);

    if (!kind) {
      stats.invalidKind++;
      reviewRows.push(baseReview(row, { status: "invalid_kind", kind: null, reason: "invalid_kind" }));
      continue;
    }

    if (!payloadN) {
      stats.missingPayload++;
      reviewRows.push(baseReview(row, { status: "missing_payload", kind, reason: "missing_payload" }));
      continue;
    }

    const match = matchSingleImportRow(markingRowToMatchImportRow(row), byCode, barcodeToItems);
    let item: Item | undefined;
    const resolvedPick = options.ambiguousResolution[row.lineIndex];

    if (match.kind === "found") {
      item = match.item;
    } else if (match.kind === "not_found") {
      stats.notFound++;
      reviewRows.push(baseReview(row, { status: "not_found", kind, reason: "not_found" }));
      continue;
    } else {
      const candidateIds = match.candidates.map((c) => c.id);
      item = resolvedPick ? match.candidates.find((c) => c.id === resolvedPick) : undefined;
      if (!item) {
        stats.ambiguous++;
        reviewRows.push(
          baseReview(row, {
            status: "ambiguous",
            kind,
            candidateIds,
            reason: "ambiguous",
            resolvedItemId: resolvedPick,
          }),
        );
        continue;
      }
    }

    const itemId = item!.id;

    const dupCount = filePayloadCounts.get(payloadN) ?? 0;
    if (dupCount > 1 && !options.allowDuplicatePayloadInFile) {
      stats.duplicateInFile++;
      reviewRows.push(
        baseReview(row, {
          status: "duplicate_in_file",
          kind,
          itemId,
          itemCode: item!.code,
          itemName: item!.name,
          reason: "duplicate_in_file",
        }),
      );
      continue;
    }

    const owners = existingByPayload.get(payloadN);
    if (owners && owners.size > 0) {
      if (owners.has(itemId)) {
        stats.duplicateExisting++;
        reviewRows.push(
          baseReview(row, {
            status: "duplicate_existing",
            kind,
            itemId,
            itemCode: item!.code,
            itemName: item!.name,
            reason: "duplicate_existing",
          }),
        );
      } else {
        stats.conflictOtherItem++;
        reviewRows.push(
          baseReview(row, {
            status: "conflict_payload_other_item",
            kind,
            itemId,
            itemCode: item!.code,
            itemName: item!.name,
            reason: "conflict_payload_other_item",
          }),
        );
      }
      continue;
    }

    stats.applicableCount++;
    applicableRows.push(row);
    applicableResolvedItemIds.set(row.lineIndex, itemId);
    reviewRows.push(
      baseReview(row, {
        status: "applicable",
        kind,
        itemId,
        itemCode: item!.code,
        itemName: item!.name,
      }),
    );
  }

  return { reviewRows, applicableRows, applicableResolvedItemIds, stats };
}
