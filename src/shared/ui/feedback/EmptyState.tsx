type Props = {
  /** Short title (e.g. "No items yet") */
  title: string;
  /** Hint or suggestion below the title */
  hint?: string;
};

/**
 * Empty state for list pages. Used when there are no rows (empty or filtered-empty).
 */
export function EmptyState({ title, hint }: Props) {
  return (
    <div className="list-page__empty">
      <p className="list-page__empty-title">{title}</p>
      {hint != null && (
        <p className="list-page__empty-hint">{hint}</p>
      )}
    </div>
  );
}
