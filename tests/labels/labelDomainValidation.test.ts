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

  it("flags KIZ when kiz, marking, gs1 payload are all empty", () => {
    const codes = collectLabelDomainIssueCodes(
      tpl("KIZ_LABEL"),
      baseCtx({ kizCode: "", markingCode: "", gs1DataMatrixPayload: "" }),
    );
    expect(codes).toContain("kizMarkingMissing");
  });

  it("allows KIZ when marking code is set", () => {
    const codes = collectLabelDomainIssueCodes(tpl("KIZ_LABEL"), baseCtx({ markingCode: "01059" }));
    expect(codes.filter((c) => c === "kizMarkingMissing")).toHaveLength(0);
  });

  it("flags DataMatrix label when payloads and marking are empty", () => {
    const codes = collectLabelDomainIssueCodes(
      tpl("DATAMATRIX_LABEL"),
      baseCtx({ dataMatrixPayload: "", gs1DataMatrixPayload: "", markingCode: "" }),
    );
    expect(codes).toContain("datamatrixSourceMissing");
  });

  it("allows DataMatrix label when dataMatrixPayload is set", () => {
    const codes = collectLabelDomainIssueCodes(tpl("DATAMATRIX_LABEL"), baseCtx({ dataMatrixPayload: "DM1" }));
    expect(codes.filter((c) => c === "datamatrixSourceMissing")).toHaveLength(0);
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
        binding: { kind: "field", path: "item.markingCode" },
        options: { symbologyHint: "DATAMATRIX" },
      },
      {
        id: "b2",
        type: "barcode",
        xMm: 0,
        yMm: 0,
        widthMm: 10,
        heightMm: 10,
        binding: { kind: "field", path: "item.markingCode" },
        options: { symbologyHint: "GS1_DATAMATRIX" },
      },
    ]);
    const codes = collectLabelDomainIssueCodes(template, baseCtx({ markingCode: "" }));
    expect(codes.filter((c) => c === "matrixBindingEmpty")).toHaveLength(1);
  });
});
