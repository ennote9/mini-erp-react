import { useTranslation } from "@/shared/i18n";

type Props = {
  /** Internal status value (e.g. draft, confirmed, posted). */
  status: string;
};

/**
 * Document status as plain text (no badge/pill).
 */
export function StatusBadge({ status }: Props) {
  const { t } = useTranslation();
  return <span>{t(`status.labels.${status}`)}</span>;
}
