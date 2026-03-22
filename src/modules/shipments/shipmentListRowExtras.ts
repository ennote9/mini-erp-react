import type { Shipment } from "./model";
import { carrierRepository } from "../carriers/repository";
import { buildCarrierTrackingUrl } from "../carriers";

const DELIVERY_ADDRESS_PREVIEW_MAX = 44;

function truncatePreview(text: string, max: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, Math.max(0, max - 1))}…`;
}

export type ShipmentListRowExtras = {
  /** Grid / human-readable carrier cell (em dash if none, unknown if broken id). */
  carrierLabel: string;
  /** Excel / plain export: empty when no carrier, else name or unknown. */
  carrierExport: string;
  /** Grid tracking cell: trimmed value or em dash. */
  trackingLabel: string;
  /** Export: raw trimmed tracking or empty. */
  trackingExport: string;
  /** Lowercase search haystack for carrier-related fields. */
  carrierSearchBlob: string;
  /** Trimmed tracking for search (may be empty). */
  trackingRaw: string;
  /** Resolved tracking URL when template + number are valid (read-only quick action). */
  trackingUrl: string | null;
  recipientLabel: string;
  recipientPhoneLabel: string;
  recipientExport: string;
  recipientPhoneExport: string;
  deliveryAddressExport: string;
  deliveryCommentExport: string;
  /** Compact address cell; em dash when empty. */
  deliveryAddressPreview: string;
  /** Full address for grid tooltip (empty when none). */
  deliveryAddressFull: string;
  /** Lowercase haystack: recipient, phone, address, comment. */
  deliveryMetaSearchBlob: string;
};

type RowLabels = {
  emDash: string;
  unknownCarrier: string;
};

/**
 * Phase-2 list/export fields: resolve carrier master data safely, tracking display, search blobs.
 */
export function buildShipmentListRowExtras(
  shipment: Shipment,
  labels: RowLabels,
): ShipmentListRowExtras {
  const cid = shipment.carrierId?.trim() ?? "";
  const carrier = cid ? carrierRepository.getById(cid) : undefined;
  const trackingRaw = shipment.trackingNumber?.trim() ?? "";

  let carrierLabel: string;
  let carrierExport: string;
  if (cid === "") {
    carrierLabel = labels.emDash;
    carrierExport = "";
  } else if (!carrier) {
    carrierLabel = labels.unknownCarrier;
    carrierExport = labels.unknownCarrier;
  } else {
    carrierLabel = carrier.name;
    carrierExport = carrier.name;
  }

  const trackingLabel = trackingRaw !== "" ? trackingRaw : labels.emDash;
  const trackingUrl = buildCarrierTrackingUrl(carrier?.trackingUrlTemplate, shipment.trackingNumber);

  const carrierSearchBlob = [carrier?.name, carrier?.code, cid].filter(Boolean).join(" ").toLowerCase();

  const rn = shipment.recipientName?.trim() ?? "";
  const rp = shipment.recipientPhone?.trim() ?? "";
  const da = shipment.deliveryAddress?.trim() ?? "";
  const dc = shipment.deliveryComment?.trim() ?? "";

  const recipientLabel = rn === "" ? labels.emDash : rn;
  const recipientPhoneLabel = rp === "" ? labels.emDash : rp;
  const deliveryAddressPreview =
    da === "" ? labels.emDash : truncatePreview(da, DELIVERY_ADDRESS_PREVIEW_MAX);
  const deliveryMetaSearchBlob = [rn, rp, da, dc].filter(Boolean).join(" ").toLowerCase();

  return {
    carrierLabel,
    carrierExport,
    trackingLabel,
    trackingExport: trackingRaw,
    carrierSearchBlob,
    trackingRaw,
    trackingUrl,
    recipientLabel,
    recipientPhoneLabel,
    recipientExport: rn,
    recipientPhoneExport: rp,
    deliveryAddressExport: da,
    deliveryCommentExport: dc,
    deliveryAddressPreview,
    deliveryAddressFull: da,
    deliveryMetaSearchBlob,
  };
}
