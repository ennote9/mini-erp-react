import { Link } from "react-router-dom";

export type BreadcrumbItem = { label: string; to?: string };

type Props = { items: BreadcrumbItem[] };

/**
 * Breadcrumb nav for object/document pages. Last item is current page (no link).
 */
export function Breadcrumb({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <nav className="doc-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="doc-breadcrumb__item">
            {isLast ? (
              <span className="doc-breadcrumb__current">{item.label}</span>
            ) : item.to != null ? (
              <Link to={item.to} className="doc-breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className="doc-breadcrumb__text">{item.label}</span>
            )}
            {!isLast && (
              <span className="doc-breadcrumb__sep" aria-hidden>
                {" / "}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
