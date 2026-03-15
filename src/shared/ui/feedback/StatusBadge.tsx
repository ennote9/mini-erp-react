type Props = {
  /** Internal status value (e.g. draft, confirmed, posted). */
  status: string;
};

const DISPLAY: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  closed: "Closed",
  cancelled: "Cancelled",
  posted: "Posted",
};

function toDisplay(status: string): string {
  return DISPLAY[status] ?? status;
}

/**
 * Badge for document status. Renders title-case label with status-based class.
 */
export function StatusBadge({ status }: Props) {
  const display = toDisplay(status);
  const variant = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <span
      className={`list-table__badge list-table__badge--status list-table__badge--${variant}`}
    >
      {display}
    </span>
  );
}
