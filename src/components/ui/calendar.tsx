"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { UI } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

type MonthProps = {
  calendarMonth: unknown;
  displayIndex: number;
} & React.HTMLAttributes<HTMLDivElement>;

/** Custom Month: one horizontal bar [Prev] [Month/Year] [Next]. Order from library is always Prev, Caption, Next for single month. */
function MonthWithHeaderBar(props: MonthProps) {
  const { children, className, ...rest } = props;
  const list = React.Children.toArray(children);
  const gridIndex = list.findIndex((c) => {
    if (!React.isValidElement(c)) return false;
    const p = c.props as { className?: string; role?: string };
    return p.role === "grid" || (typeof p.className === "string" && p.className.includes("month_grid"));
  });
  const headerChildren = gridIndex >= 0 ? list.slice(0, gridIndex) : [];
  const bodyChildren = gridIndex >= 0 ? list.slice(gridIndex) : list;

  // With navLayout="around" and single month: [PreviousMonthButton, MonthCaption, NextMonthButton]
  const prev = headerChildren[0] ?? null;
  const caption = headerChildren[1] ?? null;
  const next = headerChildren[2] ?? null;

  return (
    <div className={cn("flex flex-col gap-0", className)} {...rest}>
      {headerChildren.length > 0 && (
        <div
          className="rdp-calendar-header flex items-center justify-between gap-0 h-6 py-0 w-[168px] rounded-t-md"
          role="presentation"
        >
          <div className="shrink-0">{prev}</div>
          <div className="min-w-0 flex-1 flex justify-center items-center">{caption}</div>
          <div className="shrink-0">{next}</div>
        </div>
      )}
      {bodyChildren}
    </div>
  );
}

const startMonth = new Date(1900, 0, 1);
const endMonth = new Date(2100, 11, 31);

/** Popover dropdown opening upward so it doesn't cover the calendar grid */
function CalendarDropdown(props: {
  options?: Array<{ value: number; label: string; disabled?: boolean }>;
  className?: string;
  components: { Select: React.ComponentType<React.SelectHTMLAttributes<HTMLSelectElement>>; Option: React.ComponentType<React.OptionHTMLAttributes<HTMLOptionElement>> };
  classNames: Record<string, string>;
  value?: string | number | readonly string[];
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  "aria-label"?: string;
}) {
  const { options = [], className, classNames, value, disabled, onChange, "aria-label": ariaLabel } = props;
  const [open, setOpen] = React.useState(false);
  const selectValue = value != null && value !== "" ? Number(value) : undefined;
  const currentLabel = options.find((o) => o.value === selectValue)?.label ?? String(selectValue ?? "");

  const handleSelect = (val: number) => {
    const syntheticEvent = { target: { value: String(val) } } as React.ChangeEvent<HTMLSelectElement>;
    onChange?.(syntheticEvent);
    setOpen(false);
  };

  return (
    <span data-disabled={disabled} className={classNames[UI.DropdownRoot]}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              classNames[UI.Dropdown],
              "h-8 min-h-8 rounded-sm border-0 bg-transparent px-1.5 py-0 text-xs leading-none min-w-0 flex items-center gap-0.5 text-foreground focus:ring-0 focus:ring-offset-0 hover:bg-white/10 cursor-pointer",
              className
            )}
          >
            <span className="min-w-0 truncate">{currentLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] min-w-0 p-0 max-h-[200px] overflow-y-auto"
        >
          <div className="py-1">
            {options.map(({ value: optVal, label, disabled: optDisabled }) => (
              <button
                key={optVal}
                type="button"
                disabled={optDisabled}
                className={cn(
                  "w-full px-2 py-1.5 text-left text-xs rounded-none focus:bg-accent focus:text-accent-foreground outline-none",
                  selectValue === optVal && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleSelect(optVal)}
              >
                {label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  locale = ru,
  startMonth: startMonthProp,
  endMonth: endMonthProp,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      locale={locale}
      startMonth={startMonthProp ?? startMonth}
      endMonth={endMonthProp ?? endMonth}
      navLayout="around"
      className={cn(
        "rdp-root pl-1.5 pr-0 py-0.5 text-[13px]",
        "[--rdp-day-height:24px][--rdp-day-width:24px]",
        "[--rdp-day_button-height:20px][--rdp-day_button-width:20px]",
        "[--rdp-nav_button-height:1.5rem][--rdp-nav_button-width:1.5rem]",
        "[--rdp-nav-height:1.5rem]",
        "[--rdp-today-color:var(--destructive)]",
        className
      )}
      classNames={{
        months: "flex flex-col gap-0",
        month: "flex flex-col gap-0",
        month_caption: "flex justify-center items-center relative h-6 py-0",
        dropdown_root: "flex items-center gap-1 h-6",
        dropdown: "h-6 min-h-6 rounded-sm border-0 bg-transparent px-1 py-0 text-xs leading-none min-w-0 flex items-center text-foreground focus:ring-0 focus:ring-offset-0",
        nav: "flex items-center gap-0",
        button_previous: "h-6 w-6 shrink-0 rounded-sm border-0 bg-transparent text-foreground flex items-center justify-center hover:bg-white/10 focus:ring-0 focus:ring-offset-0",
        button_next: "h-6 w-6 shrink-0 rounded-sm border-0 bg-transparent text-foreground flex items-center justify-center hover:bg-white/10 focus:ring-0 focus:ring-offset-0",
        month_grid: "w-[168px] border-collapse",
        weekdays: "flex gap-0",
        weekday:
          "text-muted-foreground rounded w-[24px] min-w-[24px] font-normal text-[0.65em] leading-none text-center py-0",
        week: "flex w-full gap-0 mt-0 mb-0",
        day: "relative p-0 text-center leading-none w-[24px] min-w-[24px] border-2 border-transparent focus-within:relative [&:has([data-selected])]:bg-zinc-600 [&:has([data-selected].day-outside)]:bg-zinc-600/70 [&:has([data-selected].day-range-end)]:rounded-r [&:has(.today)]:!bg-transparent",
        day_button: cn(
          "p-0 font-normal aria-selected:opacity-100 rounded-sm leading-none border-2 border-transparent aria-selected:border-white hover:bg-accent/40",
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-[20px] w-[20px] min-w-[20px]"
        ),
        range_start: "day-range-start rounded-s-md",
        range_end: "day-range-end rounded-e-md",
        selected:
          "bg-zinc-600 text-foreground border-2 border-white rounded-md hover:bg-zinc-500 focus:bg-zinc-500",
        today: "rdp-today today !bg-transparent !border-transparent !border-2 text-destructive",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      formatters={{
        formatWeekdayName: (weekday, _options, dateLib) =>
          dateLib ? dateLib.format(weekday, "EEE").slice(0, 2) : "",
        formatDay: (date) => String(date.getDate()).padStart(2, "0"),
      }}
      components={{
        Month: MonthWithHeaderBar,
        Dropdown: CalendarDropdown,
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="h-3.5 w-3.5" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
