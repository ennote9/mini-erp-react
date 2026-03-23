from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = ROOT / "src/modules/sales-orders/pages/SalesOrderPage.tsx"
tab = (ROOT / "scripts/_TAB_INSERT.txt").read_text(encoding="utf-8")
lines = page.read_text(encoding="utf-8").splitlines(keepends=True)

# Editable doc-lines: file lines 1782-2174 -> indices 1781:2174
idx_ed_start = 1781
idx_ed_end = 2174
lines = lines[:idx_ed_start] + lines[idx_ed_end:]

shift = idx_ed_end - idx_ed_start
# Readonly: original lines 2277-2472 -> indices 2276:2472
idx_ro_start = 2276 - shift
idx_ro_end = 2472 - shift
lines = lines[:idx_ro_start] + lines[idx_ro_end:]

text = "".join(lines)
marker = "      )}\n      <DocumentLineImportModal"
if marker not in text:
    raise SystemExit("marker not found")
text = text.replace(marker, "      )}\n" + tab + "\n      <DocumentLineImportModal", 1)

old_log = """      {!isNew && id && showDocumentEventLogSection ? (
        <DocumentEventLogSection entityType="sales_order" entityId={id} refresh={refresh} />
      ) : null}
"""
if old_log in text:
    text = text.replace(old_log, "")

page.write_text(text, encoding="utf-8")
print("merged", page)
