import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Printer } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DocumentPrintMenuItem = {
  to: string;
  label: string;
};

type DocumentPrintActionsMenuProps = {
  items: DocumentPrintMenuItem[];
  triggerLabel: string;
  "aria-label": string;
  className?: string;
  /** Tailwind classes for Printer + chevron (defaults to muted). */
  iconClassName?: string;
};

/**
 * Compact dark-style print menu (popover trigger + link items), aligned with SelectField / doc export menus.
 */
export function DocumentPrintActionsMenu({
  items,
  triggerLabel,
  "aria-label": ariaLabel,
  className,
  iconClassName,
}: DocumentPrintActionsMenuProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            "erp-dark-scrollbar flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-sm font-medium text-foreground shadow-sm",
            "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <Printer className={cn("h-4 w-4 shrink-0", iconClassName ?? "text-muted-foreground")} aria-hidden />
          <span className="whitespace-nowrap">{triggerLabel}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0", iconClassName ?? "text-muted-foreground")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="border-border bg-popover p-0 py-1 text-popover-foreground shadow-md"
        align="end"
        side="top"
        sideOffset={4}
      >
        <ul role="menu" className="min-w-[12rem]">
          {items.map((item) => (
            <li key={item.to} role="none">
              <Link
                role="menuitem"
                to={item.to}
                className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
