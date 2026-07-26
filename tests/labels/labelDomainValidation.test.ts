import { describe, expect, it } from "vitest";
import type { LabelTemplate } from "@/modules/labels/model";
import type { LabelPreviewBindingContext } from "@/modules/labels/lib/previewContext";
import { collectLabelDomainIssueCodes } from "@/modules/labels/lib/labelDomainValidation";

const baseCtx = (overrides: Partial<LabelPreviewBindingContext["item"]> = {}): LabelPreviewBindingContext => ({
  item: {
    name: "N",
    code: "C",
    salePrice: "0",
    ...overrides,
  },
  selectedBarcode: "5900000000000",
  primaryBarcode: "5900000000000",
});

const tpl = (kind: LabelTemplate["kind"], elements: LabelTemplate["elements"] = []): LabelTemplate =>
  ({
    id: "t1",
    name: "T",
    kind,
    paperType: "LABEL",
    sizeMm: { width: 50, height: 30 },
    isActive: true,
    isDefault: false,
    isArchived: false,
    isSystem: false,
    createdAt: "x",
    updatedAt: "x",
    elements,
  }) as LabelTemplate;

describe("collectLabelDomainIssueCodes", () => {
  it("flags translation sticker when all translation display fields are empty", () => {
    const codes = collectLabelDomainIssueCodes(
      tpl("TRANSLATION_STICKER"),
      baseCtx({
        translationName: "",
        translationDescription: "",
        translationComposition: "",
        translationExtraText: "",
      }),
    );
    expect(codes).toContain("translationContentMissing");
  });

  it("allows translation sticker when any translation display field is set", () => {
    const codes = collectLabelDomainIssueCodes(
      tpl("TRANSLATION_STICKER"),
      baseCtx({ translationExtraText: "note" }),
    );
    expect(codes.filter((c) => c === "translationContentMissing")).toHaveLength(0);
  });

  it("dedupes matrixBindingEmpty across multiple DataMatrix elements", () => {
    const template = tpl("ITEM_LABEL", [
      {
        id: "b1",
        type: "barcode",
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        binding: { kind: "field", path: "item.translationName" },
        options: { symbologyHint: "DATAMATRIX" },
      },
      {
        id: "b2",
        type: "barcode",
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        binding: { kind: "field", path: "item.translationName" },
        options: { symbologyHint: "GS1_DATAMATRIX" },
      },
    ]);
    const codes = collectLabelDomainIssueCodes(template, baseCtx({ translationName: "" }));
    expect(codes.filter((c) => c === "matrixBindingEmpty")).toHaveLength(1);
  });

  it("allows DataMatrix elements to use an ordinary item barcode", () => {
    const template = tpl("DATAMATRIX_LABEL", [
      {
        id: "b1",
        type: "barcode",
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        binding: { kind: "primary_barcode" },
        options: { symbologyHint: "DATAMATRIX" },
      },
    ]);
    const codes = collectLabelDomainIssueCodes(template, baseCtx());
    expect(codes).not.toContain("matrixBindingEmpty");
  });
});
