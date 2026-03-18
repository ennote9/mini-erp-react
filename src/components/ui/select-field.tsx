"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const VISIBLE_ROWS = 5;
const ROW_HEIGHT_PX = 32;
const LIST_MAX_HEIGHT_PX = VISIBLE_ROWS * ROW_HEIGHT_PX;

export type SelectFieldOption = { value: string; label: string };

type SelectFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-8 w-[280px] items-center rounded border border-input bg-background pl-2 pr-1.5 py-1 text-left text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-0 p-0"
        align="start"
        sideOffset={2}
      >
        <ul
          role="listbox"
          className="overflow-y-auto py-0.5"
          style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
        >
          <li role="option">
            <button
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                !value && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </button>
          </li>
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={value === opt.value}>
              <button
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  value === opt.value && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
