import { cn } from "@/lib/utils";

type Props = {
  svg: string;
  className?: string;
  title?: string;
};

/**
 * Renders trusted SVG from bwip-js inside a constrained box.
 */
export function PreviewSvgMarkup({ svg, className, title }: Props) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden text-foreground [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:object-contain",
        className,
      )}
      // Trusted: generated locally via bwip-js from preview data only.
      dangerouslySetInnerHTML={{ __html: svg }}
      title={title}
    />
  );
}
