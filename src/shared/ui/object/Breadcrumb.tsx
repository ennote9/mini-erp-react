import * as React from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbItem as BreadcrumbItemComp,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type BreadcrumbItem = { label: string; to?: string };

type Props = { items: BreadcrumbItem[] };

/**
 * Breadcrumb nav for object/document pages using shadcn/ui Radix-style component.
 * Last item is current page (no link). See https://ui.shadcn.com/docs/components/radix/breadcrumb
 */
export function Breadcrumb({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <BreadcrumbRoot className="doc-breadcrumb">
      <BreadcrumbList>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <React.Fragment key={i}>
              <BreadcrumbItemComp>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.to != null ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItemComp>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  );
}
