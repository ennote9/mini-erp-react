"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function toDate(value: string): Date | undefined {
  if (!value || value.trim() === "") return undefined;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  const date = new Date(y, m, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

/** Parse dd.MM.yyyy or d.M.yyyy; returns YYYY-MM-DD or null if invalid */
function parseDisplayText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31)
    return null;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
    return null;
  return toYYYYMMDD(date);
}

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function DatePickerField({
  value,
  onChange,
  id,
  placeholder = "дд.мм.гггг",
  disabled,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [inputText, setInputText] = React.useState("");
  const date = toDate(value);

  React.useEffect(() => {
    setInputText(date ? formatDisplay(date) : "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseDisplayText(inputText);
    if (parsed) {
      onChange(parsed);
      setInputText(formatDisplay(toDate(parsed)!));
    } else {
      setInputText(date ? formatDisplay(date) : "");
    }
  };

  const handleSelect = React.useCallback(
    (d: Date | undefined) => {
      if (d) {
        onChange(toYYYYMMDD(d));
        setInputText(formatDisplay(d));
        setOpen(false);
      }
    },
    [onChange]
  );

  const handleToday = React.useCallback(() => {
    const today = new Date();
    onChange(toYYYYMMDD(today));
    setInputText(formatDisplay(today));
    setOpen(false);
  }, [onChange]);

  return (
    <div className={cn("flex gap-1", className)}>
      <Input
        id={id}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0"
        autoComplete="off"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="h-10 w-10 shrink-0"
            aria-label="Открыть календарь"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-md border shadow-md overflow-hidden"
          align="end"
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date}
          />
          <div className="flex justify-end border-t border-border px-0.5 py-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 min-h-6 px-2 leading-none font-normal shrink-0"
              style={{ fontSize: "15px" }}
              onClick={handleToday}
            >
              Сегодня
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
