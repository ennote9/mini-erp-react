import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="input-group"
    className={cn("relative flex min-w-0", className)}
    {...props}
  />
));
InputGroup.displayName = "InputGroup";

type InputGroupAddonAlign =
  | "inline-start"
  | "inline-end"
  | "block-start"
  | "block-end";

const InputGroupAddon = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & { align?: InputGroupAddonAlign }
>(({ className, align = "inline-start", style, ...props }, ref) => {
  const order =
    align === "inline-start" ? -1 : align === "inline-end" ? 1 : undefined;
  return (
    <div
      ref={ref}
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "inline-flex h-10 items-center justify-center border border-input bg-muted/50 text-muted-foreground [&>svg]:size-4",
        align === "inline-start" && "rounded-l-md border-r-0 pl-3 pr-2",
        align === "inline-end" && "rounded-r-md border-l-0 pl-2 pr-3",
        align === "block-start" && "rounded-t-md border-b-0 px-3 py-2",
        align === "block-end" && "rounded-b-md border-t-0 px-3 py-2",
        className
      )}
      style={order !== undefined ? { ...style, order } : style}
      {...props}
    />
  );
});
InputGroupAddon.displayName = "InputGroupAddon";

const InputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "min-w-0 flex-1 rounded-r-md rounded-l-none border-l-0 focus-visible:outline-none",
      className
    )}
    {...props}
  />
));
InputGroupInput.displayName = "InputGroupInput";

export { InputGroup, InputGroupAddon, InputGroupInput };
