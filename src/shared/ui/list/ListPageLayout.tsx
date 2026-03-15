import type { ReactNode } from "react";

type Props = {
  /** Optional: primary action area (e.g. New button). Rendered in the page header zone. */
  header?: ReactNode;
  /** Optional: search and filters. Rendered in the controls bar. */
  controls?: ReactNode;
  /** Main content: table or empty state. */
  children: ReactNode;
};

/**
 * Canonical list page structure: header zone, controls zone, content zone.
 * Page title lives in the shell top bar; this layout does not repeat it.
 */
export function ListPageLayout({ header, controls, children }: Props) {
  return (
    <div className="list-page">
      {header != null && (
        <div className="list-page__header">{header}</div>
      )}
      {controls != null && (
        <div className="list-page__controls">{controls}</div>
      )}
      <div className="list-page__content">{children}</div>
    </div>
  );
}
