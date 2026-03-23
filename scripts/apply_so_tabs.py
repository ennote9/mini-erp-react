"""Apply Sales Order tab layout + header export. Run: python scripts/apply_so_tabs.py"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src/modules/sales-orders/pages/SalesOrderPage.tsx"
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

# --- 1) Add import ---
text = "".join(lines)
if "SalesOrderFinanceSection" not in text:
    text = text.replace(
        'import { SalesOrderItemAutocomplete, type SalesOrderItemAutocompleteRef } from "../components/SalesOrderItemAutocomplete";\n',
        'import { SalesOrderItemAutocomplete, type SalesOrderItemAutocompleteRef } from "../components/SalesOrderItemAutocomplete";\n'
        'import { SalesOrderFinanceSection } from "../components/SalesOrderFinanceSection";\n',
    )

lines = text.splitlines(keepends=True)

# --- 2) Print menu: two items ---
old_menu = """  const salesOrderPrintMenuItems = useMemo(() => {
    if (!id || !canOpenPreliminaryCustomerDoc) return [];
    return [{ to: `/sales-orders/${id}/customer-document`, label: t("doc.customerDocument.preliminaryTitle") }];
  }, [id, canOpenPreliminaryCustomerDoc, t, locale]);"""
new_menu = """  const salesOrderPrintMenuItems = useMemo(() => {
    if (!id || !canOpenPreliminaryCustomerDoc) return [];
    return [
      { to: `/sales-orders/${id}/customer-document`, label: t("doc.customerDocument.preliminaryTitle") },
      { to: `/sales-orders/${id}/customer-invoice`, label: t("finance.openCustomerInvoiceShort") },
    ];
  }, [id, canOpenPreliminaryCustomerDoc, t, locale]);"""
text = "".join(lines)
if new_menu.split()[4] not in text:
    text = text.replace(old_menu, new_menu)
lines = text.splitlines(keepends=True)

# --- 3) State soWorkingTab ---
needle = "  const [exportOpen, setExportOpen] = useState(false);\n"
if "soWorkingTab" not in "".join(lines):
    lines = "".join(lines).replace(
        needle,
        needle
        + '  const [soWorkingTab, setSoWorkingTab] = useState<"lines" | "payments" | "events">("lines");\n',
    ).splitlines(keepends=True)

# --- 4) Remove editable doc-lines block (file lines 1659-2051) indices 1658-2050 ---
idx_ed_start = 1658
idx_ed_end = 2051  # exclusive
editable_inner = "".join(lines[idx_ed_start:idx_ed_end])
lines = lines[:idx_ed_start] + lines[idx_ed_end:]

# --- 5) Remove readonly doc-lines block (original 2154-2349); after cut: shift -393
shift = idx_ed_end - idx_ed_start
orig_ro_start = 2153
orig_ro_end = 2349
idx_ro_start = orig_ro_start - shift
idx_ro_end = orig_ro_end - shift
readonly_inner = "".join(lines[idx_ro_start:idx_ro_end])
lines = lines[:idx_ro_start] + lines[idx_ro_end:]


def strip_doc_lines_wrapper_and_headers(s: str) -> str:
    s = s.strip("\n")
    # drop outer <div className="doc-lines ..."> and matching final </div>
    if 'className="doc-lines mt-' not in s:
        return s
    lines_local = s.splitlines(keeplines=True)
    # remove first line (opening doc-lines div)
    if lines_local and "doc-lines mt-" in lines_local[0]:
        lines_local = lines_local[1:]
    # remove doc-lines__header block or lone h3 title (readonly)
    out = []
    i = 0
    while i < len(lines_local):
        if "doc-lines__header" in lines_local[i]:
            while i < len(lines_local) and "</div>" not in lines_local[i]:
                i += 1
            if i < len(lines_local):
                i += 1
            continue
        if "<h3" in lines_local[i] and "doc-lines__title" in lines_local[i]:
            while i < len(lines_local) and "</h3>" not in lines_local[i]:
                i += 1
            if i < len(lines_local):
                i += 1
            continue
        out.append(lines_local[i])
        i += 1
    s2 = "".join(out).rstrip()
    if s2.endswith("</div>"):
        s2 = s2[: s2.rfind("</div>")].rstrip()
    return s2


def strip_print_export(s: str) -> str:
    # Editable: remove flex row with print after </Card> inside line entry block - already separate
    # Remove block starting with `<div className="flex flex-row flex-wrap items-center justify-end gap-2 shrink-0">` containing DocumentPrintActionsMenu
    import re

    s = re.sub(
        r"\s*<div className=\"flex flex-row flex-wrap items-center justify-end gap-2 shrink-0\">[\s\S]*?</div>\s*</div>\s*\)\}\s*",
        "\n              </div>\n            )}\n",
        s,
        count=1,
    )
    # Readonly: `<div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full mb-1.5">`
    s = re.sub(
        r"\s*<div className=\"flex flex-row flex-wrap items-center justify-end gap-2 w-full mb-1\.5\">[\s\S]*?</div>\s*\n",
        "\n",
        s,
        count=1,
    )
    return s


editable_body = strip_print_export(strip_doc_lines_wrapper_and_headers(editable_inner))
readonly_body = strip_print_export(strip_doc_lines_wrapper_and_headers(readonly_inner))

HEADER_SNIPPET = r"""              {!isNew && (
                <>
                  <DocumentPrintActionsMenu
                    items={salesOrderPrintMenuItems}
                    triggerLabel={t("doc.page.print")}
                    aria-label={t("doc.page.printMenuAria")}
                  />
                  {exportSuccess && (
                    <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
                      <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        title={t("doc.list.openFile")}
                        aria-label={t("doc.list.openFile")}
                        onClick={async () => {
                          try {
                            await invoke("open_export_file", { path: exportSuccess.path });
                            setExportSuccess(null);
                          } catch (err) {
                            console.error("Export failed", err);
                            setExportSuccess(null);
                          }
                        }}
                      >
                        <File className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        title={t("doc.list.openFolder")}
                        aria-label={t("doc.list.openFolder")}
                        onClick={() => {
                          revealItemInDir(exportSuccess.path);
                          setExportSuccess(null);
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                        title={t("doc.list.dismiss")}
                        aria-label={t("doc.list.dismiss")}
                        onClick={() => setExportSuccess(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-stretch rounded-md border border-input shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-r-none border-0 border-r border-input gap-1.5"
                      onClick={handleExportMain}
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      {t("doc.page.export")}
                    </Button>
                    <Popover open={exportOpen} onOpenChange={setExportOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
                          aria-label={t("doc.list.exportOptionsAria")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="!w-max min-w-0 p-1.5" align="end" side="top">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={exportSelectedDisabled}
                            className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              exportSelectedDisabled
                                ? !isEditable
                                  ? t("doc.list.exportSelectionEditModeOnly")
                                  : t("doc.list.exportSelectLinesFirst")
                                : undefined
                            }
                            onClick={() => {
                              setExportOpen(false);
                              if (!exportSelectedDisabled) handleExportSelected();
                            }}
                          >
                            {t("doc.list.exportSelectedRows")}
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
                            onClick={() => {
                              setExportOpen(false);
                              handleExportAll();
                            }}
                          >
                            {t("doc.list.exportAllLines")}
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
"""

text = "".join(lines)
if "doc-so-working-area" not in text:
    insert = f"""      <div className="doc-so-working-area mt-4 max-w-full">
        <div
          className="mb-3 flex flex-wrap gap-1 border-b border-border"
          role="tablist"
          aria-label={{t("doc.so.tabPanelsAria")}}
        >
          <button
            type="button"
            role="tab"
            aria-selected={{soWorkingTab === "lines"}}
            className={{cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "lines"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}}
            onClick={{() => setSoWorkingTab("lines")}}
          >
            {{t("doc.so.tabLines")}}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={{soWorkingTab === "payments"}}
            className={{cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "payments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}}
            onClick={{() => setSoWorkingTab("payments")}}
          >
            {{t("doc.so.tabPayments")}}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={{soWorkingTab === "events"}}
            className={{cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "events"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}}
            onClick={{() => setSoWorkingTab("events")}}
          >
            {{t("doc.so.tabEventLog")}}
          </button>
        </div>
        {{soWorkingTab === "payments" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--payments">
            {{isNew ? (
              <p className="text-sm text-muted-foreground">{{t("doc.so.tabSaveDocumentFirst")}}</p>
            ) : doc ? (
              <SalesOrderFinanceSection
                salesOrderId={{id}}
                cancelled={{doc.status === "cancelled"}}
                orderTotalAmount={{isEditable ? totals.totalAmount : readonlyTotals.totalAmount}}
                hasLines={{isEditable ? form.lines.length > 0 : lines.length > 0}}
              />
            ) : null}}
          </div>
        )}}
        {{soWorkingTab === "events" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--events">
            {{isNew ? (
              <p className="text-sm text-muted-foreground">{{t("doc.so.tabSaveDocumentFirst")}}</p>
            ) : showDocumentEventLogSection && id ? (
              <DocumentEventLogSection entityType="sales_order" entityId={{id}} refresh={{refresh}} />
            ) : (
              <p className="text-sm text-muted-foreground">{{t("doc.so.tabEventLogDisabled")}}</p>
            )}}
          </div>
        )}}
        {{soWorkingTab === "lines" && isEditable && (
          <div className="doc-lines mt-0">
{editable_body}
          </div>
        )}}
        {{soWorkingTab === "lines" && !isEditable && (
          <div className="doc-lines mt-0">
{readonly_body}
          </div>
        )}}
      </div>
"""
    # Fix: I used double braces for f-string - wrong. Build without f-string for JSX
    raise SystemExit("Use manual paste for tab block - f-string escaped wrong")
