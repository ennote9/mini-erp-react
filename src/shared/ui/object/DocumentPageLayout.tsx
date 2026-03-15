import type { ReactNode } from "react";
import type { BreadcrumbItem } from "./Breadcrumb";
import { Breadcrumb } from "./Breadcrumb";

type Props = {
  breadcrumbItems: BreadcrumbItem[];
  /** Optional node before breadcrumb (e.g. Back button) */
  breadcrumbPrefix?: ReactNode;
  /** Header: title + number, status badge, actions */
  header: ReactNode;
  /** Summary block: key-value fields */
  summary: ReactNode;
  /** Main content: e.g. lines table */
  children: ReactNode;
};

/**
 * Canonical document page structure: breadcrumb, header zone, summary zone, content zone.
 */
export function DocumentPageLayout({
  breadcrumbItems,
  breadcrumbPrefix,
  header,
  summary,
  children,
}: Props) {
  return (
    <div className="doc-page">
      {(breadcrumbItems.length > 0 || breadcrumbPrefix) && (
        <div className="doc-page__breadcrumb">
          {breadcrumbPrefix}
          {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        </div>
      )}
      <div className="doc-page__header">{header}</div>
      <div className="doc-page__summary">{summary}</div>
      <div className="doc-page__content">{children}</div>
    </div>
  );
}
