import { useEffect, useRef, useState, type Ref } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n/context";

type Props = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Debounce delay for external state/URL sync while typing. */
  debounceMs?: number;
  "aria-label": string;
  /** Show "X results" on the right only when value is non-empty */
  resultCount?: number;
  /** Optional id for the input (for labels / a11y). */
  id?: string;
  /** Optional name for the input (defaults to "search" for form semantics). */
  name?: string;
  /** Ref to the search input (e.g. for `/` list-page hotkey). */
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * Search field for list pages: one block. Icon + placeholder when empty and unfocused;
 * on focus they hide, input from the left. Clear (X) on the left when value set. "X results" on the right.
 */
export function ListPageSearch({
  placeholder,
  value,
  onChange,
  debounceMs,
  "aria-label": ariaLabel,
  resultCount,
  id,
  name = "search",
  inputRef,
}: Props) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const shouldDebounce = typeof debounceMs === "number" && debounceMs > 0;
  const showLeftOverlay = inputValue === "" && !focused;
  const showClearButton = inputValue !== "";
  const showResultCount = inputValue.trim() !== "" && resultCount != null;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!shouldDebounce) return;
    if (inputValue === value) return;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inputValue === "") {
      onChange("");
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChange(inputValue);
    }, debounceMs);
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [inputValue, value, onChange, debounceMs, shouldDebounce]);

  const flushInput = () => {
    if (!shouldDebounce) return;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inputValue !== value) onChange(inputValue);
  };

  return (
    <div
      className={cn(
        "list-page-search",
        showResultCount && "list-page-search--with-results",
        showClearButton && "list-page-search--has-value"
      )}
    >
      {showLeftOverlay && (
        <div className="list-page-search__left-overlay" aria-hidden>
          <Search className="list-page-search__icon" />
          <span className="list-page-search__placeholder">{placeholder}</span>
        </div>
      )}
      {showClearButton && (
        <button
          type="button"
          className="list-page-search__clear"
          onClick={() => {
            setInputValue("");
            if (!shouldDebounce) onChange("");
          }}
          aria-label={t("doc.list.clearSearchAria")}
        >
          <X className="list-page-search__clear-icon" />
        </button>
      )}
      <input
        ref={inputRef}
        type="search"
        id={id}
        name={name}
        className="list-page-search__input"
        value={inputValue}
        onChange={(e) => {
          const next = e.target.value;
          setInputValue(next);
          if (!shouldDebounce) onChange(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          flushInput();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") flushInput();
        }}
        aria-label={ariaLabel}
        placeholder=""
      />
      {showResultCount && (
        <div className="list-page-search__right-overlay" aria-hidden>
          {t("doc.list.searchResultsCount", { count: resultCount })}
        </div>
      )}
    </div>
  );
}
