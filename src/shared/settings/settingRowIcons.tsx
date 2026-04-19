import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Boxes,
  Calculator,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  Eraser,
  FileLock2,
  FileText,
  Hand,
  HardDrive,
  Hash,
  Info,
  Keyboard,
  Languages,
  MessageSquareX,
  Package,
  PackageMinus,
  PackageSearch,
  RefreshCcw,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldBan,
  SunMoon,
  Undo2,
  UserX,
} from "lucide-react";

/**
 * Small Lucide icon per registry row (`entry.id`). Keeps Settings rows scannable without changing copy.
 */
export const SETTING_ROW_ICON_BY_ID: Readonly<Record<string, LucideIcon>> = {
  "general.locale": Languages,
  "general.theme": SunMoon,
  "general.dateFormat": CalendarDays,
  "general.numberFormat": Hash,
  "general.hotkeysEnabled": Keyboard,

  "documents.blockConfirmWhenPlanningHasBlockingErrors": ShieldAlert,
  "documents.blockPostWhenFactualHasBlockingErrors": ShieldBan,
  "documents.showDocumentEventLog": ScrollText,
  "documents.requireCancelReason": MessageSquareX,
  "documents.requireReversalReason": Undo2,
  "documents.autoClosePlanningOnFullFulfillment": CheckCircle2,
  "documents.singleDraftReceiptPerPurchaseOrder": ClipboardList,
  "documents.singleDraftShipmentPerSalesOrder": Package,
  "documents.reversalOnlyFromPosted": FileLock2,

  "inventory.stockReservationsInfo": Boxes,
  "inventory.requireReservationBeforeShipment": PackageSearch,
  "inventory.allocationManualInfo": Hand,
  "inventory.releaseReservationsOnSalesOrderCancel": UserX,
  "inventory.releaseReservationsOnSalesOrderClose": PackageMinus,
  "inventory.reconcileReservationsOnSalesOrderSaveConfirm": RefreshCcw,

  "commercial.moneyDecimalPlaces": Coins,
  "commercial.zeroPriceLinesRequireReason": BadgeDollarSign,
  "commercial.partnerTermsOverwrite": Scale,
  "commercial.dueDateFromTermsInfo": CalendarClock,
  "commercial.manualUnitPricePlanningInfo": Calculator,

  "dataAudit.documentEventsInfo": FileText,
  "dataAudit.showAppVersion": Info,
  "dataAudit.backupRestore": HardDrive,
  "dataAudit.resetDemo": Eraser,
};

export function settingRowIconForEntryId(id: string): LucideIcon | undefined {
  return SETTING_ROW_ICON_BY_ID[id];
}
