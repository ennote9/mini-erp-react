from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/modules/sales-orders/pages/SalesOrderPage.tsx"
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)

# Remove editable finance+doc-lines: file lines 1663-1949 -> indices 1662-1948 inclusive
lines = lines[:1662] + lines[1949:]

# Find readonly finance block
start = None
for idx, line in enumerate(lines):
    if "{!isNew && doc ? (" in line:
        window = "".join(lines[idx : idx + 15])
        if "SalesOrderFinanceSection" in window and "readonlyTotals" in window:
            start = idx
            break
if start is None:
    raise SystemExit("readonly finance start not found")

doc_start = None
for idx in range(start, len(lines)):
    if "doc-lines mt-" in lines[idx] and "calc" in lines[idx]:
        doc_start = idx
        break
if doc_start is None:
    raise SystemExit("readonly doc-lines not found")

# Find closing `        </>` of readonly fragment (ends readonly branch)
readonly_frag_close = None
for idx in range(doc_start, len(lines)):
    if lines[idx] == "        </>\n":
        readonly_frag_close = idx
        break
if readonly_frag_close is None:
    raise SystemExit("readonly fragment close not found")

# doc-lines closes with `          </div>` immediately before `        </>`
doc_end = readonly_frag_close - 1
if "</div>" not in lines[doc_end]:
    raise SystemExit(f"expected doc-lines close, got: {lines[doc_end]!r}")

# Remove from start through doc_end inclusive
lines = lines[:start] + lines[doc_end + 1 :]

p.write_text("".join(lines), encoding="utf-8")
print("OK:", p, "lines:", len(lines))
