import type { LabelBinding } from "./labelBinding";

/** Shared geometry for all elements (mm). */
export type LabelElementBase = {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation?: number;
};

export type LabelTextStyle = {
  fontSizeMm?: number;
  fontWeight?: "normal" | "bold";
  textAlign?: "left" | "center" | "right";
};

export type LabelBarcodeOptions = {
  /** Future: symbology hint when rendering is implemented. */
  symbologyHint?: string;
  showHumanReadableText?: boolean;
};

export type LabelQrOptions = {
  errorCorrection?: "L" | "M" | "Q" | "H";
};

export type LabelImageFit = "contain" | "cover" | "fill";

export type LabelShapeKind = "rect" | "line" | "ellipse";

export type LabelShapeStyle = {
  strokeMm?: number;
  fill?: string;
  stroke?: string;
};

export type LabelTextElement = LabelElementBase & {
  type: "text";
  text?: string;
  binding?: LabelBinding;
  style?: LabelTextStyle;
};

export type LabelBarcodeElement = LabelElementBase & {
  type: "barcode";
  binding: LabelBinding;
  options?: LabelBarcodeOptions;
};

export type LabelQrElement = LabelElementBase & {
  type: "qr";
  binding: LabelBinding;
  options?: LabelQrOptions;
};

export type LabelImageElement = LabelElementBase & {
  type: "image";
  binding?: LabelBinding;
  src?: string;
  fit?: LabelImageFit;
};

export type LabelShapeElement = LabelElementBase & {
  type: "shape";
  shapeKind: LabelShapeKind;
  style?: LabelShapeStyle;
};

export type LabelElement =
  | LabelTextElement
  | LabelBarcodeElement
  | LabelQrElement
  | LabelImageElement
  | LabelShapeElement;
