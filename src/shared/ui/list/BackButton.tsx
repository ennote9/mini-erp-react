import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  to: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * Back button: navigates to the given route (e.g. list → Dashboard "/", detail → list "/items").
 */
export function BackButton({
  to,
  "aria-label": ariaLabel = "Back",
  className,
}: Props) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0 h-8 w-8 p-0 rounded-lg", className)}
      aria-label={ariaLabel}
      onClick={() => navigate(to)}
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
