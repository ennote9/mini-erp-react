/** Operational screens: modals, strips, list-page copy beyond doc.list. */
export const opsEn = {
  issueStrip: {
    label: "Document issues",
    error: "error",
    errors: "errors",
    warning: "warning",
    warnings: "warnings",
    collapseAria: "Collapse issues",
    expandAria: "Show full issue list",
    errorsTitle: "Errors",
    warningsTitle: "Warnings",
  },
  importModal: {
    title: "Add lines",
    subtitle:
      "Paste item codes/barcodes or import an Excel file. Review the preview before adding lines.",
    tabPaste: "Paste",
    tabExcel: "Excel",
    pasteLabel: "Paste one item code/barcode per line, or code/barcode + qty",
    pastePlaceholder: "ITEM-001\nITEM-002 2\n1234567890123\t3",
    preview: "Preview",
    excelHint: "Expected columns: Item Code or Barcode, Qty, optional Unit Price.",
    parsing: "Parsing…",
    chooseXlsx: "Choose .xlsx file",
    downloadTemplate: "Download template",
    templateDownloaded: "Template downloaded",
    openFile: "Open file",
    openFolder: "Open folder",
    dismiss: "Dismiss",
    parseError: "Failed to parse Excel file.",
    filterAll: "All ({{count}})",
    filterErrors: "Errors ({{count}})",
    filterValid: "Valid ({{count}})",
    noErrorRows: "No error rows.",
    noValidRows: "No valid rows.",
    addAllValid: "Add all valid lines",
    addAllValidTitle: "Add all valid lines (Ctrl/Cmd+Enter)",
    excelFileFilterName: "Excel",
    rowStatus: {
      valid: "Valid",
      inactive: "Inactive",
      not_found: "Not found",
      invalid_quantity: "Invalid quantity",
      invalid_format: "Invalid format",
      header_skipped: "Header skipped",
    },
    summaryPaste:
      "Rows: {{total}} | Valid: {{valid}} | Inactive: {{inactive}} | Not found: {{notFound}} | Invalid qty: {{badQty}} | Invalid format: {{badFmt}} | Header skipped: {{headerSkipped}} | Duplicates merged: {{merged}} | Extra columns ignored: {{extraCols}}",
    summaryExcel:
      "Rows: {{total}} | Valid: {{valid}} | Inactive: {{inactive}} | Not found: {{notFound}} | Invalid qty: {{badQty}} | Invalid format: {{badFmt}} | Duplicates merged: {{merged}}",
    lineImport: {
      dataSheetName: "Lines import",
      instructionsSheetName: "Instructions",
      headerItemCode: "Item code",
      headerBarcode: "Barcode",
      headerQty: "Qty",
      headerUnitPrice: "Unit price",
      instructionTitle: "How to use this template",
      instruction1: "1) Fill rows on the first worksheet: {{sheetName}}.",
      instruction2: "2) Use item codes that exist in your catalog.",
      instruction3: "3) Quantity is required and must be greater than 0.",
      instruction4: "4) Unit price is optional (defaults apply when empty).",
      instruction5: "5) Example rows are samples. Replace them with real data before import.",
      workbookNoWorksheets: "This Excel workbook has no worksheets.",
      headerErrorIntro: "Import failed: the header row does not match the expected format.",
      headerMissingQtyLine: "Missing required quantity column.",
      headerMissingQtyExpected:
        "Expected a quantity column (e.g. Qty or Quantity, or the template column title).",
      headerMissingIdLine: "Missing required item identifier column.",
      headerMissingIdExpected:
        "Expected item code and/or barcode column (or the template column titles).",
      headerDetectedBlank: "(row 1 appears blank)",
      headerDetectedLine: "Detected headers (row 1): {{detected}}",
      headerTipRow:
        "Tip: the header row must be on row 1; each header should be in its own column.",
      headerExample: "Example: {{code}} | {{qty}}",
      headerExampleRow: "         {{sampleCode}} | {{sampleQty}}",
      headerHintSplitLabels:
        "Hint: one column appears to combine multiple labels. Split them into separate columns.",
      headerHintQtyTypo:
        "Hint: the quantity header may be misspelled. Use the template labels or Qty / Quantity.",
      reasonMissingItemCodeBarcode: "Missing item code or barcode.",
      reasonQtyMustBePositive: "Quantity must be a number greater than 0.",
      reasonUnitPriceNumericNonNegative:
        "Unit price must be numeric and greater than or equal to 0.",
    },
  },
  stock: {
    coverage: {
      covered: "Covered",
      at_risk: "At risk",
      short: "Short",
    },
    drilldown: {
      titleSr: "Stock balance sources for {{code}}",
      descSr:
        "Breakdown of reservations, sales order demand, and purchase order supply for this item and warehouse.",
      headerKicker: "Stock balance sources",
      warehouseLabel: "Warehouse",
      summarySection: "Summary",
      reservationsTitle: "Active reservations",
      reservationsEmpty: "No active reservations for this row.",
      outgoingTitle: "Outgoing demand",
      outgoingEmpty: "No remaining demand on confirmed sales orders.",
      incomingTitle: "Incoming supply",
      incomingEmpty: "No expected receipts on confirmed purchase orders.",
      mismatchReserved:
        "Line detail ({{sum}}) differs from grid Reserved ({{grid}}). Check warehouse and item on each reservation.",
      mismatchOutgoing:
        "Line total ({{sum}}) may differ from grid Outgoing ({{grid}}) when the same item appears on multiple order lines (posted quantities are shared by item).",
      mismatchIncoming:
        "Line total ({{sum}}) may differ from grid Incoming ({{grid}}) when the same item appears on multiple order lines (received quantities are shared by item).",
      openRelatedSo: "Open related sales orders",
      openRelatedPo: "Open related purchase orders",
      close: "Close",
    },
  },
  list: {
    filterBrandAria: "Brand filter active",
    filterCategoryAria: "Category filter active",
    filterBrand: "Brand",
    filterCategory: "Category",
    filterStatusAria: "Filter by status",
    master: {
      emptyFiltered: "No records match current search or filters",
      emptyDefault: "No records yet",
      hintClearFilters: "Try changing the search or filter.",
      hintCreateFirst: "Create your first record to get started.",
    },
    items: {
      emptyFiltered: "No items match current search or filters",
      emptyDefault: "No items yet",
      hintCreateFirst: "Create your first item to start working with inventory.",
      hintBrandCategory: "Try clearing the brand or category filter or adjusting search.",
      hintBrand: "Try clearing the brand filter or adjusting search.",
      hintCategory: "Try clearing the category filter or adjusting search.",
      searchAria: "Search items",
      searchPlaceholder: "Search",
    },
    brands: {
      emptyFiltered: "No brands match current search or filters",
      emptyDefault: "No brands yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first brand to use in items.",
      searchAria: "Search brands",
      searchPlaceholder: "Search",
    },
    categories: {
      emptyFiltered: "No categories match current search or filters",
      emptyDefault: "No categories yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first category to use in items.",
      searchAria: "Search categories",
      searchPlaceholder: "Search",
    },
    suppliers: {
      emptyFiltered: "No suppliers match current search or filters",
      emptyDefault: "No suppliers yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first supplier for purchasing.",
      searchAria: "Search suppliers",
      searchPlaceholder: "Search",
    },
    customers: {
      emptyFiltered: "No customers match current search or filters",
      emptyDefault: "No customers yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first customer for sales.",
      searchAria: "Search customers",
      searchPlaceholder: "Search",
    },
    warehouses: {
      emptyFiltered: "No warehouses match current search or filters",
      emptyDefault: "No warehouses yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first warehouse for stock operations.",
      searchAria: "Search warehouses",
      searchPlaceholder: "Search",
    },
    purchaseOrders: {
      emptyFiltered: "No purchase orders match current search or filters",
      emptyDefault: "No purchase orders yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first purchase order to start purchasing.",
      hintSupplierOnly:
        "No purchase orders for this supplier. Try clearing the supplier filter.",
      hintWarehouseOnly:
        "No purchase orders for this warehouse. Try clearing the warehouse filter.",
      hintItemOnly:
        "No purchase orders include this item on any line. Try clearing the item filter.",
      hintUrlFilters:
        "Try changing the search, status filter, or URL filters (supplier, warehouse, item).",
      searchAria: "Search purchase orders",
      searchPlaceholder: "Search",
      filterWarehouseAria: "Warehouse filter active",
      filterItemAria: "Item filter active",
      filterSupplierAria: "Supplier filter active",
    },
    salesOrders: {
      emptyFiltered: "No sales orders match current search or filters",
      emptyDefault: "No sales orders yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Create your first sales order to start selling.",
      hintCustomerOnly:
        "No sales orders for this customer. Try clearing the customer filter.",
      hintWarehouseOnly:
        "No sales orders for this warehouse. Try clearing the warehouse filter.",
      hintItemOnly:
        "No sales orders include this item on any line. Try clearing the item filter.",
      hintUrlFilters:
        "Try changing the search, status filter, or URL filters (customer, warehouse, item).",
      searchAria: "Search sales orders",
      searchPlaceholder: "Search",
      filterWarehouseAria: "Warehouse filter active",
      filterItemAria: "Item filter active",
      filterCustomerAria: "Customer filter active",
    },
    receipts: {
      emptyFiltered: "No receipts match current search or filters",
      emptyDefault: "No receipts yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Receipts are created from confirmed purchase orders.",
      hintSupplierOnly:
        "No receipts for this supplier. Try clearing the supplier filter.",
      hintWarehouseOnly:
        "No receipts for this warehouse. Try clearing the warehouse filter.",
      hintItemOnly:
        "No receipts include this item on any line. Try clearing the item filter.",
      hintPoOnly: "No receipts for this purchase order. Try clearing the PO filter.",
      hintUrlFilters:
        "Try changing the search, status filter, or URL filters (supplier, warehouse, item, PO).",
      hintSearchStatusWarehouse:
        "Try changing the search, status filter, or warehouse filter.",
      searchAria: "Search receipts",
      searchPlaceholder: "Search",
      filterWarehouseAria: "Warehouse filter active",
      filterItemAria: "Item filter active",
      filterSupplierAria: "Supplier filter active",
      filterPurchaseOrderAria: "Purchase order filter active",
    },
    shipments: {
      emptyFiltered: "No shipments match current search or filters",
      emptyDefault: "No shipments yet",
      hintFilter: "Try changing the search or filter.",
      hintCreate: "Shipments are created from confirmed sales orders.",
      hintCustomerOnly:
        "No shipments for this customer. Try clearing the customer filter.",
      hintWarehouseOnly:
        "No shipments for this warehouse. Try clearing the warehouse filter.",
      hintItemOnly:
        "No shipments include this item on any line. Try clearing the item filter.",
      hintSoOnly: "No shipments for this sales order. Try clearing the SO filter.",
      hintUrlFilters:
        "Try changing the search, status filter, or URL filters (customer, warehouse, item, SO).",
      hintSearchStatusWarehouse:
        "Try changing the search, status filter, or warehouse filter.",
      searchAria: "Search shipments",
      searchPlaceholder: "Search",
      filterWarehouseAria: "Warehouse filter active",
      filterItemAria: "Item filter active",
      filterCustomerAria: "Customer filter active",
      filterSalesOrderAria: "Sales order filter active",
    },
  },
  stockMovements: {
    empty: {
      titleFiltered: "No stock movements match current search or filters",
      titleDefault: "No stock movements yet",
      hintPosted: "Movements will appear after posting receipts and shipments.",
      hintWarehouseOnly: "No stock movements for this warehouse. Try clearing the warehouse filter.",
      hintGeneral: "Try changing the search or warehouse filter.",
    },
    searchAria: "Search stock movements",
    searchPlaceholder: "Search",
    types: {
      receipt: "Receipt",
      shipment: "Shipment",
      receipt_reversal: "Receipt reversal",
      shipment_reversal: "Shipment reversal",
    },
    sourceReceipt: "Receipt {{number}}",
    sourceShipment: "Shipment {{number}}",
  },
  master: {
    activeCell: { active: "Active", inactive: "Inactive" },
    exportActiveYes: "Active",
    exportActiveNo: "Inactive",
  },
  stockBalances: {
    quickFiltersAria: "Quick filters",
    searchAria: "Search stock balances",
    searchPlaceholder: "Search",
    warehouseFilterAria: "Warehouse filter active",
    empty: {
      titleFiltered: "No stock balances match current search or filters",
      titleDefault: "No stock balances yet",
      hintPosted: "Balances will appear after posting receipts and shipments.",
      hintQuickOnly:
        "No rows match this quick filter. Try All or another filter.",
      hintWarehouseOnly: "No stock balances for this warehouse. Try clearing the warehouse filter.",
      hintGeneral: "Try changing the search, quick filter, or warehouse filter.",
    },
    quick: {
      all: { label: "All", aria: "Show all rows" },
      shortage: { label: "Shortage", aria: "Show rows with deficit greater than zero" },
      outgoing: { label: "Has outgoing", aria: "Show rows with outgoing demand" },
      incoming: { label: "Has incoming", aria: "Show rows with incoming supply" },
      avail_lte_zero: {
        label: "Avail ≤ 0",
        aria: "Show rows where available quantity is zero or negative",
      },
      needs_replenishment: {
        label: "Need repl.",
        aria:
          "Show rows with net shortage greater than zero (uncovered demand after incoming)",
      },
      coverage_at_risk: {
        label: "At risk",
        aria:
          "Show rows where outgoing exceeds available but expected incoming covers the gap (covered by incoming, net shortage zero)",
      },
    },
  },
} as const;
