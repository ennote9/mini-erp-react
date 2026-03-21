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
  reversed: "Reversed",
};

function toDisplay(status: string): string {
  return DISPLAY[status] ?? status;
}

/**
 * Document status as plain text (no badge/pill).
 */
export function StatusBadge({ status }: Props) {
  return <span>{toDisplay(status)}</span>;
}
