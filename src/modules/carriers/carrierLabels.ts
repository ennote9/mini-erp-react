import type { TFunction } from "@/shared/i18n/resolve";
import { isCarrierTypeId } from "./model";

/** Localized label for a stored carrier type id (stable internal keys). */
export function translateCarrierType(t: TFunction, type: string): string {
  if (isCarrierTypeId(type)) {
    return t(`master.carrier.types.${type}`);
  }
  return type;
}
