import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  /** Show "X results" on the right only when value is non-empty */
  resultCount?: number;
  /** Optional id for the input (for labels / a11y). */
  id?: string;
  /** Optional name for the input (defaults to "search" for form semantics). */
  name?: string;
};

/**
 * Search field for list pages: one block. Icon + placeholder when empty and unfocused;
 * on focus they hide, input from the left. Clear (X) on the left when value set. "X results" on the right.
 */
export function ListPageSearch({
  placeholder,
  value,
  onChange,
  "aria-label": ariaLabel,
  resultCount,
  id,
  name = "search",
}: Props) {
  const [focused, setFocused] = useState(false);
  const showLeftOverlay = value === "" && !focused;
  const showClearButton = value !== "";
  const showResultCount = value.trim() !== "" && resultCount != null;

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
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="list-page-search__clear-icon" />
        </button>
      )}
      <input
        type="search"
        id={id}
        name={name}
        className="list-page-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={ariaLabel}
        placeholder=""
      />
      {showResultCount && (
        <div className="list-page-search__right-overlay" aria-hidden>
          {resultCount} results
        </div>
      )}
    </div>
  );
}
