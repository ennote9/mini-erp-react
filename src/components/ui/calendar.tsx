"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UI } from "react-day-picker";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

type MonthProps = {
  calendarMonth: unknown;
  displayIndex: number;
} & React.HTMLAttributes<HTMLDivElement>;

function isPrevButton(c: React.ReactNode): boolean {
  return React.isValidElement(c) && typeof (c.props as { className?: string }).className === "string" && (c.props as { className: string }).className.includes("button_previous");
}
function isNextButton(c: React.ReactNode): boolean {
  return React.isValidElement(c) && typeof (c.props as { className?: string }).className === "string" && (c.props as { className: string }).className.includes("button_next");
}
function isCaption(c: React.ReactNode): boolean {
  return React.isValidElement(c) && typeof (c.props as { className?: string }).className === "string" && (c.props as { className: string }).className.includes("month_caption");
}

/** Custom Month so header is one horizontal bar: [Prev] [Month/Year] [Next] instead of stacked */
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

  const prev = headerChildren.find(isPrevButton);
  const next = headerChildren.find(isNextButton);
  const caption = headerChildren.find(isCaption);

  return (
    <div className={cn("flex flex-col gap-0", className)} {...rest}>
      {headerChildren.length > 0 && (
        <div
          className="rdp-calendar-header flex items-center gap-2 min-h-9 py-0 border-b border-border w-full"
          role="presentation"
        >
          <div className="shrink-0">{prev ?? null}</div>
          <div className="min-w-0 flex-1 flex justify-center items-center">{caption ?? null}</div>
          <div className="shrink-0">{next ?? null}</div>
        </div>
      )}
      {bodyChildren}
    </div>
  );
}

const startMonth = new Date(1900, 0, 1);
const endMonth = new Date(2100, 11, 31);

/** Dropdown without duplicate label (only the select, no "март"/"2026" span next to it) */
function DropdownOnlySelect(props: {
  options?: Array<{ value: number; label: string; disabled?: boolean }>;
  className?: string;
  components: { Select: React.ComponentType<React.SelectHTMLAttributes<HTMLSelectElement>>; Option: React.ComponentType<React.OptionHTMLAttributes<HTMLOptionElement>> };
  classNames: Record<string, string>;
  value?: string | number | readonly string[];
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  "aria-label"?: string;
}) {
  const { options, className, components, classNames, value, ...rest } = props;
  const cssClassSelect = [classNames[UI.Dropdown], className].filter(Boolean).join(" ");
  const selectValue = value != null && value !== "" ? String(value) : undefined;
  return (
    <span data-disabled={props.disabled} className={classNames[UI.DropdownRoot]}>
      <components.Select className={cssClassSelect} value={selectValue} {...rest}>
        {options?.map(({ value: optVal, label, disabled }) => (
          <components.Option key={optVal} value={optVal} disabled={disabled}>
            {label}
          </components.Option>
        ))}
      </components.Select>
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
        "rdp-root px-3 py-2 text-[15px]",
        "[--rdp-day-height:28px][--rdp-day-width:28px]",
        "[--rdp-day_button-height:26px][--rdp-day_button-width:26px]",
        "[--rdp-nav_button-height:2.25rem][--rdp-nav_button-width:2.25rem]",
        "[--rdp-nav-height:2.25rem]",
        className
      )}
      classNames={{
        months: "flex flex-col gap-0",
        month: "flex flex-col gap-0",
        month_caption: "flex justify-center items-center relative min-h-9 py-0",
        dropdown_root: "flex items-center gap-2",
        dropdown: "rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-none min-w-0",
        nav: "flex items-center gap-1",
        button_previous: "h-9 w-9 shrink-0 rounded-md border border-input bg-background flex items-center justify-center hover:bg-accent/50",
        button_next: "h-9 w-9 shrink-0 rounded-md border border-input bg-background flex items-center justify-center hover:bg-accent/50",
        month_grid: "w-full border-collapse",
        weekdays: "flex gap-0",
        weekday:
          "text-muted-foreground rounded w-[28px] min-w-[28px] font-normal text-[0.8em] leading-none text-center py-1.5",
        week: "flex w-full gap-0 mt-0 mb-0",
        day: "relative p-0 text-center leading-none w-[28px] min-w-[28px] focus-within:relative [&:has([data-selected])]:bg-zinc-600 [&:has([data-selected].day-outside)]:bg-zinc-600/70 [&:has([data-selected].day-range-end)]:rounded-r",
        day_button: cn(
          "h-[26px] w-[26px] min-w-[26px] p-0 font-normal aria-selected:opacity-100 rounded-md leading-none border-2 border-transparent aria-selected:border-white hover:bg-accent/40",
          buttonVariants({ variant: "ghost", size: "icon" })
        ),
        range_start: "day-range-start rounded-s-md",
        range_end: "day-range-end rounded-e-md",
        selected:
          "bg-zinc-600 text-foreground border-2 border-white rounded-md hover:bg-zinc-500 focus:bg-zinc-500",
        today: "bg-zinc-600/60 text-foreground",
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
      }}
      components={{
        Month: MonthWithHeaderBar,
        Dropdown: DropdownOnlySelect,
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
