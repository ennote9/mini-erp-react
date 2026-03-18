import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import type { Item } from "../../../modules/items/model";
import { itemRepository } from "../../../modules/items/repository";
import { searchItemsForOrderEntry } from "../../../modules/items/orderEntrySearch";
import { cn } from "@/lib/utils";

const MAX_OPTIONS = 50;

function getItemLabel(item: Item): string {
  return `${item.code} - ${item.name}`;
}

export type SearchableItemPickerRef = { focus: () => void };

export type SearchableItemPickerProps = {
  value: string;
  onChange: (itemId: string) => void;
  items: Item[];
  id?: string;
  placeholder?: string;
  className?: string;
};

export const SearchableItemPicker = forwardRef<SearchableItemPickerRef, SearchableItemPickerProps>(function SearchableItemPicker(
  {
    value,
    onChange,
    items,
    id,
    placeholder = "Search by code, barcode or name…",
    className,
  },
  ref,
) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }), []);

  const selectedItem = value ? items.find((i) => i.id === value) : undefined;
  const displayText = value
    ? (selectedItem ? getItemLabel(selectedItem) : (() => {
        const it = itemRepository.getById(value);
        return it ? getItemLabel(it) : value;
      })())
    : inputValue;

  const options = useMemo(() => {
    if (!inputValue.trim()) return [];
    return searchItemsForOrderEntry(items, inputValue).slice(0, MAX_OPTIONS);
  }, [items, inputValue]);

  useEffect(() => {
    if (value) {
      const item = selectedItem ?? itemRepository.getById(value);
      setInputValue(item ? getItemLabel(item) : value);
    } else {
      setInputValue("");
    }
  }, [value, selectedItem?.id]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [options.length]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    const child = el.children[highlightedIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeDropdown = () => {
    setIsOpen(false);
    if (value) {
      const item = selectedItem ?? itemRepository.getById(value);
      if (item) setInputValue(getItemLabel(item));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    if (value) onChange("");
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = () => {
    if (!value) setInputValue("");
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i < options.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i > 0 ? i - 1 : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = options[highlightedIndex];
      if (item && item.isActive) {
        onChange(item.id);
        setInputValue(getItemLabel(item));
        setIsOpen(false);
      }
    }
  };

  const selectItem = (item: Item) => {
    if (!item.isActive) return;
    onChange(item.id);
    setInputValue(getItemLabel(item));
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        id={id}
        value={displayText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={
          isOpen && options[highlightedIndex]
            ? id
              ? `${id}-option-${options[highlightedIndex].id}`
              : undefined
            : undefined
        }
        className={cn(
          "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      {isOpen && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-0.5 max-h-[min(16rem,50vh)] w-full overflow-auto rounded border border-input bg-background py-1 shadow-md"
        >
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              No matches
            </li>
          ) : (
            options.map((item, idx) => {
              const inactive = !item.isActive;
              return (
                <li
                  key={item.id}
                  id={id ? `${id}-option-${item.id}` : undefined}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  aria-disabled={inactive}
                  className={cn(
                    "px-2 py-1.5 text-sm",
                    inactive
                      ? "cursor-not-allowed text-muted-foreground opacity-70"
                      : "cursor-pointer",
                    !inactive && highlightedIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : !inactive && "hover:bg-accent/60",
                    inactive && highlightedIndex === idx && "bg-muted/50",
                  )}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(item);
                  }}
                >
                  {getItemLabel(item)}
                  {inactive && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(Inactive)</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
});
