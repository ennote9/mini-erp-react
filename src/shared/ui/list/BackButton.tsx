import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  fallbackTo?: string;
  preferHistory?: boolean;
  "aria-label"?: string;
  className?: string;
};

/**
 * Back button: navigates to the given route (e.g. list → Dashboard "/", detail → list "/items").
 */
export function BackButton({
  to,
  fallbackTo,
  preferHistory = false,
  "aria-label": ariaLabel = "Back",
  className,
}: Props) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    if (preferHistory && typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (fallbackTo) {
      navigate(fallbackTo);
      return;
    }
    navigate("/");
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0 h-8 w-8 p-0 rounded-lg", className)}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
