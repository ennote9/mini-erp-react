import { actionIssue, type Issue } from "../issues";

type I18n = { key: string; params?: Record<string, string | number> };

const EXACT: Record<string, I18n> = {
  "Date is required.": { key: "issues.planning.dateRequired" },
  "Date must be in YYYY-MM-DD format (e.g. 2025-03-15).": {
    key: "issues.planning.dateFormat",
  },
  "Supplier is required.": { key: "issues.document.supplierRequired" },
  "Customer is required.": { key: "issues.document.customerRequired" },
  "Selected supplier is inactive.": { key: "issues.planning.supplierInactive" },
  "Selected customer is inactive.": { key: "issues.planning.customerInactive" },
  "Selected warehouse is inactive.": { key: "issues.planning.warehouseInactive" },
  "At least one line is required.": { key: "issues.document.linesRequired" },
  "Each line must have an item.": { key: "issues.receipt.lineNeedsItem" },
  "Quantity must be greater than zero.": { key: "issues.receipt.qtyPositive" },
  "Selected item is inactive.": { key: "issues.receipt.itemInactive" },
  "Duplicate items are not allowed in the same document.": {
    key: "issues.receipt.duplicateItems",
  },
  "Each line with zero unit price must have a zero-price reason.": {
    key: "issues.planning.zeroPriceReasonRequired",
  },
  "Payment terms must be a whole number of days ≥ 0, or leave empty.": {
    key: "issues.master.paymentTermsDaysForm",
  },
  "Only draft purchase orders can be confirmed.": {
    key: "issues.save.poOnlyDraftConfirm",
  },
  "Only draft sales orders can be confirmed.": {
    key: "issues.save.soOnlyDraftConfirm",
  },
  "Receipt not found.": { key: "issues.receipt.notFound" },
  "Only draft receipts can be cancelled.": { key: "issues.receipt.onlyDraftCancel" },
  "This receipt is already reversed.": { key: "issues.receipt.alreadyReversed" },
  "Only posted receipts can be reversed.": { key: "issues.receipt.onlyPostedReverse" },
  "Receipt has no lines; cannot reverse.": { key: "issues.receipt.noLinesReverse" },
  /** Same English string for receipt and shipment reversal validation */
  "One or more lines have invalid quantity for reversal.": {
    key: "issues.receipt.invalidQtyReverse",
  },
  "Shipment not found.": { key: "issues.shipment.notFound" },
  "Only draft shipments can be cancelled.": { key: "issues.shipment.onlyDraftCancel" },
  "This shipment is already reversed.": { key: "issues.shipment.alreadyReversed" },
  "Only posted shipments can be reversed.": { key: "issues.shipment.onlyPostedReverse" },
  "Shipment has no lines; cannot reverse.": { key: "issues.shipment.noLinesReverse" },
  "A cancel reason is required.": { key: "issues.reason.cancelRequired" },
  "Select a valid cancel reason.": { key: "issues.reason.cancelInvalid" },
  "A reversal reason is required.": { key: "issues.reason.reversalRequired" },
  "Select a valid reversal reason.": { key: "issues.reason.reversalInvalid" },
  "Code is required.": { key: "issues.master.codeRequired" },
  "Name is required.": { key: "issues.master.nameRequired" },
  "UOM is required.": { key: "issues.master.uomRequired" },
  "Code may only contain letters, numbers, hyphens, and underscores.": {
    key: "issues.master.itemCodePattern",
  },
  "Phone format is invalid. Use only digits, spaces, +, -, and parentheses.": {
    key: "issues.master.phoneFormat",
  },
  "Phone must contain at least one digit.": { key: "issues.master.phoneDigit" },
  "Email format is invalid.": { key: "issues.master.emailInvalid" },
  "Payment terms must be a valid number.": { key: "issues.save.paymentTermsValid" },
  "Payment terms cannot be negative.": { key: "issues.save.paymentTermsNegative" },
  "A brand with this code already exists.": { key: "issues.save.brandDuplicate" },
  "A category with this code already exists.": { key: "issues.save.categoryDuplicate" },
  "A supplier with this code already exists.": { key: "issues.save.supplierDuplicate" },
  "A customer with this code already exists.": { key: "issues.save.customerDuplicate" },
  "A warehouse with this code already exists.": { key: "issues.save.warehouseDuplicate" },
  "An item with this code already exists.": { key: "issues.save.itemDuplicate" },
  "Brand not found.": { key: "issues.save.brandNotFound" },
  "Category not found.": { key: "issues.save.categoryNotFound" },
  "Supplier not found.": { key: "issues.save.supplierNotFound" },
  "Customer not found.": { key: "issues.save.customerNotFound" },
  "Warehouse not found.": { key: "issues.save.warehouseNotFound" },
  "Item not found.": { key: "issues.save.itemNotFound" },
  "Selected brand not found.": { key: "issues.save.brandSelectNotFound" },
  "Selected brand is not active.": { key: "issues.save.brandInactive" },
  "Selected category not found.": { key: "issues.save.categorySelectNotFound" },
  "Selected category is not active.": { key: "issues.save.categoryInactive" },
  "Purchase price must be a valid number.": { key: "issues.save.purchasePriceValid" },
  "Purchase price cannot be negative.": { key: "issues.save.purchasePriceNegative" },
  "Sale price must be a valid number.": { key: "issues.save.salePriceValid" },
  "Sale price cannot be negative.": { key: "issues.save.salePriceNegative" },
  "Each line must have a valid unit price (number ≥ 0).": {
    key: "issues.save.poUnitPriceInvalid",
  },
  "Purchase order not found.": { key: "issues.save.poNotFound" },
  "Only draft purchase orders can be saved.": { key: "issues.save.poOnlyDraftSave" },
  "Only draft or confirmed purchase orders can be cancelled.": {
    key: "issues.save.poCancelStates",
  },
  "Only confirmed purchase orders can have a receipt created.": {
    key: "issues.save.poReceiptConfirmedOnly",
  },
  "Purchase order is already fully received (posted receipts).": {
    key: "issues.save.poFullyReceived",
  },
  "A draft receipt already exists for this purchase order.": {
    key: "issues.save.poDraftReceiptExists",
  },
  "Nothing remaining to receive for this purchase order.": {
    key: "issues.save.poNothingToReceive",
  },
  "Sales order not found.": { key: "issues.save.soNotFound" },
  "Only draft sales orders can be saved.": { key: "issues.save.soOnlyDraftSave" },
  "Only confirmed sales orders can allocate stock.": {
    key: "issues.save.soAllocateConfirmedOnly",
  },
  "Warehouse is required.": { key: "issues.document.warehouseRequired" },
  "Only draft or confirmed sales orders can be cancelled.": {
    key: "issues.save.soCancelStates",
  },
  "Only confirmed sales orders can have a shipment created.": {
    key: "issues.save.soShipmentConfirmedOnly",
  },
  "Sales order is already fully shipped (posted shipments).": {
    key: "issues.save.soFullyShipped",
  },
  "A draft shipment already exists for this sales order.": {
    key: "issues.save.soDraftShipmentExists",
  },
  "Nothing remaining to ship for this sales order.": {
    key: "issues.save.soNothingToShip",
  },
  "Could not consume stock reservations. Refresh and try again, or re-allocate on the sales order.":
    {
      key: "issues.shipment.reservationConsumeFailed",
    },
  "Could not save items to disk.": { key: "issues.save.itemsPersistFailed" },
};

