import type { LabelElement } from "../model";

export type NewLabelElementType = LabelElement["type"];

function newId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a new element with non-zero geometry inside the template bounds.
 */
export function createDefaultLabelElement(
  type: NewLabelElementType,
  sizeMm: { width: number; height: number },
): LabelElement {
  const id = newId();
  const pad = 2;
  const w = Math.max(sizeMm.width, 10);
  const h = Math.max(sizeMm.height, 10);
  const innerW = Math.max(w - pad * 2, 6);
  const innerH = Math.max(h - pad * 2, 6);

  switch (type) {
    case "text":
      return {
        id,
        type: "text",
        xMm: pad,
        yMm: pad + 1,
        widthMm: innerW,
        heightMm: Math.min(10, innerH * 0.35),
        rotation: 0,
        text: "Text",
        binding: { kind: "field", path: "item.name" },
        style: { fontSizeMm: 2.5, fontWeight: "normal", textAlign: "left" },
      };
    case "barcode":
      return {
        id,
        type: "barcode",
        xMm: pad + innerW * 0.05,
        yMm: pad + innerH * 0.2,
        widthMm: Math.max(innerW * 0.9, 20),
        heightMm: Math.min(16, innerH * 0.45),
        rotation: 0,
        binding: { kind: "primary_barcode" },
        options: { showHumanReadableText: true, symbologyHint: "CODE_128" },
      };
    case "qr": {
      const side = Math.min(innerW, innerH) * 0.55;
      const off = (Math.min(innerW, innerH) - side) / 2 + pad * 0.5;
      return {
        id,
        type: "qr",
        xMm: off,
        yMm: off,
        widthMm: Math.max(side, 12),
        heightMm: Math.max(side, 12),
        rotation: 0,
        binding: { kind: "primary_barcode" },
        options: { errorCorrection: "M" },
      };
    }
    case "image":
      return {
        id,
        type: "image",
        xMm: pad,
        yMm: pad + 4,
        widthMm: Math.max(innerW * 0.85, 16),
        heightMm: Math.min(14, innerH * 0.4),
        rotation: 0,
        fit: "contain",
        src: "",
      };
    case "shape":
      return {
        id,
        type: "shape",
        xMm: pad,
        yMm: pad,
        widthMm: innerW,
        heightMm: innerH,
        rotation: 0,
        shapeKind: "rect",
        style: { strokeMm: 0.25, stroke: "#333333" },
      };
  }
}
