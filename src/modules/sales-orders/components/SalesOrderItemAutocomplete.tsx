import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Item } from "../../items/model";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { cn } from "@/lib/utils";
import {
  isMarkdownCodeFormat,
  resolveMarkdownRecordByScanInput,
} from "@/modules/markdown-journal/markdownLookup";
import type { MarkdownRecord } from "@/modules/markdown-journal/model";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { itemBarcodeTokensForOperationalLookup } from "@/modules/items/lib/itemBarcodeLookup";

export type SalesOrderItemAutocompleteRef = { focus: () => void };

type Props = {
  id?: string;
  value: string; // selected itemId (empty means none)
  items: Item[];
  onChange: (itemId: string) => void;
  onMarkdownSelect?: (record: MarkdownRecord) => void;
  markdownSelectionState?: (record: MarkdownRecord) => { selectable: boolean; reason?: string };
  placeholder?: string;
  className?: string;
  /** Right edge for stretched dropdown (e.g. line-entry actions column with “Add line”). */
  dropdownRightEdgeRef?: React.RefObject<HTMLElement | null>;
};

const MAX_OPTIONS = 10;

function getItemLabel(item: Item): string {
  return `${item.code} - ${item.name}`;
}

function searchItemsForSalesOrderLine(items: Item[], rawQuery: string): Item[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const exactCode: Item[] = [];
  const exactBarcode: Item[] = [];
  const startsWithCode: Item[] = [];
  const startsWithName: Item[] = [];
  const startsWithBarcode: Item[] = [];
  const containsCode: Item[] = [];
  const containsName: Item[] = [];
  const containsBarcode: Item[] = [];

  for (const item of items) {
    const code = item.code.toLowerCase();
    const name = item.name.toLowerCase();
    const barcodes = itemBarcodeTokensForOperationalLookup(item).map((x) => x.toLowerCase());

    if (code === q) {
      exactCode.push(item);
      continue;
    }
    if (barcodes.some((x) => x === q)) {
      exactBarcode.push(item);
      continue;
    }
    if (code.startsWith(q)) {
      startsWithCode.push(item);
      continue;
    }
    if (name.startsWith(q)) {
      startsWithName.push(item);
      continue;
    }
    if (barcodes.some((x) => x.startsWith(q))) {
      startsWithBarcode.push(item);
      continue;
    }
    if (code.includes(q)) {
      containsCode.push(item);
      continue;
    }
    if (name.includes(q)) {
      containsName.push(item);
      continue;
    }
    if (barcodes.some((x) => x.includes(q))) {
      containsBarcode.push(item);
      continue;
    }
  }

  const tieBreak = (a: Item, b: Item) =>
    a.code.localeCompare(b.code, undefined, { sensitivity: "base" });

  exactCode.sort(tieBreak);
  exactBarcode.sort(tieBreak);
  startsWithCode.sort(tieBreak);
  startsWithName.sort(tieBreak);
  startsWithBarcode.sort(tieBreak);
  containsCode.sort(tieBreak);
  containsName.sort(tieBreak);
  containsBarcode.sort(tieBreak);

  // Prefix matches first (code/name/barcode), then loose contains.
  return [
    ...exactCode,
    ...exactBarcode,
    ...startsWithCode,
    ...startsWithName,
    ...startsWithBarcode,
    ...containsCode,
    ...containsName,
    ...containsBarcode,
  ];
}

function formatSalePrice(p: number | undefined): string {
  return typeof p === "number" && !Number.isNaN(p) ? p.toFixed(2) : "0.00";
}

export const SalesOrderItemAutocomplete = forwardRef<
  SalesOrderItemAutocompleteRef,
  Props
