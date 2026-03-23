# One-off patch script for Sales Order page tab restructure. Run from repo root:
# python scripts/patch_so_page_tabs.py
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src/modules/sales-orders/pages/SalesOrderPage.tsx"
text = path.read_text(encoding="utf-8")
lines = text.splitlines(keepends=True)

# 0-based line indices from file read (line N -> index N-1)
# Remove editable: finance + doc-lines (file lines 1663-2063 inclusive) -> indices 1662-2062
start_a, end_a = 1662, 2063
# Remove readonly: finance + doc-lines (file lines 2166-2369) -> before first delete, indices 2165-2368
start_b, end_b = 2165, 2369

block_a = "".join(lines[start_a:end_a])
if "SalesOrderFinanceSection" not in block_a or "doc-lines mt-" not in block_a:
    raise SystemExit("Editable block marker mismatch; abort.")

lines = lines[:start_a] + lines[end_a:]

# After removing block_a, line count reduced by (end_a - start_a)
delta = end_a - start_a
start_b2 = start_b - delta
end_b2 = end_b - delta

block_b = "".join(lines[start_b2:end_b2])
if "readonlyTotals" not in block_b and "SalesOrderFinanceSection" not in block_b:
    # readonly block has finance then lines; readonlyTotals appears in totals section of readonly lines
    pass
if "SalesOrderFinanceSection" not in block_b:
    raise SystemExit("Readonly block marker mismatch; abort.")

lines = lines[:start_b2] + lines[end_b2:]

insertion_point = None
for i, line in enumerate(lines):
    if line.strip() == ")}" and i > 0 and "DocumentLineImportModal" in "".join(lines[i : i + 3]):
        # Find `      )}\n      <DocumentLineImportModal`
        if i + 1 < len(lines) and "<DocumentLineImportModal" in lines[i + 1]:
            insertion_point = i + 1
            break
if insertion_point is None:
    raise SystemExit("Could not find insertion point before DocumentLineImportModal.")

TAB_BLOCK = r'''      <div className="doc-so-working-area mt-4 max-w-full">
        <div
          className="mb-3 flex flex-wrap gap-1 border-b border-border"
          role="tablist"
          aria-label={t("doc.so.tabPanelsAria")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "lines"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "lines"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("lines")}
          >
            {t("doc.so.tabLines")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "payments"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "payments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("payments")}
          >
            {t("doc.so.tabPayments")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={soWorkingTab === "events"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              soWorkingTab === "events"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setSoWorkingTab("events")}
          >
            {t("doc.so.tabEventLog")}
          </button>
        </div>
        {soWorkingTab === "payments" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--payments">
            {isNew ? (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabSaveDocumentFirst")}</p>
            ) : doc ? (
              <SalesOrderFinanceSection
                salesOrderId={id}
                cancelled={doc.status === "cancelled"}
                orderTotalAmount={isEditable ? totals.totalAmount : readonlyTotals.totalAmount}
                hasLines={isEditable ? form.lines.length > 0 : lines.length > 0}
              />
            ) : null}
          </div>
        )}
        {soWorkingTab === "events" && (
          <div className="doc-so-tab-panel doc-so-tab-panel--events">
            {isNew ? (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabSaveDocumentFirst")}</p>
            ) : showDocumentEventLogSection && id ? (
              <DocumentEventLogSection entityType="sales_order" entityId={id} refresh={refresh} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("doc.so.tabEventLogDisabled")}</p>
            )}
          </div>
        )}
        {soWorkingTab === "lines" && isEditable && (
          <div className="doc-lines mt-0">
            <PLACEHOLDER_EDITABLE_LINES />
          </div>
        )}
        {soWorkingTab === "lines" && !isEditable && (
          <div className="doc-lines mt-0">
            <PLACEHOLDER_READONLY_LINES />
          </div>
        )}
      </div>
'''

# Extract editable lines inner (without outer doc-lines wrapper) from removed block_a
# block_a started with finance - strip until doc-lines inner
idx = block_a.find('<div className="doc-lines mt-[calc(0.5rem+1cm)]">')
if idx == -1:
    raise SystemExit("Could not find doc-lines in editable block.")
inner_a = block_a[idx:]
# Remove outer wrapper: from first line through first newline after opening div - strip the opening tag and header
inner_a = inner_a.split("\n", 1)[1]  # drop first line
# Remove doc-lines__header block (3 lines)
if "doc-lines__header" not in inner_a:
    raise SystemExit("No header in editable")
header_end = inner_a.find("</div>")
# remove first </div> closing header - find the closing of doc-lines__header mb
# Simpler: remove lines until after </div> that follows doc-lines__title
lines_a = inner_a.splitlines(keepends=True)
stripped = []
i = 0
while i < len(lines_a):
    if "doc-lines__header" in lines_a[i]:
        while i < len(lines_a) and "</div>" not in lines_a[i]:
            i += 1
        if i < len(lines_a):
            i += 1  # skip line with </div>
        continue
    stripped.append(lines_a[i])
    i += 1
inner_a = "".join(stripped)
# Remove trailing closing </div> for doc-lines (last line)
if inner_a.rstrip().endswith("</div>"):
    # remove last </div> that closed doc-lines
    last = inner_a.rfind("</div>")
    inner_a = inner_a[:last] + inner_a[last + len("</div>") :]

# Extract readonly inner from block_b
idx = block_b.find('<div className="doc-lines mt-[calc(0.5rem+1cm)]">')
if idx == -1:
    raise SystemExit("Could not find doc-lines in readonly block.")
inner_b = block_b[idx:].split("\n", 1)[1]
lines_b = inner_b.splitlines(keepends=True)
stripped_b = []
i = 0
while i < len(lines_b):
    if "doc-lines__header" in lines_b[i] or (i == 0 and "<h3" in lines_b[i]):
        # remove title h3 block - readonly has h3 directly after doc-lines
        if "<h3" in lines_b[i]:
            while i < len(lines_b) and "</h3>" not in lines_b[i]:
                i += 1
            i += 1
            continue
    if "doc-lines__header" in lines_b[i]:
        while i < len(lines_b) and "</div>" not in lines_b[i]:
            i += 1
        if i < len(lines_b):
            i += 1
        continue
    stripped_b.append(lines_b[i])
    i += 1
inner_b = "".join(stripped_b)
if inner_b.rstrip().endswith("</div>"):
    last = inner_b.rfind("</div>")
    inner_b = inner_b[:last] + inner_b[last + len("</div>") :]

TAB_BLOCK = TAB_BLOCK.replace("<PLACEHOLDER_EDITABLE_LINES />", inner_a.strip())
TAB_BLOCK = TAB_BLOCK.replace("<PLACEHOLDER_READONLY_LINES />", inner_b.strip())

lines.insert(insertion_point, TAB_BLOCK)

path.write_text("".join(lines), encoding="utf-8")
print("Patched:", path)