function tryDynamic(message: string): I18n | undefined {
  let m = message.match(
    /^Item (.+): insufficient stock to reverse receipt \(available ([\d.]+), required ([\d.]+)\)\.$/,
  );
  if (m) {
    return {
      key: "issues.receipt.insufficientStockReverse",
      params: { code: m[1], available: m[2], required: m[3] },
    };
  }
  m = message.match(/^Item (.+) is not on the related purchase order\.$/);
  if (m) return { key: "issues.receipt.itemNotOnPo", params: { code: m[1] } };

  m = message.match(
    /^Item (.+): receipt quantity exceeds remaining to receive \(ordered ([\d.]+), already received ([\d.]+), this receipt ([\d.]+)\)\.$/,
  );
  if (m) {
    return {
      key: "issues.receipt.qtyExceedsRemaining",
      params: {
        code: m[1],
        ordered: m[2],
        already: m[3],
        qty: m[4],
      },
    };
  }

  m = message.match(/^Item (.+) is not on the related sales order\.$/);
  if (m) return { key: "issues.shipment.itemNotOnSo", params: { code: m[1] } };

  m = message.match(
    /^Item (.+): shipment quantity exceeds remaining to ship \(ordered ([\d.]+), already shipped ([\d.]+), this shipment ([\d.]+)\)\.$/,
  );
  if (m) {
    return {
      key: "issues.shipment.qtyExceedsRemaining",
      params: {
        code: m[1],
        ordered: m[2],
        already: m[3],
        qty: m[4],
      },
    };
  }

  m = message.match(
    /^Item (.+): insufficient reserved quantity to post \(([\d.]+) reserved, ([\d.]+) required\)\. Use Allocate stock on the related sales order\.$/,
  );
  if (m) {
    return {
      key: "issues.shipment.insufficientReserved",
      params: { code: m[1], reserved: m[2], required: m[3] },
    };
  }

  m = message.match(
    /^Item (.+): insufficient stock to post \(available ([\d.]+), required ([\d.]+)\)\.$/,
  );
  if (m) {
    return {
      key: "issues.shipment.insufficientStockPost",
      params: { code: m[1], available: m[2], required: m[3] },
    };
  }

  m = message.match(
    /^Item (.+): no buffer remaining \(shipped quantity equals available stock\)\.$/,
  );
  if (m) return { key: "issues.shipment.noBufferWarning", params: { code: m[1] } };

  m = message.match(/^Name must be at least (\d+) characters\.$/);
  if (m) {
    return { key: "issues.master.nameMinLength", params: { min: Number(m[1]) } };
  }

  m = message.match(/^UOM must be (\d+) characters or fewer\.$/);
  if (m) {
    return { key: "issues.master.uomMaxLength", params: { max: Number(m[1]) } };
  }

  m = message.match(/^Date year must be between (\d+) and (\d+)\.$/);
  if (m) {
    return {
      key: "issues.planning.dateYearRange",
      params: { min: Number(m[1]), max: Number(m[2]) },
    };
  }

  return undefined;
}

/**
 * Wraps a service or API English error string as an Issue with i18n when known.
 * Unknown strings still display as-is (English fallback).
 */
export function actionIssueFromServiceMessage(message: string): Issue {
  const dyn = tryDynamic(message);
  if (dyn) return actionIssue(message, dyn);
  const exact = EXACT[message];
  if (exact) return actionIssue(message, exact);
  return actionIssue(message);
}
