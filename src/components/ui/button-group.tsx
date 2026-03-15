import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonGroupProps = React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
};

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-slot="button-group"
      className={cn(
        "inline-flex overflow-hidden rounded-md",
        orientation === "horizontal" &&
          "flex-row [&>*:first-child]:rounded-r-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-l-none [&>*:last-child]:rounded-r-md [&>*:not(:first-child):not(:last-child)]:rounded-sm [&>*+*]:border-l-0",
        orientation === "vertical" &&
          "flex-col [&>*:first-child]:rounded-b-none [&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-t-none [&>*:last-child]:rounded-b-md [&>*:not(:first-child):not(:last-child)]:rounded-sm [&>*+*]:border-t-0",
        className
      )}
      {...props}
    />
  )
);
ButtonGroup.displayName = "ButtonGroup";

type ButtonGroupSeparatorProps = React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
};

const ButtonGroupSeparator = React.forwardRef<
  HTMLDivElement,
  ButtonGroupSeparatorProps
>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "vertical" && "w-px self-stretch",
      orientation === "horizontal" && "h-px w-full",
      className
    )}
    {...props}
  />
));
ButtonGroupSeparator.displayName = "ButtonGroupSeparator";

export { ButtonGroup, ButtonGroupSeparator };