>(function SalesOrderItemAutocomplete(
  {
    id,
    value,
    onChange,
    onMarkdownSelect,
    markdownSelectionState,
    items,
    placeholder,
    className,
    dropdownRightEdgeRef,
  },
  ref,
) {
  const appRevision = useAppReadModelRevision();
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [listBoxStyle, setListBoxStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const blockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current);
    };
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selectedItem = value ? items.find((i) => i.id === value) : undefined;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  const displayText = value
    ? selectedItem
      ? getItemLabel(selectedItem)
      : value
    : inputValue;

  const itemOptions = useMemo(() => {
    const q = inputValue.trim();
    if (!q) return [];
    return searchItemsForSalesOrderLine(items, inputValue).slice(0, MAX_OPTIONS);
  }, [items, inputValue]);

  const mdMatch = useMemo(() => {
    const q = inputValue.trim();
    if (!isMarkdownCodeFormat(q)) return null;
    return resolveMarkdownRecordByScanInput(q);
  }, [inputValue, appRevision]);
  const mdState = useMemo(() => {
    if (!mdMatch) return { selectable: false, reason: "Markdown unit is not selectable." };
    if (!onMarkdownSelect) return { selectable: false, reason: "Markdown unit is not selectable." };
    return markdownSelectionState?.(mdMatch) ?? { selectable: true };
  }, [mdMatch, markdownSelectionState, onMarkdownSelect]);

  const totalSlots = (mdMatch ? 1 : 0) + itemOptions.length;
  const mdBaseItem = mdMatch ? itemRepository.getById(mdMatch.itemId) : undefined;

  useEffect(() => {
    if (value) {
      if (selectedItem) setInputValue(getItemLabel(selectedItem));
      else setInputValue(value);
    } else {
      setInputValue("");
    }
  }, [value, selectedItem?.id]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [itemOptions.length, mdMatch?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    const child = el.children[highlightedIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setListBoxStyle(null);
      return;
    }

    function updatePosition() {
      const inputEl = inputRef.current;
      if (!inputEl) return;
      const inputRect = inputEl.getBoundingClientRect();
      const anchor = dropdownRightEdgeRef?.current;
      const anchorRect = anchor?.getBoundingClientRect();
      const right = anchorRect ? anchorRect.right : inputRect.right;
      const width = Math.max(inputRect.width, right - inputRect.left);
      setListBoxStyle({
        top: inputRect.bottom + 2,
        left: inputRect.left,
        width,
      });
    }

    updatePosition();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updatePosition())
        : null;
    if (ro && dropdownRightEdgeRef?.current) {
      ro.observe(dropdownRightEdgeRef.current);
    }
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, dropdownRightEdgeRef, itemOptions.length, mdMatch?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeDropdown = () => {
    setIsOpen(false);
    // Restore a stable input label when closing.
    if (selectedItem) setInputValue(getItemLabel(selectedItem));
  };

  const showBlockedMessage = (message: string, timeoutMs = 1800) => {
    setBlockedMessage(message);
    if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current);
    blockedTimerRef.current = setTimeout(() => setBlockedMessage(null), timeoutMs);
  };

  const selectItem = (item: Item) => {
    if (!item.isActive) {
      showBlockedMessage("Inactive items cannot be added.", 1600);
      return;
    }
    setBlockedMessage(null);
    onChange(item.id);
    setInputValue(getItemLabel(item));
    setIsOpen(false);
  };

  const selectMarkdown = (record: MarkdownRecord) => {
    onMarkdownSelect?.(record);
    setBlockedMessage(null);
    setInputValue(record.markdownCode);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    // Clear selection: manual text must not behave like a selected item.
    onChange("");
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = () => {
    // If the user focuses without a selected item, keep the dropdown behavior consistent.
    setIsOpen(true);
    setHighlightedIndex(0);
    if (!value) setInputValue("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        totalSlots > 0 ? Math.min(i + 1, totalSlots - 1) : 0,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (totalSlots > 0 ? Math.max(i - 1, 0) : 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (mdMatch && highlightedIndex === 0) {
        if (mdState.selectable) {
          selectMarkdown(mdMatch);
        } else {
          showBlockedMessage(mdState.reason ?? "Markdown unit is not selectable in this document.");
        }
        return;
      }
      const itemIdx = mdMatch ? highlightedIndex - 1 : highlightedIndex;
      const item = itemIdx >= 0 ? itemOptions[itemIdx] : undefined;
      if (item) selectItem(item);
      else closeDropdown();
      return;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        value={displayText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder ?? "Search by code, barcode or name…"}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={
          isOpen && totalSlots > 0 && id
            ? mdMatch && highlightedIndex === 0
              ? `${id}-option-md`
              : (() => {
                  const ii = mdMatch ? highlightedIndex - 1 : highlightedIndex;
                  const it = itemOptions[ii];
                  return it ? `${id}-option-${it.id}` : undefined;
                })()
            : undefined
        }
        className={cn(
          "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      {isOpen &&
        listBoxStyle != null &&
        createPortal(
          <ul
            ref={listRef}
            id={id ? `${id}-listbox` : undefined}
            role="listbox"
            style={{
              position: "fixed",
              top: listBoxStyle.top,
              left: listBoxStyle.left,
              width: listBoxStyle.width,
              zIndex: 200,
            }}
            className="so-item-autocomplete-listbox max-h-[min(14rem,40vh)] overflow-auto rounded border border-input bg-background py-1 shadow-md"
          >
            {totalSlots === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">
                No items found
              </li>
            ) : (
              <>
                {mdMatch ? (
                  <li
                    id={id ? `${id}-option-md` : undefined}
                    role="option"
                    aria-selected={highlightedIndex === 0}
                    className={cn(
                      "px-2 py-1.5 text-sm border-b border-border/50",
                      mdState.selectable
                        ? highlightedIndex === 0
                          ? "cursor-pointer bg-accent text-accent-foreground"
                          : "cursor-pointer hover:bg-accent/60"
                        : highlightedIndex === 0
                          ? "cursor-not-allowed bg-muted/60 text-muted-foreground/90"
                          : "cursor-not-allowed opacity-60 text-muted-foreground/90",
                    )}
                    onMouseEnter={() => setHighlightedIndex(0)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (mdState.selectable) {
                        selectMarkdown(mdMatch);
                      } else {
                        showBlockedMessage(mdState.reason ?? "Markdown unit is not selectable in this document.");
                      }
                    }}
                  >
                    <div className="font-mono text-xs tabular-nums">{mdMatch.markdownCode}</div>
                    <div className="text-xs text-muted-foreground">
                      Markdown unit
                      {mdBaseItem ? ` · ${mdBaseItem.code}` : null}
                    </div>
                    {!mdState.selectable && mdState.reason ? (
                      <div className="text-[11px] text-destructive/90 mt-0.5">{mdState.reason}</div>
                    ) : null}
                  </li>
                ) : null}
                {itemOptions.map((item, idx) => {
                  const rowIdx = (mdMatch ? 1 : 0) + idx;
                  const inactive = !item.isActive;
                  const brand =
                    item.brandId != null ? brandRepository.getById(item.brandId) : undefined;
                  const category =
                    item.categoryId != null ? categoryRepository.getById(item.categoryId) : undefined;
                  const brandName =
                    brand?.name ?? brand?.code ?? "—";
                  const categoryName =
                    category?.name ?? category?.code ?? "—";
                  const salePrice = formatSalePrice(item.salePrice);

                  const highlighted = highlightedIndex === rowIdx;

                  return (
                    <li
                      key={item.id}
                      id={id ? `${id}-option-${item.id}` : undefined}
                      role="option"
                      aria-selected={highlighted}
                      aria-disabled={inactive}
                      className={cn(
                        "px-2 py-1.5 text-sm",
                        inactive
                          ? highlighted
                            ? "cursor-not-allowed bg-muted/60 text-muted-foreground/90"
                            : "cursor-not-allowed opacity-60"
                          : highlighted
                            ? "bg-accent text-accent-foreground"
                            : "cursor-pointer hover:bg-accent/60",
                      )}
                      onMouseEnter={() => setHighlightedIndex(rowIdx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem(item);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cn("leading-tight truncate", inactive && "text-muted-foreground/90")}>
                            <span className="font-mono text-xs tabular-nums">{item.code}</span>
                            <span className="ml-2 text-sm truncate">{item.name}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground leading-none">
                            <span className="truncate">
                              {brandName} / {categoryName}
                            </span>
                            {inactive && <span className="whitespace-nowrap">(Inactive)</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <div className="text-xs text-foreground/90">{salePrice}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </>
            )}
            {blockedMessage && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                {blockedMessage}
              </li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
});

