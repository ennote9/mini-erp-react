import type { MessageTree } from "../../resolve";

/** User-visible validation, document health, receipt/shipment post, and save error copy. */
export const issuesMessagesEn: MessageTree = {
  planning: {
    dateRequired: "Date is required.",
    dateFormat: "Date must be in YYYY-MM-DD format (e.g. 2025-03-15).",
    dateYearRange: "Date year must be between {{min}} and {{max}}.",
    supplierInactive: "Selected supplier is inactive.",
    customerInactive: "Selected customer is inactive.",
    warehouseInactive: "Selected warehouse is inactive.",
    zeroPriceReasonRequired:
      "Each line with zero unit price must have a zero-price reason.",
  },
  master: {
    codeRequired: "Code is required.",
    nameRequired: "Name is required.",
    nameMinLength: "Name must be at least {{min}} characters.",
    itemCodePattern: "Code may only contain letters, numbers, hyphens, and underscores.",
    uomRequired: "UOM is required.",
    uomMaxLength: "UOM must be {{max}} characters or fewer.",
    purchasePriceInvalid: "Purchase price must be a valid number.",
    purchasePriceNegative: "Purchase price cannot be negative.",
    salePriceInvalid: "Sale price must be a valid number.",
    salePriceNegative: "Sale price cannot be negative.",
    phoneFormat: "Phone format is invalid. Use only digits, spaces, +, -, and parentheses.",
    phoneDigit: "Phone must contain at least one digit.",
    emailInvalid: "Email format is invalid.",
    paymentTermsInvalid: "Payment terms must be a valid number.",
    paymentTermsNegative: "Payment terms cannot be negative.",
    paymentTermsDaysForm:
      "Payment terms must be a whole number of days ≥ 0, or leave empty.",
  },
  document: {
    supplierRequired: "Supplier is required.",
    customerRequired: "Customer is required.",
    warehouseRequired: "Warehouse is required.",
    linesRequired: "At least one line is required.",
    linesValidRequired:
      "At least one valid line is required (item and quantity).",
    inactiveItems: "Inactive items cannot be used in this document.",
    linesNoItem: "One or more lines have no item.",
    linesInvalidQty: "One or more lines have invalid or zero quantity.",
    linesInvalidUnitPrice:
      "One or more lines have an invalid unit price (must be a number ≥ 0).",
    zeroPriceMissingReasonOne:
      "One line has zero unit price without a reason. Select a zero-price reason for that line.",
    zeroPriceMissingReasonMany:
      "{{count}} lines have zero unit price without a reason.",
    zeroPriceRecordedOne: "1 line has zero unit price (reason recorded).",
    zeroPriceRecordedMany:
      "{{count}} lines have zero unit price (reasons recorded).",
    zeroLineAmountOne: "1 line has zero line amount.",
    zeroLineAmountMany: "{{count}} lines have zero line amount.",
  },
  receipt: {
    notFound: "Receipt not found.",
    onlyDraftPost: "Only draft receipts can be posted.",
    poRequired: "Related purchase order is required.",
    poMustBeConfirmed:
      "Related purchase order must be confirmed before posting.",
    warehouseRequired: "Warehouse is required.",
    warehouseInactive: "Selected warehouse is inactive.",
    linesRequired: "At least one line is required.",
    lineNeedsItem: "Each line must have an item.",
    qtyPositive: "Quantity must be greater than zero.",
    itemInactive: "Selected item is inactive.",
    duplicateItems: "Duplicate items are not allowed in the same document.",
    itemNotOnPo: "Item {{code}} is not on the related purchase order.",
    qtyExceedsRemaining:
      "Item {{code}}: receipt quantity exceeds remaining to receive (ordered {{ordered}}, already received {{already}}, this receipt {{qty}}).",
    onlyDraftCancel: "Only draft receipts can be cancelled.",
    alreadyReversed: "This receipt is already reversed.",
    onlyPostedReverse: "Only posted receipts can be reversed.",
    noLinesReverse: "Receipt has no lines; cannot reverse.",
    invalidQtyReverse:
      "One or more lines have invalid quantity for reversal.",
    insufficientStockReverse:
      "Item {{code}}: insufficient stock to reverse receipt (available {{available}}, required {{required}}).",
  },
  shipment: {
    notFound: "Shipment not found.",
    onlyDraftPost: "Only draft shipments can be posted.",
    soRequired: "Related sales order is required.",
    soMustBeConfirmed:
      "Related sales order must be confirmed before posting.",
    warehouseMismatchSo:
      "Shipment warehouse must match the related sales order warehouse.",
    warehouseRequired: "Warehouse is required.",
    warehouseInactive: "Selected warehouse is inactive.",
    linesRequired: "At least one line is required.",
    lineNeedsItem: "Each line must have an item.",
    qtyPositive: "Quantity must be greater than zero.",
    itemInactive: "Selected item is inactive.",
    duplicateItems: "Duplicate items are not allowed in the same document.",
    itemNotOnSo: "Item {{code}} is not on the related sales order.",
    qtyExceedsRemaining:
      "Item {{code}}: shipment quantity exceeds remaining to ship (ordered {{ordered}}, already shipped {{already}}, this shipment {{qty}}).",
    insufficientReserved:
      "Item {{code}}: insufficient reserved quantity to post ({{reserved}} reserved, {{required}} required). Use Allocate stock on the related sales order.",
    insufficientStockPost:
      "Item {{code}}: insufficient stock to post (available {{available}}, required {{required}}).",
    noBufferWarning:
      "Item {{code}}: no buffer remaining (shipped quantity equals available stock).",
    reservationConsumeFailed:
      "Could not consume stock reservations. Refresh and try again, or re-allocate on the sales order.",
    onlyDraftCancel: "Only draft shipments can be cancelled.",
    alreadyReversed: "This shipment is already reversed.",
    onlyPostedReverse: "Only posted shipments can be reversed.",
    noLinesReverse: "Shipment has no lines; cannot reverse.",
    invalidQtyReverse:
      "One or more lines have invalid quantity for reversal.",
  },
  import: {
    addedSkipped:
      "Added {{added}} items. Skipped {{skipped}} rows.",
  },
  reason: {
    cancelRequired: "A cancel reason is required.",
    cancelInvalid: "Select a valid cancel reason.",
    reversalRequired: "A reversal reason is required.",
    reversalInvalid: "Select a valid reversal reason.",
  },
  save: {
    brandDuplicate: "A brand with this code already exists.",
    categoryDuplicate: "A category with this code already exists.",
    supplierDuplicate: "A supplier with this code already exists.",
    customerDuplicate: "A customer with this code already exists.",
    warehouseDuplicate: "A warehouse with this code already exists.",
    itemDuplicate: "An item with this code already exists.",
    brandNotFound: "Brand not found.",
    categoryNotFound: "Category not found.",
    supplierNotFound: "Supplier not found.",
    customerNotFound: "Customer not found.",
    warehouseNotFound: "Warehouse not found.",
    itemNotFound: "Item not found.",
    brandInactive: "Selected brand is not active.",
    categoryInactive: "Selected category is not active.",
    purchasePriceValid: "Purchase price must be a valid number.",
    purchasePriceNegative: "Purchase price cannot be negative.",
    salePriceValid: "Sale price must be a valid number.",
    salePriceNegative: "Sale price cannot be negative.",
    brandSelectNotFound: "Selected brand not found.",
    categorySelectNotFound: "Selected category not found.",
    paymentTermsValid: "Payment terms must be a valid number.",
    paymentTermsNegative: "Payment terms cannot be negative.",
    poUnitPriceInvalid:
      "Each line must have a valid unit price (number ≥ 0).",
    poNotFound: "Purchase order not found.",
    poOnlyDraftSave: "Only draft purchase orders can be saved.",
    poOnlyDraftConfirm: "Only draft purchase orders can be confirmed.",
    poCancelStates: "Only draft or confirmed purchase orders can be cancelled.",
    poReceiptConfirmedOnly:
      "Only confirmed purchase orders can have a receipt created.",
    poFullyReceived: "Purchase order is already fully received (posted receipts).",
    poDraftReceiptExists:
      "A draft receipt already exists for this purchase order.",
    poNothingToReceive: "Nothing remaining to receive for this purchase order.",
    soUnitPriceInvalid:
      "Each line must have a valid unit price (number ≥ 0).",
    soNotFound: "Sales order not found.",
    soOnlyDraftSave: "Only draft sales orders can be saved.",
    soOnlyDraftConfirm: "Only draft sales orders can be confirmed.",
    soAllocateConfirmedOnly:
      "Only confirmed sales orders can allocate stock.",
    soCancelStates: "Only draft or confirmed sales orders can be cancelled.",
    soShipmentConfirmedOnly:
      "Only confirmed sales orders can have a shipment created.",
    soFullyShipped: "Sales order is already fully shipped (posted shipments).",
    soDraftShipmentExists:
      "A draft shipment already exists for this sales order.",
    soNothingToShip: "Nothing remaining to ship for this sales order.",
    itemsPersistFailed: "Could not save items to disk.",
  },
} as const;
