import { markdownRepository } from "./repository";
import type { MarkdownJournal, MarkdownJournalLine, MarkdownRecord } from "./model";

type LegacySeedState = {
  journals: MarkdownJournal[];
  lines: MarkdownJournalLine[];
};

function journalNumberFromIndex(index: number): string {
  return `MJ${String(index + 1).padStart(8, "0")}`;
}

function legacyGroupKey(record: MarkdownRecord): string {
  const batchId = record.batchId?.trim();
  if (batchId) return `batch:${batchId}`;
  return `record:${record.id}`;
}

function lineGroupKey(record: MarkdownRecord): string {
  return [
    record.itemId,
    String(record.markdownPrice),
    record.reasonCode,
  ].join("|");
}

function sortLegacyRecords(a: MarkdownRecord, b: MarkdownRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
  return a.id.localeCompare(b.id);
}

function buildLegacySeedState(): LegacySeedState {
  const records = markdownRepository.list().slice().sort(sortLegacyRecords);
  const groups = new Map<string, MarkdownRecord[]>();

  for (const record of records) {
    const key = legacyGroupKey(record);
    const prev = groups.get(key);
    if (prev) prev.push(record);
    else groups.set(key, [record]);
  }

  const journals: MarkdownJournal[] = [];
  const lines: MarkdownJournalLine[] = [];
  let lineId = 1;

  Array.from(groups.values()).forEach((group, journalIndex) => {
    const first = group[0];
    const journalId = String(journalIndex + 1);
    const legacySourceIds = Array.from(
      new Set(
        group.flatMap((record) => {
          const keys = [record.id];
          if (record.batchId?.trim()) keys.push(record.batchId.trim());
          return keys;
        }),
      ),
    );

    journals.push({
      id: journalId,
      number: journalNumberFromIndex(journalIndex),
      status: "posted",
      warehouseId: first.warehouseId,
      comment: group.find((x) => x.comment?.trim())?.comment,
      createdAt: first.createdAt,
      createdBy: first.createdBy,
      postedAt: first.createdAt,
      postedBy: first.createdBy,
      legacySourceIds,
    });

    const lineGroups = new Map<string, MarkdownRecord[]>();
    group.forEach((record) => {
      const key = lineGroupKey(record);
      const prev = lineGroups.get(key);
      if (prev) prev.push(record);
      else lineGroups.set(key, [record]);
    });

    Array.from(lineGroups.values()).forEach((lineRecords, lineIndex) => {
      const source = lineRecords[0];
      lines.push({
        id: String(lineId++),
        journalId,
        sortOrder: lineIndex + 1,
        itemId: source.itemId,
        markdownPrice: source.markdownPrice,
        quantity: lineRecords.length,
        reasonCode: source.reasonCode,
      });
    });
  });

  return { journals, lines };
}

export function buildSeedMarkdownJournalsFromLegacyRecords(): MarkdownJournal[] {
  return buildLegacySeedState().journals;
}

export function buildSeedMarkdownJournalLinesFromLegacyRecords(): MarkdownJournalLine[] {
  return buildLegacySeedState().lines;
}
