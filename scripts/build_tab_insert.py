from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ed = (ROOT / "scripts/_ed.txt").read_text(encoding="utf-8")
ro = (ROOT / "scripts/_ro.txt").read_text(encoding="utf-8")


def strip_outer_and_header(s: str) -> str:
    s = s.strip()
    lines = s.splitlines()
    # drop first line opening doc-lines
    if lines and "doc-lines mt-" in lines[0]:
        lines = lines[1:]
    # drop doc-lines__header block
    if lines and "doc-lines__header" in lines[0]:
        depth = 0
        i = 0
        while i < len(lines):
            if "<div" in lines[i] and "doc-lines__header" in lines[i]:
                depth = 1
                i += 1
                while i < len(lines) and depth > 0:
                    depth += lines[i].count("<div") - lines[i].count("</div>")
                    i += 1
                break
            i += 1
        lines = lines[i:]
    elif lines and "doc-lines__title" in lines[0]:
        # readonly h3 only
        i = 0
        while i < len(lines) and "</h3>" not in lines[i]:
            i += 1
        lines = lines[i + 1 :]
    s = "\n".join(lines).strip()
    # drop last closing </div> for outer doc-lines
    if s.endswith("</div>"):
        s = s[: s.rfind("</div>")].rstrip()
    return s


def strip_print(s: str) -> str:
    # editable: nested structure with `flex flex-row flex-wrap items-center justify-end gap-2 shrink-0`
    s = re.sub(
        r"\n\s*<div className=\"flex flex-row flex-wrap items-center justify-end gap-2 shrink-0\">[\s\S]*?</div>\s*</div>\s*\)\}\s*",
        "\n              </div>\n            )}\n",
        s,
        count=1,
    )
    s = re.sub(
        r"\n\s*<div className=\"flex flex-row flex-wrap items-center justify-end gap-2 w-full mb-1\.5\">[\s\S]*?</div>\s*\n",
        "\n",
        s,
        count=1,
    )
    return s


ed2 = strip_print(strip_outer_and_header(ed))
ro2 = strip_print(strip_outer_and_header(ro))

TAB = f"""      <div className="doc-so-working-area mt-4 max-w-full">
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
                salesOrderId={{id!}}
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
{ed2}
          </div>
        )}}
        {{soWorkingTab === "lines" && !isEditable && (
          <div className="doc-lines mt-0">
{ro2}
          </div>
        )}}
      </div>
"""

(ROOT / "scripts/_TAB_INSERT.txt").write_text(TAB, encoding="utf-8")
print("Wrote _TAB_INSERT.txt", len(TAB))
